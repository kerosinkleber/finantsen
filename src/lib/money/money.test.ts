import { describe, expect, it } from "vitest";
import {
  allocate,
  computeBalances,
  computeShares,
  formatMoney,
  isValidCurrency,
  mergeBalances,
  pairwiseDebts,
  minorUnits,
  parseAmount,
  simplifyDebts,
  SplitError,
  toDecimalString,
  validatePayers,
  type Transfer,
} from "./index";

const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);

describe("currency", () => {
  it("validiert Währungscodes gegen ISO 4217", () => {
    for (const c of ["EUR", "USD", "JPY", "KWD", "CHF", "BRL"]) expect(isValidCurrency(c)).toBe(true);
    for (const c of ["XXZ", "ABC", "eur", "EU", "EURO", "", "123"]) expect(isValidCurrency(c)).toBe(false);
  });
  it("kennt Nachkommastellen", () => {
    expect(minorUnits("EUR")).toBe(2);
    expect(minorUnits("JPY")).toBe(0);
    expect(minorUnits("KWD")).toBe(3);
  });
  it("parst Beträge", () => {
    expect(parseAmount("12,50", "EUR")).toBe(1250);
    expect(parseAmount("12.5", "EUR")).toBe(1250);
    expect(parseAmount("1.234,56", "EUR")).toBe(123456);
    expect(parseAmount("1,234.56", "EUR")).toBe(123456);
    expect(parseAmount("1.234.567", "JPY")).toBe(1234567);
    expect(parseAmount("500", "JPY")).toBe(500);
    expect(parseAmount("1,234", "KWD")).toBe(1234);
    expect(parseAmount("0,05", "EUR")).toBe(5);
    expect(parseAmount("-3,10", "EUR")).toBe(-310);
  });
  it("lehnt ungültige Beträge und stille Rundung ab", () => {
    expect(parseAmount("", "EUR")).toBeNull();
    expect(parseAmount("abc", "EUR")).toBeNull();
    expect(parseAmount("1,234", "EUR")).toBeNull();
    expect(parseAmount("1,50", "JPY")).toBeNull();
    expect(parseAmount("1,500", "EUR")).toBe(150);
    expect(parseAmount("99999999999999999", "EUR")).toBeNull();
  });
  it("formatiert", () => {
    expect(toDecimalString(1250, "EUR")).toBe("12.50");
    expect(toDecimalString(5, "EUR")).toBe("0.05");
    expect(toDecimalString(-5, "EUR")).toBe("-0.05");
    expect(toDecimalString(500, "JPY")).toBe("500");
    expect(toDecimalString(1234, "KWD")).toBe("1.234");
    expect(formatMoney(1250, "EUR", "en")).toBe("€12.50");
    expect(formatMoney(500, "JPY", "en")).toBe("¥500");
  });
});

describe("allocate", () => {
  it("verteilt Rest deterministisch", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1, [1, 1, 1])).toEqual([1, 0, 0]);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });
  it("Summe stimmt immer (Fuzz)", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    for (let i = 0; i < 2000; i++) {
      const n = 1 + Math.floor(rnd() * 8);
      const w: number[] = Array.from({ length: n }, () => Math.floor(rnd() * 1000));
      if (w.reduce((a, b) => a + b, 0) === 0) w[0] = 1;
      const total = Math.floor(rnd() * 10_000_000) - 100_000;
      const r = allocate(total, w);
      expect(r.reduce((a, b) => a + b, 0)).toBe(total);
      w.forEach((wi, k) => {
        if (wi === 0) expect(r[k]).toBe(0);
      });
    }
  });
  it("verteilt Rest nicht an Teilnehmer mit Gewicht 0", () => {
    expect(allocate(10, [0, 1, 1])).toEqual([0, 5, 5]);
    expect(allocate(1, [0, 1, 1])).toEqual([0, 1, 0]);
  });
  it("große Beträge ohne Überlauf", () => {
    const r = allocate(9_007_199_254_740_990, [3333, 3333, 3334]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(9_007_199_254_740_990);
  });
  it("Fehler", () => {
    expect(() => allocate(10, [])).toThrow(SplitError);
    expect(() => allocate(10, [0, 0])).toThrow(SplitError);
    expect(() => allocate(10, [-1, 2])).toThrow(SplitError);
    expect(() => allocate(1.5, [1])).toThrow(SplitError);
  });
});

