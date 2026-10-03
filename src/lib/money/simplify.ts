/**
 * Schuldenvereinfachung. Minimale Anzahl Überweisungen = (Anzahl Beteiligter mit Saldo != 0)
 * minus (maximale Anzahl disjunkter Teilmengen mit Summe 0). Das ist NP-schwer; bis
 * EXACT_LIMIT Beteiligten lösen wir exakt per Bitmasken-DP, darüber mit einer Heuristik
 * (exakte Paare zuerst, dann gieriges Matching).
 */

export type Transfer = { from: string; to: string; amount: number };

export const EXACT_LIMIT = 18;

export function simplifyDebts(net: Record<string, number>): Transfer[] {
  const entries = Object.entries(net)
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => (a < b ? -1 : 1)); // deterministisch
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  if (sum !== 0) throw new Error(`balances do not sum to zero (${sum})`);
  if (entries.length === 0) return [];

  const groups = entries.length <= EXACT_LIMIT ? exactPartition(entries) : heuristicPartition(entries);
  const transfers: Transfer[] = [];
  for (const g of groups) transfers.push(...settleGroup(g));
  return transfers;
}

type Entry = [string, number];

/** Zerlegt in maximal viele disjunkte Nullsummen-Teilmengen (exakt). */
function exactPartition(entries: Entry[]): Entry[][] {
  const n = entries.length;
  const size = 1 << n;
  const sums64 = new Float64Array(size);
  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask;
    sums64[mask] = sums64[mask ^ low] + entries[31 - Math.clz32(low)][1];
  }
  const dp = new Int16Array(size); // max Anzahl Nullsummen-Gruppen unter den Teilmengen von mask
  const choice = new Int32Array(size); // letzter entfernter Index
  for (let mask = 1; mask < size; mask++) {
    let best = -1;
    let bestI = 0;
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      const v = dp[mask ^ (1 << i)];
      if (v > best) {
        best = v;
        bestI = i;
      }
    }
    dp[mask] = best + (sums64[mask] === 0 ? 1 : 0);
    choice[mask] = bestI;
  }
  // Rekonstruktion: Wir gehen die Kette der Entfernungen ab; jedes Mal wenn dp um 1 steigt
  // (sum==0), schließt eine Gruppe ab.
  const groups: Entry[][] = [];
  let mask = size - 1;
  // Reihenfolge der Entfernung rückwärts: Elemente, die zusammen eine Gruppe bilden, sind
  // aufeinanderfolgend in der Kette, bis sums64[mask]==0 am Ende der Gruppe erreicht wird.
  const chain: number[] = [];
  while (mask) {
    chain.push(choice[mask]);
    mask ^= 1 << choice[mask];
  }
  // chain[0] wurde zuerst entfernt (aus der vollen Menge); Teilmengen-Summen entlang der Kette
  // von hinten nach vorn aufbauen: Gruppe endet dort, wo die Teilmengensumme 0 ist.
  const order = chain.reverse(); // Aufbaureihenfolge
  let acc: Entry[] = [];
  let accSum = 0;
  for (const idx of order) {
    acc.push(entries[idx]);
    accSum += entries[idx][1];
    if (accSum === 0) {
      groups.push(acc);
      acc = [];
    }
  }
  if (acc.length) groups.push(acc); // kann nicht passieren (Gesamtsumme 0), Sicherheitsnetz
  return groups;
}

function heuristicPartition(entries: Entry[]): Entry[][] {
  const groups: Entry[][] = [];
  const pos = entries.filter(([, v]) => v > 0);
  const neg = entries.filter(([, v]) => v < 0);
  const usedNeg = new Set<number>();
  const rest: Entry[] = [];
  // exakte Paare
  for (const p of pos) {
    const j = neg.findIndex(([, v], k) => !usedNeg.has(k) && v === -p[1]);
    if (j >= 0) {
      usedNeg.add(j);
      groups.push([p, neg[j]]);
    } else rest.push(p);
  }
  neg.forEach((e, k) => {
    if (!usedNeg.has(k)) rest.push(e);
  });
  if (rest.length) groups.push(rest);
  return groups;
}

/** Innerhalb einer Nullsummen-Gruppe: größter Schuldner zahlt an größten Gläubiger. <= k-1 Überweisungen. */
function settleGroup(group: Entry[]): Transfer[] {
  const cred = group.filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debt = group.filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const out: Transfer[] = [];
  const byAmountDesc = (a: { id: string; v: number }, b: { id: string; v: number }) =>
    b.v - a.v || (a.id < b.id ? -1 : 1);
  while (cred.length && debt.length) {
    cred.sort(byAmountDesc);
    debt.sort(byAmountDesc);
    const c = cred[0];
    const d = debt[0];
    const amount = Math.min(c.v, d.v);
    out.push({ from: d.id, to: c.id, amount });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) cred.shift();
    if (d.v === 0) debt.shift();
  }
  return out;
}
