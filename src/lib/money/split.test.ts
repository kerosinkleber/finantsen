import { describe, expect, it } from "vitest";
import { computeShares, mainPayer } from "./split";

describe("gleich mit Anpassungen", () => {
  it("Rest gleich verteilt, Anpassung addiert, Summe stimmt", () => {
    // 100 € für 3, Anna +10 €: Rest 90 € → je 30 €, Anna 40 €
    expect(computeShares(10000, { type: "adjust", entries: [{ id: "a", adjust: 1000 }, { id: "b", adjust: 0 }, { id: "c", adjust: 0 }] })).toEqual([
      { id: "a", amount: 4000 },
      { id: "b", amount: 3000 },
      { id: "c", amount: 3000 },
    ]);
    // negative Anpassung und Rundung: 10,00 € für 3, c −1,00 € → Rest 11,00 € → 3,67/3,67/3,66, c 2,66
    const r = computeShares(1000, { type: "adjust", entries: [{ id: "c", adjust: -100 }, { id: "a", adjust: 0 }, { id: "b", adjust: 0 }] });
    expect(r).toEqual([
      { id: "a", amount: 367 },
      { id: "b", amount: 367 },
      { id: "c", amount: 266 },
    ]);
    expect(r.reduce((x, y) => x + y.amount, 0)).toBe(1000);
  });
  it("lehnt zu hohe Anpassungen und negative Anteile ab", () => {
    expect(() => computeShares(1000, { type: "adjust", entries: [{ id: "a", adjust: 1100 }, { id: "b", adjust: 0 }] })).toThrow("adjust_sum");
    expect(() => computeShares(1000, { type: "adjust", entries: [{ id: "a", adjust: -1200 }, { id: "b", adjust: 0 }] })).toThrow("adjust_sum");
    expect(() => computeShares(1000, { type: "adjust", entries: [{ id: "a", adjust: 0 }, { id: "a", adjust: 0 }] })).toThrow("duplicate_participant");
  });
});

describe("Rest-Cent geht an den Zahler", () => {
  const sum = (a: { amount: number }[]) => a.reduce((s, x) => s + x.amount, 0);
  it("gleich: 10,00 € auf drei, Zahler trägt den Cent", () => {
    expect(computeShares(1000, { type: "equal", participants: ["a", "b", "c"] }, "c")).toEqual([
      { id: "a", amount: 333 },
      { id: "b", amount: 333 },
      { id: "c", amount: 334 },
    ]);
    // ohne Zahler: wie bisher nach ID
    expect(computeShares(1000, { type: "equal", participants: ["a", "b", "c"] })[0]).toEqual({ id: "a", amount: 334 });
  });
  it("zwei Rest-Cents: Zahler bekommt einen, der zweite geht nach der Regel weiter (nie 2 Cent für eine Person)", () => {
    const r = computeShares(200, { type: "equal", participants: ["a", "b", "c"] }, "c");
    expect(r).toEqual([
      { id: "a", amount: 67 },
      { id: "b", amount: 66 },
      { id: "c", amount: 67 },
    ]);
  });
  it("glatt teilbar: Zahler bekommt nichts extra", () => {
    expect(computeShares(900, { type: "equal", participants: ["a", "b", "c"] }, "b").map((x) => x.amount)).toEqual([300, 300, 300]);
  });
  it("Zahler nicht beteiligt: Regel unverändert", () => {
    expect(computeShares(1000, { type: "equal", participants: ["a", "b"] }, "z").map((x) => x.amount)).toEqual([500, 500]);
    expect(computeShares(1001, { type: "equal", participants: ["a", "b"] }, "z").map((x) => x.amount)).toEqual([501, 500]);
  });
  it("Prozent, Anteile, Anpassungen, Einzelposten: Zahler zuerst, Summe stimmt, jede Person < 1 Cent neben exakt", () => {
    const pct = computeShares(1000, { type: "percent", entries: [{ id: "a", bp: 3333 }, { id: "b", bp: 3333 }, { id: "c", bp: 3334 }] }, "a");
    expect(sum(pct)).toBe(1000);
    expect(pct.find((x) => x.id === "a")!.amount).toBe(334); // exakt 333,3 → Zahler bekommt den Cent
    const sh = computeShares(1000, { type: "shares", entries: [{ id: "a", shares: 1 }, { id: "b", shares: 1 }, { id: "c", shares: 1 }] }, "b");
    expect(sh.map((x) => x.amount)).toEqual([333, 334, 333]);
    const adj = computeShares(1100, { type: "adjust", entries: [{ id: "a", adjust: 100 }, { id: "b", adjust: 0 }, { id: "c", adjust: 0 }] }, "c");
    expect(adj.map((x) => x.amount)).toEqual([433, 333, 334]);
    const it = computeShares(1000, { type: "items", items: [{ name: "x", amount: 1000, participants: ["a", "b", "c"] }], tax: 0, tip: 0 }, "b");
    expect(it.map((x) => x.amount)).toEqual([333, 334, 333]);
  });
  it("mainPayer: größter Betrag, bei Gleichstand kleinere ID", () => {
    expect(mainPayer([{ id: "b", amount: 500 }, { id: "a", amount: 300 }])).toBe("b");
    expect(mainPayer([{ id: "b", amount: 400 }, { id: "a", amount: 400 }])).toBe("a");
    expect(mainPayer([])).toBeUndefined();
  });
});