describe("computeShares", () => {
  it("gleichmäßig, unabhängig von Eingabereihenfolge", () => {
    const a = computeShares(1000, { type: "equal", participants: ["c", "a", "b"] });
    const b = computeShares(1000, { type: "equal", participants: ["a", "b", "c"] });
    expect(a).toEqual(b);
    expect(a).toEqual([
      { id: "a", amount: 334 },
      { id: "b", amount: 333 },
      { id: "c", amount: 333 },
    ]);
  });
  it("gleichmäßig mit JPY (keine Nachkommastellen)", () => {
    const r = computeShares(100, { type: "equal", participants: ["a", "b", "c"] });
    expect(sum(r)).toBe(100);
  });
  it("Prozente", () => {
    const r = computeShares(1001, {
      type: "percent",
      entries: [
        { id: "a", bp: 3333 },
        { id: "b", bp: 3333 },
        { id: "c", bp: 3334 },
      ],
    });
    expect(sum(r)).toBe(1001);
  });
  it("Prozente müssen 100 % ergeben", () => {
    expect(() =>
      computeShares(100, { type: "percent", entries: [{ id: "a", bp: 5000 }, { id: "b", bp: 4999 }] }),
    ).toThrow(/percent_sum/);
  });
  it("feste Beträge müssen Summe ergeben", () => {
    expect(
      computeShares(100, { type: "exact", entries: [{ id: "a", amount: 30 }, { id: "b", amount: 70 }] }),
    ).toEqual([
      { id: "a", amount: 30 },
      { id: "b", amount: 70 },
    ]);
    expect(() =>
      computeShares(100, { type: "exact", entries: [{ id: "a", amount: 30 }, { id: "b", amount: 60 }] }),
    ).toThrow(/exact_sum/);
  });
  it("Shares", () => {
    const r = computeShares(1000, {
      type: "shares",
      entries: [
        { id: "a", shares: 2 },
        { id: "b", shares: 1 },
        { id: "c", shares: 0 },
      ],
    });
    expect(r).toEqual([
      { id: "a", amount: 667 },
      { id: "b", amount: 333 },
      { id: "c", amount: 0 },
    ]);
  });
  it("eine Person übernimmt alles", () => {
    expect(computeShares(777, { type: "full", owner: "x" })).toEqual([{ id: "x", amount: 777 }]);
  });
  it("lehnt Duplikate und leere Listen ab", () => {
    expect(() => computeShares(1, { type: "equal", participants: [] })).toThrow(SplitError);
    expect(() => computeShares(1, { type: "equal", participants: ["a", "a"] })).toThrow(SplitError);
    expect(() => computeShares(-1, { type: "equal", participants: ["a"] })).toThrow(SplitError);
  });
  it("Betrag 0 erlaubt", () => {
    expect(sum(computeShares(0, { type: "equal", participants: ["a", "b"] }))).toBe(0);
  });
});

describe("validatePayers", () => {
  it("Summe muss stimmen", () => {
    expect(() => validatePayers(100, [{ id: "a", amount: 60 }, { id: "b", amount: 40 }])).not.toThrow();
    expect(() => validatePayers(100, [{ id: "a", amount: 60 }])).toThrow(/payer_sum/);
    expect(() => validatePayers(100, [{ id: "a", amount: 50 }, { id: "a", amount: 50 }])).toThrow(SplitError);
  });
});

