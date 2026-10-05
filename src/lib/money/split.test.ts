import { describe, expect, it } from "vitest";
import { computeShares } from "./split";

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
