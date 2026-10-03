import { describe, expect, it } from "vitest";
import de from "./de";
import en from "./en";
import { translate } from "./index";

describe("i18n", () => {
  it("de und en haben dieselben Schlüssel", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });
  it("ersetzt Parameter", () => {
    expect(translate("en", "balances.owes", { from: "A", to: "B", amount: "1 €" })).toBe("A owes B 1 €");
  });
});