describe("balances", () => {
  it("berechnet Salden aus Ausgaben und Zahlungen", () => {
    const b = computeBalances(
      [
        {
          currency: "EUR",
          payers: [{ userId: "a", amount: 3000 }],
          shares: [
            { userId: "a", amount: 1000 },
            { userId: "b", amount: 1000 },
            { userId: "c", amount: 1000 },
          ],
        },
      ],
      [{ currency: "EUR", fromUser: "b", toUser: "a", amount: 1000 }],
    );
    expect(b).toEqual({ EUR: { a: 1000, c: -1000 } });
  });
  it("trennt Währungen und merged", () => {
    const x = computeBalances([
      { currency: "EUR", payers: [{ userId: "a", amount: 10 }], shares: [{ userId: "b", amount: 10 }] },
    ]);
    const y = computeBalances([
      { currency: "JPY", payers: [{ userId: "b", amount: 500 }], shares: [{ userId: "a", amount: 500 }] },
      { currency: "EUR", payers: [{ userId: "b", amount: 10 }], shares: [{ userId: "a", amount: 10 }] },
    ]);
    expect(mergeBalances([x, y])).toEqual({ JPY: { a: -500, b: 500 } });
  });
});

function applyTransfers(net: Record<string, number>, ts: Transfer[]) {
  const r = { ...net };
  for (const t of ts) {
    r[t.from] = (r[t.from] ?? 0) + t.amount;
    r[t.to] = (r[t.to] ?? 0) - t.amount;
  }
  return r;
}

describe("simplifyDebts", () => {
  it("leer / alles ausgeglichen", () => {
    expect(simplifyDebts({})).toEqual([]);
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });
  it("einfacher Fall", () => {
    expect(simplifyDebts({ a: 500, b: -500 })).toEqual([{ from: "b", to: "a", amount: 500 }]);
  });
  it("Kette a->b->c wird zu a->c", () => {
    // a schuldet b 10, b schuldet c 10 => netto a -10, c +10
    expect(simplifyDebts({ a: -10, b: 0, c: 10 })).toEqual([{ from: "a", to: "c", amount: 10 }]);
  });
  it("nutzt unabhängige Nullsummen-Paare (minimal, nicht nur gierig)", () => {
    // Gierig: 5 Überweisungen möglich; optimal sind 4: {+5,-5} und {+3,+4,-7}... hier 2 Gruppen => 5-2=3? n=5 => 3
    const net = { a: 5, b: -5, c: 3, d: 4, e: -7 };
    const ts = simplifyDebts(net);
    expect(ts.length).toBe(3);
    expect(Object.values(applyTransfers(net, ts)).every((v) => v === 0)).toBe(true);
  });
  it("lehnt nicht ausgeglichene Salden ab", () => {
    expect(() => simplifyDebts({ a: 1 })).toThrow();
  });
  it("Randfall: ein Gläubiger, viele Schuldner / umgekehrt", () => {
    const n1 = { a: 300, b: -100, c: -100, d: -100 };
    expect(simplifyDebts(n1)).toHaveLength(3);
    const n2 = { a: -300, b: 100, c: 100, d: 100 };
    expect(simplifyDebts(n2)).toHaveLength(3);
  });
  it("Fuzz: Salden gehen auf, Anzahl <= n-1, deterministisch", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    for (let t = 0; t < 300; t++) {
      const n = 2 + Math.floor(rnd() * 10);
      const net: Record<string, number> = {};
      let s = 0;
      for (let i = 0; i < n - 1; i++) {
        const v = Math.floor(rnd() * 2000) - 1000;
        net["u" + i] = v;
        s += v;
      }
      net["u" + (n - 1)] = -s;
      const ts = simplifyDebts(net);
      const nonzero = Object.values(net).filter((v) => v !== 0).length;
      expect(ts.length).toBeLessThanOrEqual(Math.max(0, nonzero - 1));
      expect(Object.values(applyTransfers(net, ts)).every((v) => v === 0)).toBe(true);
      expect(ts.every((x) => x.amount > 0)).toBe(true);
      expect(simplifyDebts(net)).toEqual(ts);
    }
  });
  it("Optimalität gegen Brute Force (kleine n)", () => {
    // max. Anzahl Nullsummen-Teilmengen per Brute Force über Partitionen
    function bestGroups(vals: number[]): number {
      const n = vals.length;
      let best = 0;
      const rec = (remaining: number, groups: number) => {
        if (remaining === 0) return void (best = Math.max(best, groups));
        const low = remaining & -remaining;
        for (let sub = remaining; sub; sub = (sub - 1) & remaining) {
          if (!(sub & low)) continue;
          let s = 0;
          for (let i = 0; i < n; i++) if (sub & (1 << i)) s += vals[i];
          if (s === 0) rec(remaining ^ sub, groups + 1);
        }
      };
      rec((1 << n) - 1, 0);
      return best;
    }
    let seed = 99;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    for (let t = 0; t < 150; t++) {
      const n = 2 + Math.floor(rnd() * 7);
      const vals: number[] = [];
      let s = 0;
      for (let i = 0; i < n - 1; i++) {
        const v = (Math.floor(rnd() * 11) - 5) * 10;
        vals.push(v);
        s += v;
      }
      vals.push(-s);
      const net = Object.fromEntries(vals.map((v, i) => ["u" + i, v]));
      const nz = vals.filter((v) => v !== 0);
      const expected = nz.length === 0 ? 0 : nz.length - bestGroups(nz);
      expect(simplifyDebts(net).length).toBe(expected);
    }
  });
  it("fällt bei vielen Beteiligten auf die Heuristik zurück", () => {
    const net: Record<string, number> = {};
    let tot = 0;
    for (let i = 0; i < 24; i++) {
      net["u" + i] = i % 2 ? -100 - i : 100 + i - 1;
      tot += net["u" + i];
    }
    net.u24 = -tot;
    const ts = simplifyDebts(net);
    expect(Object.values(applyTransfers(net, ts)).every((v) => v === 0)).toBe(true);
    expect(ts.length).toBeLessThanOrEqual(24);
  });
});

