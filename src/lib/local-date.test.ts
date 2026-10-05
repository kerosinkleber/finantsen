import { describe, expect, it } from "vitest";
import { localToday } from "./local-date";

describe("localToday", () => {
  it("nimmt das Datum der Gerätezeit, nicht UTC", () => {
    expect(localToday(new Date(2026, 0, 5, 0, 30))).toBe("2026-01-05");
    expect(localToday(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});
