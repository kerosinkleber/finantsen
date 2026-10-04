/**
 * Aufteilung von Beträgen. Alle Funktionen sind rein, arbeiten mit Ganzzahlen (Minor-Units)
 * und garantieren: Summe der Anteile == Gesamtbetrag.
 */

export class SplitError extends Error {
  constructor(
    public code:
      | "no_participants"
      | "duplicate_participant"
      | "invalid_weight"
      | "percent_sum"
      | "exact_sum"
      | "payer_sum"
      | "items_sum"
      | "invalid_amount",
    message?: string,
  ) {
    super(message ? `${code}: ${message}` : code);
    this.name = "SplitError";
  }
}

export type SplitInput =
  | { type: "equal"; participants: string[] }
  | { type: "percent"; entries: { id: string; bp: number }[] } // bp = Basispunkte, 10000 = 100 %
  | { type: "exact"; entries: { id: string; amount: number }[] }
  | { type: "shares"; entries: { id: string; shares: number }[] }
  | { type: "full"; owner: string } // eine Person trägt alles
  | { type: "items"; items: ItemInput[]; tax: number; tip: number }; // Einzelposten + Steuer/Trinkgeld

export type ItemInput = { name: string; amount: number; participants: string[] };

export type Allocation = { id: string; amount: number };

export const PERCENT_TOTAL_BP = 10000;

/**
 * Largest-Remainder-Verfahren: verteilt `total` proportional zu `weights`.
 * Restcents gehen an die größten Nachkommareste; bei Gleichstand an den kleineren Index.
 * Deterministisch, Summe == total. Unterstützt negative Totale.
 */
export function allocate(total: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(total)) throw new SplitError("invalid_amount");
  if (weights.length === 0) throw new SplitError("no_participants");
  for (const w of weights) {
    if (!Number.isSafeInteger(w) || w < 0) throw new SplitError("invalid_weight");
  }
  return allocateExact(total, weights.map((w) => BigInt(w)));
}

/** Wie `allocate`, aber mit beliebig großen (exakten) BigInt-Gewichten. */
function allocateExact(total: number, weights: bigint[]): number[] {
  const sumW = weights.reduce((a, b) => a + b, 0n);
  if (sumW === 0n) throw new SplitError("invalid_weight", "weights sum to zero");

  const sign = total < 0 ? -1n : 1n;
  const abs = (total < 0 ? -BigInt(total) : BigInt(total)) as bigint;
  const base: bigint[] = [];
  const rem: bigint[] = [];
  let assigned = 0n;
  for (const w of weights) {
    const prod = abs * w;
    const q = prod / sumW;
    base.push(q);
    rem.push(prod % sumW);
    assigned += q;
  }
  const left = Number(abs - assigned);
  const order = weights
    .map((_, i) => i)
    .filter((i) => weights[i] > 0n)
    .sort((a, b) => (rem[a] === rem[b] ? a - b : rem[a] > rem[b] ? -1 : 1));
  for (let k = 0; k < left; k++) base[order[k % order.length]] += 1n;
  return base.map((x) => Number(x * sign));
}

function assertUnique(ids: string[]) {
  if (ids.length === 0) throw new SplitError("no_participants");
  if (new Set(ids).size !== ids.length) throw new SplitError("duplicate_participant");
}

