import { describe, expect, it } from "vitest";
import { feedPage, parsePage, parsePageSize, type FeedKey } from "./paging";

const e = (id: string, date: string, at = 0): FeedKey => ({ kind: "e", id, date, at });
const p = (id: string, date: string, at = 0): FeedKey => ({ kind: "p", id, date, at });

describe("paging", () => {
  it("parst Seitengröße und Seite robust", () => {
    expect(parsePageSize(undefined)).toBe(50);
    expect(parsePageSize("100")).toBe(100);
    expect(parsePageSize("1000")).toBe(50);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("2.7")).toBe(2);
    expect(parsePage("9999999999")).toBe(1_000_000);
  });

  it("mischt Ausgaben und Zahlungen nach Datum, Anlagezeit und ID", () => {
    const exp = [e("e3", "2026-03-01"), e("e2", "2026-02-01", 5), e("e1", "2026-02-01", 1)];
    const pay = [p("p1", "2026-02-01", 3), p("p0", "2026-01-01")];
    const r = feedPage(exp, pay, 5, 1, 50);
    expect(r.items.map((x) => x.id)).toEqual(["e3", "e2", "p1", "e1", "p0"]);
    expect(r).toMatchObject({ page: 1, pages: 1 });
  });

  it("schneidet die richtige Seite heraus und begrenzt auf die letzte Seite", () => {
    const exp = Array.from({ length: 120 }, (_, i) => e(`e${String(i).padStart(3, "0")}`, `2026-01-01`, 1000 - i));
    const r2 = feedPage(exp, [], 120, 2, 50);
    expect(r2.items[0].id).toBe("e050");
    expect(r2.items).toHaveLength(50);
    expect(r2.pages).toBe(3);
    const last = feedPage(exp, [], 120, 99, 50);
    expect(last.page).toBe(3);
    expect(last.items.map((x) => x.id)).toEqual(exp.slice(100).map((x) => x.id));
    expect(feedPage([], [], 0, 1, 50)).toMatchObject({ items: [], page: 1, pages: 1 });
  });
});
