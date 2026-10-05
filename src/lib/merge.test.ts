import { describe, expect, it } from "vitest";
import { replaceUserInDefaultSplit, replaceUserInSplit, replaceUserInTemplate } from "./merge";
import { computeShares } from "./money/split";

describe("Gast durch Konto ersetzen", () => {
  it("fasst doppelte Zahler und Prozente zusammen", () => {
    const t = replaceUserInTemplate(
      { title: "x", amountMinor: 1000, payers: [{ userId: "g", amountMinor: 300 }, { userId: "a", amountMinor: 700 }], split: { type: "percent", entries: [{ userId: "a", bp: 6000 }, { userId: "g", bp: 4000 }] } },
      "g",
      "a",
    );
    expect(t.payers).toEqual([{ userId: "a", amountMinor: 1000 }]);
    expect(t.split).toEqual({ type: "percent", entries: [{ userId: "a", bp: 10000 }] });
    expect(t.title).toBe("x");
  });
  it("gleichmäßig, Gewichte, fest, eine Person, Einzelposten", () => {
    // beide beteiligt: „gleichmäßig“ wird zu Anteilen, damit a das trägt, was vorher a und g zusammen trugen
    expect(replaceUserInSplit({ type: "equal", participants: ["a", "g", "b"] }, "g", "a")).toEqual({ type: "shares", entries: [{ userId: "a", shares: 2 }, { userId: "b", shares: 1 }] });
    expect(replaceUserInSplit({ type: "equal", participants: ["g", "b"] }, "g", "c")).toEqual({ type: "equal", participants: ["c", "b"] });
    expect(replaceUserInSplit({ type: "shares", entries: [{ userId: "g", shares: 2 }, { userId: "b", shares: 1 }] }, "g", "c")).toEqual({ type: "shares", entries: [{ userId: "c", shares: 2 }, { userId: "b", shares: 1 }] });
    expect(replaceUserInSplit({ type: "exact", entries: [{ userId: "g", amountMinor: 5 }, { userId: "a", amountMinor: 5 }] }, "g", "a")).toEqual({ type: "exact", entries: [{ userId: "a", amountMinor: 10 }] });
    expect(replaceUserInSplit({ type: "full", owner: "g" }, "g", "a")).toEqual({ type: "full", owner: "a" });
    expect(replaceUserInSplit({ type: "items", items: [{ name: "p", amountMinor: 1, participants: ["g", "b"] }], taxMinor: 0, tipMinor: 0 }, "g", "a", 1)).toEqual({ type: "items", items: [{ name: "p", amountMinor: 1, participants: ["a", "b"] }], taxMinor: 0, tipMinor: 0 });
  });
  it("Summen bleiben gleich: Einzelposten mit beiden werden feste Beträge, Anteile wie vorher zusammen", () => {
    const split = { type: "items" as const, items: [{ name: "Pizza", amountMinor: 900, participants: ["a", "g", "b"] }, { name: "Wein", amountMinor: 101, participants: ["g"] }], taxMinor: 0, tipMinor: 0 };
    const before = computeShares(1001, { type: "items", items: split.items.map((i) => ({ name: i.name, amount: i.amountMinor, participants: i.participants })), tax: 0, tip: 0 });
    const r = replaceUserInSplit(split, "g", "a", 1001);
    expect(r.type).toBe("exact");
    const get = (id: string) => before.filter((x) => x.id === id).reduce((s, x) => s + x.amount, 0);
    expect(r).toEqual({ type: "exact", entries: expect.arrayContaining([{ userId: "a", amountMinor: get("a") + get("g") }, { userId: "b", amountMinor: get("b") }]) });
    const t = replaceUserInTemplate({ amountMinor: 300, payers: [{ userId: "x", amountMinor: 300 }], split: { type: "equal", participants: ["x", "g", "a"] } }, "g", "a");
    const shares = computeShares(300, { type: "shares", entries: (t.split as unknown as { entries: { userId: string; shares: number }[] }).entries.map((e) => ({ id: e.userId, shares: e.shares })) });
    expect(shares.find((s) => s.id === "a")?.amount).toBe(200);
  });
  it("Standard-Aufteilung der Gruppe", () => {
    expect(replaceUserInDefaultSplit({ type: "percent", entries: [{ userId: "g", value: 3000 }, { userId: "a", value: 7000 }] }, "g", "a")).toEqual({ type: "percent", entries: [{ userId: "a", value: 10000 }] });
    expect(replaceUserInDefaultSplit({ type: "equal", entries: [{ userId: "g", value: 0 }, { userId: "a", value: 0 }, { userId: "b", value: 0 }] }, "g", "a")).toEqual({ type: "shares", entries: [{ userId: "a", value: 2 }, { userId: "b", value: 1 }] });
  });
});

describe("gleich mit Anpassungen beim Verknüpfen eines Gasts", () => {
  it("nur der Gast: Anpassung wandert mit; beide beteiligt: feste Beträge mit gleicher Summe", () => {
    expect(replaceUserInSplit({ type: "adjust", entries: [{ userId: "g", adjustMinor: 500 }, { userId: "b", adjustMinor: 0 }] }, "g", "a")).toEqual({
      type: "adjust",
      entries: [{ userId: "a", adjustMinor: 500 }, { userId: "b", adjustMinor: 0 }],
    });
    const merged = replaceUserInSplit({ type: "adjust", entries: [{ userId: "a", adjustMinor: 100 }, { userId: "g", adjustMinor: 0 }, { userId: "b", adjustMinor: 0 }] }, "g", "a", 3100);
    // 3100 − 100 = 3000 → je 1000; a 1100 + g 1000 = 2100, b 1000
    expect(merged).toEqual({ type: "exact", entries: [{ userId: "a", amountMinor: 2100 }, { userId: "b", amountMinor: 1000 }] });
  });
});
