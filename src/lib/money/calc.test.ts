import { describe, expect, it } from "vitest";
import { evaluateAmount, isExpression } from "./calc";

describe("Rechner im Betragsfeld", () => {
  it("rechnet exakt und rundet kaufmännisch", () => {
    expect(evaluateAmount("12,50+3*4", 2)).toBe(2450);
    expect(evaluateAmount("12.50 + 3 × 4", 2)).toBe(2450);
    expect(evaluateAmount("(10+5)/3", 2)).toBe(500);
    expect(evaluateAmount("10/3", 2)).toBe(333);
    expect(evaluateAmount("0,005*1", 2)).toBe(1);
    expect(evaluateAmount("100-20,5", 2)).toBe(7950);
    expect(evaluateAmount("1000/3", 0)).toBe(333);
    expect(evaluateAmount("-5+10", 2)).toBe(500);
    expect(evaluateAmount("23,5", 2)).toBe(2350);
  });
  it("lehnt Unsinn ab", () => {
    for (const bad of ["", "abc", "1/0", "2*(3", "1++", "5-10", "1;2", "alert(1)", "1e5"]) expect(evaluateAmount(bad, 2)).toBeNull();
  });
  it("erkennt Rechenausdrücke", () => {
    expect(isExpression("12,50")).toBe(false);
    expect(isExpression("-3")).toBe(false);
    expect(isExpression("12+3")).toBe(true);
    expect(isExpression("10-2")).toBe(true);
    expect(isExpression("3*4")).toBe(true);
  });
});
