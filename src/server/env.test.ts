import { describe, expect, it } from "vitest";
import { devAdminStartError, isLocalAppUrl } from "./env";

describe("Startsperre Dev-Admin", () => {
  it("erkennt lokale Adressen", () => {
    for (const u of ["http://localhost:3000", "http://LOCALHOST", "http://127.0.0.1:3099", "http://[::1]:3000", "http://app.localhost"]) expect(isLocalAppUrl(u)).toBe(true);
    for (const u of ["http://192.168.178.20:3000", "https://finantsen.example.org", "http://localhost.example.org", "http://127.0.0.2", "kaputt"]) expect(isLocalAppUrl(u)).toBe(false);
  });

  it("sperrt nur DEV_ADMIN=true außerhalb von localhost", () => {
    expect(devAdminStartError("true", "http://localhost:3000")).toBeNull();
    expect(devAdminStartError(undefined, "http://192.168.178.20:3000")).toBeNull();
    expect(devAdminStartError("false", "https://finantsen.example.org")).toBeNull();
    expect(devAdminStartError("true", "http://192.168.178.20:3000")).toContain("nur für lokale Tests");
  });
});