describe("pairwiseDebts", () => {
  it("rechnet gegeneinander auf und berücksichtigt Zahlungen", () => {
    const exp = [
      { currency: "EUR", payers: [{ userId: "a", amount: 2000 }], shares: [{ userId: "a", amount: 1000 }, { userId: "b", amount: 1000 }] },
      { currency: "EUR", payers: [{ userId: "b", amount: 600 }], shares: [{ userId: "a", amount: 300 }, { userId: "b", amount: 300 }] },
    ];
    expect(pairwiseDebts(exp)).toEqual({ EUR: [{ from: "b", to: "a", amount: 700 }] });
    expect(pairwiseDebts(exp, [{ currency: "EUR", fromUser: "b", toUser: "a", amount: 700 }])).toEqual({});
  });
  it("mehrere Zahler: Anteil proportional, Summe bleibt erhalten", () => {
    const exp = [
      {
        currency: "EUR",
        payers: [{ userId: "a", amount: 700 }, { userId: "b", amount: 300 }],
        shares: [{ userId: "c", amount: 1000 }],
      },
    ];
    expect(pairwiseDebts(exp)).toEqual({
      EUR: [{ from: "c", to: "a", amount: 700 }, { from: "c", to: "b", amount: 300 }],
    });
  });
});

import { computeStats } from "./index";
describe("computeStats", () => {
  it("aggregiert nach Kategorie, Monat und Person je Währung", () => {
    const s = computeStats([
      { currency: "EUR", amountMinor: 3000, date: "2026-01-15", category: "restaurant", payers: [{ userId: "a", amountMinor: 3000 }], shares: [{ userId: "a", amountMinor: 1500 }, { userId: "b", amountMinor: 1500 }] },
      { currency: "EUR", amountMinor: 1000, date: "2026-02-01", category: "restaurant", payers: [{ userId: "b", amountMinor: 1000 }], shares: [{ userId: "a", amountMinor: 500 }, { userId: "b", amountMinor: 500 }] },
      { currency: "EUR", amountMinor: 500, date: "2026-01-20", category: "transport", payers: [{ userId: "a", amountMinor: 500 }], shares: [{ userId: "b", amountMinor: 500 }] },
      { currency: "JPY", amountMinor: 900, date: "2026-01-02", category: "other", payers: [{ userId: "a", amountMinor: 900 }], shares: [{ userId: "a", amountMinor: 900 }] },
    ]);
    expect(s.EUR.total).toBe(4500);
    expect(s.EUR.count).toBe(3);
    expect(s.EUR.byCategory).toEqual([{ category: "restaurant", total: 4000 }, { category: "transport", total: 500 }]);
    expect(s.EUR.byMonth).toEqual([{ month: "2026-01", total: 3500 }, { month: "2026-02", total: 1000 }]);
    expect(s.EUR.byPerson).toEqual([{ userId: "a", paid: 3500, share: 2000 }, { userId: "b", paid: 1000, share: 2500 }]);
    expect(s.JPY.total).toBe(900);
  });
  it("leer", () => expect(computeStats([])).toEqual({}));
});

