import { describe, expect, it } from "vitest";
import { replaceUserInSplit, replaceUserInTemplate } from "./merge";

describe("Gast durch Konto ersetzen", () => {
  it("fasst doppelte Zahler und Prozente zusammen", () => {
    const t = replaceUserInTemplate(
      { title: "x", payers: [{ userId: "g", amountMinor: 300 }, { userId: "a", amountMinor: 700 }], split: { type: "percent", entries: [{ userId: "a", bp: 6000 }, { userId: "g", bp: 4000 }] } },
      "g",
      "a",
    );
    expect(t.payers).toEqual([{ userId: "a", amountMinor: 1000 }]);
    expect(t.split).toEqual({ type: "percent", entries: [{ userId: "a", bp: 10000 }] });
    expect(t.title).toBe("x");
  });
  it("gleichmäßig, Gewichte, fest, eine Person, Einzelposten", () => {
    expect(replaceUserInSplit({ type: "equal", participants: ["a", "g", "b"] }, "g", "a")).toEqual({ type: "equal", participants: ["a", "b"] });
    expect(replaceUserInSplit({ type: "shares", entries: [{ userId: "g", shares: 2 }, { userId: "b", shares: 1 }] }, "g", "c")).toEqual({ type: "shares", entries: [{ userId: "c", shares: 2 }, { userId: "b", shares: 1 }] });
    expect(replaceUserInSplit({ type: "exact", entries: [{ userId: "g", amountMinor: 5 }, { userId: "a", amountMinor: 5 }] }, "g", "a")).toEqual({ type: "exact", entries: [{ userId: "a", amountMinor: 10 }] });
    expect(replaceUserInSplit({ type: "full", owner: "g" }, "g", "a")).toEqual({ type: "full", owner: "a" });
    expect(replaceUserInSplit({ type: "items", items: [{ name: "p", amountMinor: 1, participants: ["g", "a"] }], taxMinor: 0, tipMinor: 0 }, "g", "a")).toEqual({ type: "items", items: [{ name: "p", amountMinor: 1, participants: ["a"] }], taxMinor: 0, tipMinor: 0 });
  });
});