/** Berechnet die Anteile; Ergebnis ist nach id sortiert (unabhängig von der Eingabereihenfolge). */
export function computeShares(total: number, input: SplitInput): Allocation[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new SplitError("invalid_amount");
  let out: Allocation[];
  switch (input.type) {
    case "full": {
      out = [{ id: input.owner, amount: total }];
      break;
    }
    case "items": {
      out = computeItemized(total, input.items, input.tax, input.tip);
      break;
    }
    case "equal": {
      assertUnique(input.participants);
      const ids = [...input.participants].sort();
      const parts = allocate(total, ids.map(() => 1));
      out = ids.map((id, i) => ({ id, amount: parts[i] }));
      break;
    }
    case "shares": {
      assertUnique(input.entries.map((e) => e.id));
      const es = [...input.entries].sort((a, b) => (a.id < b.id ? -1 : 1));
      const parts = allocate(total, es.map((e) => e.shares));
      out = es.map((e, i) => ({ id: e.id, amount: parts[i] }));
      break;
    }
    case "percent": {
      assertUnique(input.entries.map((e) => e.id));
      const sum = input.entries.reduce((a, e) => a + e.bp, 0);
      if (sum !== PERCENT_TOTAL_BP) throw new SplitError("percent_sum", `sum=${sum}`);
      const es = [...input.entries].sort((a, b) => (a.id < b.id ? -1 : 1));
      const parts = allocate(total, es.map((e) => e.bp));
      out = es.map((e, i) => ({ id: e.id, amount: parts[i] }));
      break;
    }
    case "exact": {
      assertUnique(input.entries.map((e) => e.id));
      for (const e of input.entries) {
        if (!Number.isSafeInteger(e.amount) || e.amount < 0) throw new SplitError("invalid_amount");
      }
      const sum = input.entries.reduce((a, e) => a + e.amount, 0);
      if (sum !== total) throw new SplitError("exact_sum", `sum=${sum} total=${total}`);
      out = [...input.entries].sort((a, b) => (a.id < b.id ? -1 : 1)).map((e) => ({ ...e }));
      break;
    }
  }
  return out;
}

/** Prüft, dass die Zahler-Beträge exakt dem Gesamtbetrag entsprechen. */
export function validatePayers(total: number, payers: { id: string; amount: number }[]): void {
  assertUnique(payers.map((p) => p.id));
  for (const p of payers) {
    if (!Number.isSafeInteger(p.amount) || p.amount < 0) throw new SplitError("invalid_amount");
  }
  const sum = payers.reduce((a, p) => a + p.amount, 0);
  if (sum !== total) throw new SplitError("payer_sum", `sum=${sum} total=${total}`);
}

/**
 * Itemisierte Aufteilung: Jede Position wird gleichmäßig auf ihre Personen verteilt (Rest-Cent
 * rotiert je Position deterministisch, damit nicht immer dieselbe Person ihn trägt). Steuer und
 * Trinkgeld werden getrennt proportional zu den Positionssummen der Personen verteilt.
 * Die Summe aus Positionen + Steuer + Trinkgeld muss dem Gesamtbetrag entsprechen.
 */
export function computeItemized(total: number, items: ItemInput[], tax: number, tip: number): Allocation[] {
  if (items.length === 0) throw new SplitError("no_participants");
  for (const v of [tax, tip]) if (!Number.isSafeInteger(v) || v < 0) throw new SplitError("invalid_amount");
  let itemSum = 0;
  const gcd = (x: bigint, y: bigint): bigint => (y === 0n ? x : gcd(y, x % y));
  let L = 1n; // kleinstes gemeinsames Vielfaches der Teilnehmerzahlen: macht alle Anteile ganzzahlig
  for (const it of items) {
    if (!Number.isSafeInteger(it.amount) || it.amount < 0) throw new SplitError("invalid_amount");
    if (it.participants.length === 0) throw new SplitError("no_participants");
    assertUnique(it.participants);
    itemSum += it.amount;
    const k = BigInt(it.participants.length);
    L = (L / gcd(L, k)) * k;
  }
  if (itemSum + tax + tip !== total)
    throw new SplitError("items_sum", `sum=${itemSum + tax + tip} total=${total}`);
  // Exakter Anteil je Person (in 1/L Cent): Summe ihrer Positionsanteile. Steuer und Trinkgeld verteilen sich
  // proportional dazu, also ist der exakte Gesamtanteil proportional zu diesem Gewicht. Gerundet wird nur EINMAL
  // am Ende (größter Rest, Gleichstand nach ID): jede Person liegt weniger als 1 Cent neben dem exakten Wert.
  const weight = new Map<string, bigint>();
  for (const it of items) {
    const per = BigInt(it.amount) * (L / BigInt(it.participants.length));
    for (const id of it.participants) weight.set(id, (weight.get(id) ?? 0n) + per);
  }
  const ids = [...weight.keys()].sort();
  const weights = ids.map((id) => weight.get(id)!);
  if (weights.every((w) => w === 0n)) {
    if (total === 0) return ids.map((id) => ({ id, amount: 0 }));
    throw new SplitError("invalid_weight", "tax/tip without item amounts");
  }
  const parts = allocateExact(total, weights);
  return ids.map((id, i) => ({ id, amount: parts[i] }));
}
