import { describe, expect, it } from "vitest";
import {
  allocate,
  computeBalances,
  computeShares,
  formatMoney,
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
      if (w.every((x) => x === 0)) w[0] = 1;
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
