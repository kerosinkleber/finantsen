import { describe, expect, it } from "vitest";
import { dueOccurrences, isIsoDate, occurrence } from "./recurrence";

describe("recurrence", () => {
  it("monatlich: Tag bleibt, kurze Monate nehmen den letzten Tag, danach wieder der 31.", () => {
    const d = (i: number) => occurrence("2026-01-31", "month", 1, i);
    expect([d(0), d(1), d(2), d(3), d(4)]).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
    expect(occurrence("2028-01-31", "month", 1, 1)).toBe("2028-02-29"); // Schaltjahr
  });
  it("jährlich: 29.2. wird in Nichtschaltjahren 28.2.", () => {
    expect([0, 1, 2, 3, 4].map((i) => occurrence("2024-02-29", "year", 1, i))).toEqual(["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  });
  it("frei einstellbar: alle 2 Wochen, alle 3 Monate, alle 10 Tage", () => {
    expect(occurrence("2026-01-01", "week", 2, 3)).toBe("2026-02-12");
    expect(occurrence("2026-01-15", "month", 3, 2)).toBe("2026-07-15");
    expect(occurrence("2026-12-25", "day", 10, 2)).toBe("2027-01-14");
    expect(occurrence("2026-11-30", "month", 3, 1)).toBe("2027-02-28"); // Jahreswechsel
  });
  it("dueOccurrences: bis heute, Enddatum begrenzt, Limit schützt", () => {
    const base = { start: "2026-01-01", unit: "month" as const, every: 1, from: 0 };
    expect(dueOccurrences({ ...base, until: "2026-03-15" }).map((x) => x.date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(dueOccurrences({ ...base, until: "2026-12-31", end: "2026-02-15" }).map((x) => x.date)).toEqual(["2026-01-01", "2026-02-01"]);
    expect(dueOccurrences({ ...base, from: 2, until: "2026-03-15" }).map((x) => x.index)).toEqual([2]);
    expect(dueOccurrences({ start: "2000-01-01", unit: "day", every: 1, from: 0, until: "2026-01-01", limit: 5 })).toHaveLength(5);
    expect(dueOccurrences({ ...base, until: "2025-12-31" })).toEqual([]);
  });
  it("isIsoDate", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-02-01")).toBe(false);
  });
});
