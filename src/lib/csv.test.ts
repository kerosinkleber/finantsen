import { describe, expect, it } from "vitest";
import { csvCell, decimal, toCsv } from "./csv";

describe("csv", () => {
  it("quotet Trennzeichen, Anführungszeichen und Zeilenumbrüche", () => {
    expect(csvCell("a;b", ";")).toBe('"a;b"');
    expect(csvCell("a,b", ";")).toBe("a,b");
    expect(csvCell('sag "hi"', ",")).toBe('"sag ""hi"""');
    expect(csvCell("x\ny", ",")).toBe('"x\ny"');
  });
  it("entschärft Formeln, lässt Zahlen in Ruhe", () => {
    expect(csvCell("=HYPERLINK(1)", ";")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@cmd", ";")).toBe("'@cmd");
    expect(csvCell("-12,50", ";")).toBe("-12,50");
    expect(csvCell(-5, ";")).toBe("-5");
    expect(csvCell("-x", ";")).toBe("'-x");
  });
  it("Dezimalformat je Sprache und Nachkommastellen", () => {
    expect(decimal(1250, 2, ";")).toBe("12,50");
    expect(decimal(-5, 2, ",")).toBe("-0.05");
    expect(decimal(1500, 0, ";")).toBe("1500");
    expect(decimal(1234, 3, ",")).toBe("1.234");
  });
  it("Datei mit BOM und CRLF", () => {
    expect(toCsv([["a", 1], ["b", 2]], ";")).toBe("﻿a;1\r\nb;2\r\n");
  });
});
