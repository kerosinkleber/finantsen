/**
 * Passwortrichtlinie (Client und Server nutzen dieselbe Funktion):
 * mindestens 20 Zeichen, mindestens ein Groß- und ein Kleinbuchstabe, eine Ziffer, ein Sonderzeichen
 * (alles, was weder Buchstabe noch Ziffer ist, inkl. Leerzeichen), und das Passwort enthält weder
 * den Nutzernamen noch die E-Mail-Adresse. Länge wird in Unicode-Zeichen gezählt.
 */

export const PASSWORD_MIN_LENGTH = 20;
export const PASSWORD_MAX_LENGTH = 200;

export type PasswordIssue = "too_short" | "too_long" | "no_upper" | "no_lower" | "no_digit" | "no_special" | "contains_identity";

export const PASSWORD_ISSUES: PasswordIssue[] = ["too_short", "no_upper", "no_lower", "no_digit", "no_special", "contains_identity"];

export function passwordIssues(pw: string, identity: { username?: string | null; email?: string | null } = {}): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  const len = Array.from(pw).length;
  if (len < PASSWORD_MIN_LENGTH) issues.push("too_short");
  if (len > PASSWORD_MAX_LENGTH) issues.push("too_long");
  if (!/\p{Lu}/u.test(pw)) issues.push("no_upper");
  if (!/\p{Ll}/u.test(pw)) issues.push("no_lower");
  if (!/\p{N}/u.test(pw)) issues.push("no_digit");
  if (!/[^\p{L}\p{N}]/u.test(pw)) issues.push("no_special");
  const lower = pw.toLowerCase();
  const needles: string[] = [];
  const u = identity.username?.trim().toLowerCase();
  if (u && u.length >= 3) needles.push(u);
  const e = identity.email?.trim().toLowerCase();
  if (e) {
    needles.push(e);
    const local = e.split("@")[0];
    if (local.length >= 3) needles.push(local);
  }
  if (needles.some((n) => lower.includes(n))) issues.push("contains_identity");
  return issues;
}

export const isPasswordValid = (pw: string, identity?: { username?: string | null; email?: string | null }) =>
  passwordIssues(pw, identity).length === 0;
