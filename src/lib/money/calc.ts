/**
 * Kleiner Rechner für Betragsfelder (rein, ohne eval): + − * / und Klammern, Dezimalkomma oder -punkt.
 * Exakt mit Brüchen (BigInt), am Ende kaufmännisch auf die Nachkommastellen der Währung gerundet.
 * Liefert Minor-Units oder `null` bei ungültiger Eingabe, Division durch null oder negativem Ergebnis.
 */
type Frac = { n: bigint; d: bigint };

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
function norm(f: Frac): Frac {
  if (f.d < 0n) f = { n: -f.n, d: -f.d };
  const g = gcd(f.n, f.d) || 1n;
  return { n: f.n / g, d: f.d / g };
}

/** Enthält die Eingabe eine Rechenoperation (nicht nur ein Vorzeichen am Anfang)? */
export function isExpression(input: string): boolean {
  return /[+*/×÷()]|.-/.test(input.replace(/\s+/g, "").replace(/^[+-]/, "").replace(/^-/, ""));
}

export function evaluateAmount(input: string, fractionDigits: number): number | null {
  const s = input.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  if (!s || s.length > 200) return null;
  let i = 0;
  const peek = () => s[i];

  function number(): Frac | null {
    const m = /^\d+(?:[.,]\d+)?|^[.,]\d+/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    const [int, frac = ""] = m[0].replace(",", ".").split(".");
    return norm({ n: BigInt((int || "0") + frac), d: 10n ** BigInt(frac.length) });
  }
  function factor(): Frac | null {
    if (peek() === "-") {
      i++;
      const f = factor();
      return f && { n: -f.n, d: f.d };
    }
    if (peek() === "+") {
      i++;
      return factor();
    }
    if (peek() === "(") {
      i++;
      const v = expr();
      if (!v || peek() !== ")") return null;
      i++;
      return v;
    }
    return number();
  }
  function term(): Frac | null {
    let v = factor();
    while (v && (peek() === "*" || peek() === "/")) {
      const op = s[i++];
      const r = factor();
      if (!r) return null;
      if (op === "/" && r.n === 0n) return null;
      v = norm(op === "*" ? { n: v.n * r.n, d: v.d * r.d } : { n: v.n * r.d, d: v.d * r.n });
    }
    return v;
  }
  function expr(): Frac | null {
    let v = term();
    while (v && (peek() === "+" || peek() === "-")) {
      const op = s[i++];
      const r = term();
      if (!r) return null;
      v = norm({ n: op === "+" ? v.n * r.d + r.n * v.d : v.n * r.d - r.n * v.d, d: v.d * r.d });
    }
    return v;
  }

  const v = expr();
  if (!v || i !== s.length) return null;
  // auf Minor-Units runden (halb auf: 0,005 → 0,01)
  const scaled = v.n * 10n ** BigInt(fractionDigits);
  if (scaled < 0n) return null;
  const q = scaled / v.d;
  const r = scaled % v.d;
  const minor = q + (2n * r >= v.d ? 1n : 0n);
  return minor > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(minor);
}
