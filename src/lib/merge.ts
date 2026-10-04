/**
 * Ersetzt eine Person durch eine andere in einer Ausgaben-Vorlage bzw. in Einzelposten (rein). Kommen danach
 * beide Personen doppelt vor, werden die Einträge zusammengefasst (Beträge, Prozente und Gewichte addiert),
 * damit Summen und Aufteilung gültig bleiben. Gebraucht beim Verknüpfen eines Gasts mit einem Konto.
 */
type Payer = { userId: string; amountMinor: number };
type Split =
  | { type: "equal"; participants: string[] }
  | { type: "percent"; entries: { userId: string; bp: number }[] }
  | { type: "exact"; entries: { userId: string; amountMinor: number }[] }
  | { type: "shares"; entries: { userId: string; shares: number }[] }
  | { type: "full"; owner: string }
  | { type: "items"; items: Item[]; taxMinor: number; tipMinor: number };
type Item = { name: string; amountMinor: number; participants: string[] };

const swap = (id: string, from: string, to: string) => (id === from ? to : id);
const uniq = (ids: string[]) => [...new Set(ids)];

function mergeBy<T extends { userId: string }>(list: T[], from: string, to: string, add: (a: T, b: T) => T): T[] {
  const out: T[] = [];
  for (const e of list.map((x) => ({ ...x, userId: swap(x.userId, from, to) }))) {
    const i = out.findIndex((o) => o.userId === e.userId);
    if (i >= 0) out[i] = add(out[i], e);
    else out.push(e);
  }
  return out;
}

export function replaceUserInItems(items: Item[], from: string, to: string): Item[] {
  return items.map((i) => ({ ...i, participants: uniq(i.participants.map((p) => swap(p, from, to))) }));
}

export function replaceUserInSplit(split: Split, from: string, to: string): Split {
  switch (split.type) {
    case "equal":
      return { type: "equal", participants: uniq(split.participants.map((p) => swap(p, from, to))) };
    case "percent":
      return { type: "percent", entries: mergeBy(split.entries, from, to, (a, b) => ({ ...a, bp: a.bp + b.bp })) };
    case "exact":
      return { type: "exact", entries: mergeBy(split.entries, from, to, (a, b) => ({ ...a, amountMinor: a.amountMinor + b.amountMinor })) };
    case "shares":
      return { type: "shares", entries: mergeBy(split.entries, from, to, (a, b) => ({ ...a, shares: a.shares + b.shares })) };
    case "full":
      return { type: "full", owner: swap(split.owner, from, to) };
    case "items":
      return { ...split, items: replaceUserInItems(split.items, from, to) };
  }
}

export function replaceUserInTemplate<T extends { payers: Payer[]; split: Split }>(t: T, from: string, to: string): T {
  return {
    ...t,
    payers: mergeBy(t.payers, from, to, (a, b) => ({ ...a, amountMinor: a.amountMinor + b.amountMinor })),
    split: replaceUserInSplit(t.split, from, to),
  };
}
