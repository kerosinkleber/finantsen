import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint, safeNext } from "./safe-next";

describe("safeNext (keine offene Weiterleitung)", () => {
  it("lässt interne Pfade durch", () => {
    expect(safeNext("/groups/1?tab=balances")).toBe("/groups/1?tab=balances");
    expect(safeNext("/join/abc")).toBe("/join/abc");
  });
  it("blockt alles, was auf fremde Seiten führt", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", undefined, null, "/\nevil", "javascript:alert(1)"]) expect(safeNext(bad)).toBe("/");
  });
});

describe("isAllowedPushEndpoint (kein SSRF)", () => {
  it("nur bekannte Push-Dienste über HTTPS", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
    for (const bad of ["http://fcm.googleapis.com/x", "https://db:5432/", "http://169.254.169.254/latest", "https://evil.com/googleapis.com", "https://googleapis.com.evil.com/", "https://fcm.googleapis.com:8443/x", "nonsense"])
      expect(isAllowedPushEndpoint(bad)).toBe(false);
  });
});
