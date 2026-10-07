import { describe, expect, it } from "vitest";
import { isPasswordValid, passwordIssues } from "./password";

const GOOD = "Correct-Horse-Battery-9!";

describe("Passwortrichtlinie", () => {
  it("akzeptiert ein gültiges Passwort", () => {
    expect(passwordIssues(GOOD)).toEqual([]);
    expect(isPasswordValid(GOOD)).toBe(true);
  });
  it("Länge: genau 20 Zeichen ok, 19 nicht", () => {
    expect(passwordIssues("Abcdefghijklmnopq1!x")).toEqual([]); // 20
    expect(passwordIssues("Abcdefghijklmnop1!x")).toEqual(["too_short"]); // 19
  });
  it("meldet jede fehlende Klasse einzeln", () => {
    expect(passwordIssues("abcdefghijklmnopqrstuv1!")).toEqual(["no_upper"]);
    expect(passwordIssues("ABCDEFGHIJKLMNOPQRSTUV1!")).toEqual(["no_lower"]);
    expect(passwordIssues("Abcdefghijklmnopqrstuv!!")).toEqual(["no_digit"]);
    expect(passwordIssues("Abcdefghijklmnopqrstuv11")).toEqual(["no_special"]);
  });
  it("Leerzeichen zählt als Sonderzeichen (Passphrasen)", () => {
    expect(passwordIssues("Pferd Lampe Wolke Tisch 7")).toEqual([]);
  });
  it("Unicode: Umlaute zählen als Buchstaben, Länge nach Zeichen", () => {
    expect(passwordIssues("Überraschung-Größe-Maß-5")).toEqual([]);
    expect(passwordIssues("Ä1!" + "ä".repeat(17))).toEqual([]); // 20 Zeichen
    expect(passwordIssues("😀".repeat(10) + "Aa1!aaaaaa")).toEqual([]);
  });
  it("höchstens 200 Zeichen", () => {
    expect(passwordIssues("Aa1!" + "x".repeat(197))).toEqual(["too_long"]);
    expect(passwordIssues("Aa1!" + "x".repeat(196))).toEqual([]);
  });
  it("darf Nutzername oder E-Mail nicht enthalten (ohne Groß-/Kleinschreibung)", () => {
    expect(passwordIssues("Xx-MaxMustermann-Xx-9!x", { username: "maxmustermann" })).toEqual(["contains_identity"]);
    expect(passwordIssues("Pw-max.muster@example.com-9X", { email: "Max.Muster@Example.com" })).toEqual(["contains_identity"]);
    expect(passwordIssues("Pw-maxmuster-Pw-Pw-Pw-9!", { email: "maxmuster@example.com" })).toEqual(["contains_identity"]);
  });
  it("kurze Nutzernamen (<3) werden nicht geprüft", () => {
    expect(passwordIssues(GOOD, { username: "ab" })).toEqual([]);
    expect(passwordIssues(GOOD, { username: null, email: null })).toEqual([]);
  });
});
