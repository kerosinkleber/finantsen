import { describe, expect, it } from "vitest";
import { fromNets, parseCsv, parseDate, parseDecimal, parseImport, type ParsedImport } from "./import";

const ok = (text: string) => {
  const r = parseImport(text);
  if ("error" in r) throw new Error(r.error);
  return r as ParsedImport;
};

describe("Import: Grundlagen", () => {
  it("CSV mit Anführungszeichen, BOM, Semikolon, Schutz-Hochkomma", () => {
    expect(parseCsv('﻿a;b;c\r\n"x;y";"he said ""hi""";\'=1+1\r\n\r\n')).toEqual([["a", "b", "c"], ["x;y", 'he said "hi"', "=1+1"]]);
    expect(parseCsv("a,b\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("Beträge und Daten", () => {
    expect(parseDecimal("12.50", "EUR")).toBe(1250);
    expect(parseDecimal("12,5", "EUR")).toBe(1250);
    expect(parseDecimal("1.234,56", "EUR")).toBe(123456);
    expect(parseDecimal("1,234.56", "USD")).toBe(123456);
    expect(parseDecimal("-3.00", "EUR")).toBe(-300);
    expect(parseDecimal("1500", "JPY")).toBe(1500);
    expect(parseDecimal("1.005", "EUR")).toBe(100500); // Tausendertrenner
    expect(parseDecimal("12.345", "EUR")).toBe(1234500);
    expect(parseDecimal("abc", "EUR")).toBeNull();
    expect(parseDecimal("", "EUR")).toBe(0);
    expect(parseDate("2024-01-15")).toBe("2024-01-15");
    expect(parseDate("2024-01-15 13:45:00")).toBe("2024-01-15");
    expect(parseDate("5.1.2024")).toBe("2024-01-05");
    expect(parseDate("31/02/2024")).toBeNull();
  });
  it("aus Netto-Werten exakte Zahler und Anteile (Salden bleiben gleich)", () => {
    // Anna zahlt 30 für alle drei
    expect(fromNets(3000, [{ name: "Anna", net: 2000 }, { name: "Ben", net: -1000 }, { name: "Cleo", net: -1000 }])).toEqual({
      payers: [{ name: "Anna", amountMinor: 3000 }],
      shares: [{ name: "Ben", amountMinor: 1000 }, { name: "Cleo", amountMinor: 1000 }, { name: "Anna", amountMinor: 1000 }],
    });
    // Anna zahlt 10 nur für Ben
    expect(fromNets(1000, [{ name: "Anna", net: 1000 }, { name: "Ben", net: -1000 }])).toEqual({ payers: [{ name: "Anna", amountMinor: 1000 }], shares: [{ name: "Ben", amountMinor: 1000 }] });
    expect(fromNets(1000, [{ name: "Anna", net: 500 }, { name: "Ben", net: -400 }])).toBeNull();
  });
});

describe("Import: Formate", () => {
  it("Splitwise", () => {
    const csv = [
      "Date,Description,Category,Cost,Currency,Anna Muster,Ben,Cleo",
      "2024-01-15,Groceries,Groceries,30.00,EUR,20.00,-10.00,-10.00",
      "2024-01-16,Ben paid Anna,Payment,10.00,EUR,-10.00,10.00,0.00",
      "2024-01-17,Bad,General,5.00,EUR,5.00,-4.00,0",
      "",
      "2024-01-20,Total balance, , ,EUR,10.00,0.00,-10.00",
    ].join("\n");
    const r = ok(csv);
    expect(r.format).toBe("splitwise");
    expect(r.people).toEqual(["Anna Muster", "Ben", "Cleo"]);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]).toMatchObject({ kind: "expense", date: "2024-01-15", title: "Groceries", amountMinor: 3000, payers: [{ name: "Anna Muster", amountMinor: 3000 }] });
    expect(r.entries[1]).toMatchObject({ kind: "payment", from: "Ben", to: "Anna Muster", amountMinor: 1000 });
    expect(r.errors).toEqual([{ line: 4, code: "sum_mismatch" }]);
  });
  it("Tricount (Paid by / Paid for)", () => {
    const csv = [
      "Title;Amount;Currency;Date;Transaction type;Paid by Pierre;Paid by Sophie;Paid for Pierre;Paid for Sophie",
      "Groceries;20,00;EUR;12/03/2024;Expense;20,00;0,00;5,00;15,00",
      "Refund;10,00;EUR;13/03/2024;Money transfer;0,00;10,00;10,00;0,00",
    ].join("\n");
    const r = ok(csv);
    expect(r.format).toBe("tricount");
    expect(r.entries[0]).toMatchObject({ kind: "expense", date: "2024-03-12", amountMinor: 2000, payers: [{ name: "Pierre", amountMinor: 2000 }], shares: [{ name: "Pierre", amountMinor: 500 }, { name: "Sophie", amountMinor: 1500 }] });
    expect(r.entries[1]).toMatchObject({ kind: "payment", from: "Sophie", to: "Pierre", amountMinor: 1000 });
  });
  it("eigener Export (deutsch) wird wieder eingelesen, Kennzeichnungen entfernt", () => {
    const csv = [
      "﻿Art;Datum;Titel;Kategorie;Betrag;Währung;Betrag (Abrechnung);Abrechnungswährung;Anna bezahlt;Anna Anteil;Gast (Gast) bezahlt;Gast (Gast) Anteil",
      "Ausgabe;2026-01-02;Pizza;Restaurant;30,00;EUR;30,00;EUR;30,00;15,00;;15,00",
      "Zahlung;2026-01-03;Gast → Anna;;15,00;EUR;15,00;EUR;;15,00;15,00;",
      "Saldo;;;;;;;EUR;0,00;;0,00;",
    ].join("\r\n");
    const r = ok(csv);
    expect(r.format).toBe("finantsen");
    expect(r.people).toEqual(["Anna", "Gast"]);
    expect(r.entries[0]).toMatchObject({ kind: "expense", amountMinor: 3000, shares: [{ name: "Anna", amountMinor: 1500 }, { name: "Gast", amountMinor: 1500 }] });
    expect(r.entries[1]).toMatchObject({ kind: "payment", from: "Gast", to: "Anna", amountMinor: 1500 });
  });
  it("einfaches Format", () => {
    const r = ok("date,title,amount,currency,paid_by,split_between,category\n2026-02-01,Taxi,10.00,EUR,Anna,Anna|Ben|Cleo,transport");
    expect(r.entries[0]).toMatchObject({ amountMinor: 1000, payers: [{ name: "Anna", amountMinor: 1000 }], category: "transport" });
    expect((r.entries[0] as { shares: { amountMinor: number }[] }).shares.map((s) => s.amountMinor)).toEqual([334, 333, 333]);
  });
  it("unbekannt oder leer", () => {
    expect(parseImport("foo,bar\n1,2")).toEqual({ error: "unknown_format" });
    expect(parseImport("")).toEqual({ error: "empty" });
  });
});