import { computeItemized, convertMinor, invertRate, normalizeRate, rescale } from "./index";
describe("convert", () => {
  it("normalisiert Kurse", () => {
    expect(normalizeRate("1,0873")).toBe("1.087300000000000");
    expect(normalizeRate(0.5)).toBe("0.500000000000000");
    expect(normalizeRate("0")).toBeNull();
    expect(normalizeRate("-1")).toBeNull();
    expect(normalizeRate("abc")).toBeNull();
    expect(normalizeRate(NaN)).toBeNull();
  });
  it("rechnet zwischen Währungen mit unterschiedlichen Nachkommastellen um", () => {
    expect(convertMinor(1000, "EUR", "USD", "1.1")).toBe(1100);
    expect(convertMinor(1000, "EUR", "JPY", "160")).toBe(1600); // 10,00 € = 1600 ¥
    expect(convertMinor(1600, "JPY", "EUR", "0.00625")).toBe(1000);
    expect(convertMinor(1000, "EUR", "KWD", "0.33")).toBe(3300); // 3,300 KWD
    expect(convertMinor(3300, "KWD", "EUR", "3.0303030303")).toBe(1000);
  });
  it("rundet kaufmännisch und behandelt gleiche Währung", () => {
    expect(convertMinor(1, "EUR", "USD", "1.5")).toBe(2);
    expect(convertMinor(1, "EUR", "USD", "1.4")).toBe(1);
    expect(convertMinor(-1, "EUR", "USD", "1.5")).toBe(-2);
    expect(convertMinor(123, "EUR", "EUR", "9")).toBe(123);
    expect(convertMinor(0, "EUR", "USD", "1.1")).toBe(0);
  });
  it("große Beträge ohne Überlauf", () => {
    expect(convertMinor(9_000_000_000_000, "EUR", "USD", "1.000000000000001")).toBe(9_000_000_000_000 + 0);
  });
  it("Kehrwert", () => {
    expect(invertRate("2")).toBe("0.500000000000000");
    expect(invertRate("0.5")).toBe("2.000000000000000");
  });
  it("rescale: Summe der umgerechneten Anteile == umgerechneter Gesamtbetrag", () => {
    const total = convertMinor(1001, "EUR", "USD", "1.0873");
    const parts = rescale(total, [334, 334, 333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    expect(rescale(0, [0, 0])).toEqual([0, 0]);
  });
});

describe("computeItemized", () => {
  it("verteilt Positionen und Steuer/Trinkgeld anteilig", () => {
    const r = computeItemized(
      1500 + 500 + 200 + 100,
      [
        { name: "Pizza", amount: 1500, participants: ["a"] },
        { name: "Wein", amount: 500, participants: ["a", "b"] },
      ],
      200,
      100,
    );
    // a: 1500+250 = 1750, b: 250 ; Steuer 200 -> a 1750/2000*200=175, b 25 ; Trinkgeld 100 -> a 87.5, b 12.5
    const sum = r.reduce((x, y) => x + y.amount, 0);
    expect(sum).toBe(2300);
    const a = r.find((x) => x.id === "a")!.amount;
    const b = r.find((x) => x.id === "b")!.amount;
    expect(a + b).toBe(2300);
    // exakt a = 2012,5 und b = 287,5: Gleichstand beim Rest, also nach ID-Reihenfolge an a
    expect([a, b]).toEqual([2013, 287]);
  });
  it("jede Person liegt weniger als 1 Cent neben dem exakten Wert (Befund aus dem Testbericht)", () => {
    // Pizza 15 € (lena, cleo, dora), Wein 5 € (admin, cleo, dora), Zuschlag 3 €: cleo/dora exakt je 766,666…
    const r = computeItemized(2300, [
      { name: "Pizza", amount: 1500, participants: ["lena", "cleo", "dora"] },
      { name: "Wein", amount: 500, participants: ["admin", "cleo", "dora"] },
    ], 300, 0);
    const exact: Record<string, number> = { lena: 575, cleo: 2300 * (2000 / 3) / 2000, dora: 2300 * (2000 / 3) / 2000, admin: 2300 * (500 / 3) / 2000 };
    for (const x of r) expect(Math.abs(x.amount - exact[x.id])).toBeLessThan(1);
    expect(r.reduce((s, x) => s + x.amount, 0)).toBe(2300);
  });
  it("Rest-Cent landet nicht immer bei derselben Person (exakt über alle Positionen)", () => {
    const items = [1, 2, 3, 4].map((i) => ({ name: "x" + i, amount: 1, participants: ["a", "b"] }));
    const r = computeItemized(4, items, 0, 0);
    expect(r).toEqual([{ id: "a", amount: 2 }, { id: "b", amount: 2 }]);
  });
  it("prüft Summe, Teilnehmer und Beträge", () => {
    expect(() => computeItemized(100, [{ name: "x", amount: 50, participants: ["a"] }], 0, 0)).toThrow(/items_sum/);
    expect(() => computeItemized(0, [], 0, 0)).toThrow(SplitError);
    expect(() => computeItemized(10, [{ name: "x", amount: 10, participants: [] }], 0, 0)).toThrow(SplitError);
    expect(() => computeItemized(10, [{ name: "x", amount: 10, participants: ["a", "a"] }], 0, 0)).toThrow(SplitError);
    expect(() => computeItemized(10, [{ name: "x", amount: 0, participants: ["a"] }], 10, 0)).toThrow(/invalid_weight/);
  });
  it("Summe stimmt immer (Fuzz) und ist reihenfolgeunabhängig bei Teilnehmern", () => {
    let seed = 5;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    const people = ["a", "b", "c", "d"];
    for (let t = 0; t < 300; t++) {
      const items = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, i) => ({
        name: "i" + i,
        amount: 1 + Math.floor(rnd() * 5000),
        participants: people.filter(() => rnd() < 0.5).concat(people[Math.floor(rnd() * 4)]).filter((v, i, a) => a.indexOf(v) === i),
      }));
      const tax = Math.floor(rnd() * 500);
      const tip = Math.floor(rnd() * 500);
      const total = items.reduce((a, b) => a + b.amount, 0) + tax + tip;
      const r = computeItemized(total, items, tax, tip);
      expect(r.reduce((x, y) => x + y.amount, 0)).toBe(total);
      const shuffled = items.map((i) => ({ ...i, participants: [...i.participants].reverse() }));
      expect(computeItemized(total, shuffled, tax, tip)).toEqual(r);
    }
  });
  it("computeShares unterstützt items", () => {
    const r = computeShares(300, { type: "items", items: [{ name: "x", amount: 300, participants: ["a", "b", "c"] }], tax: 0, tip: 0 });
    expect(r.map((x) => x.amount)).toEqual([100, 100, 100]);
  });
});
