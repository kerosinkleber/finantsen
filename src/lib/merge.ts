import { computeShares, type SplitInput } from "./money/split";

/**
 * Ersetzt eine Person durch eine andere in einer Ausgaben-Vorlage bzw. Aufteilung (rein). Kommen danach beide
 * Personen vor, werden die Einträge zusammengefasst, und zwar so, dass die übernehmende Person genau das trägt,
 * was vorher beide zusammen getragen haben: Beträge/Prozente/Gewichte werden addiert, „gleichmäßig“ wird zu
 * „Anteilen“ (Gewicht 2), Einzelposten mit beiden werden zu festen Beträgen. Gebraucht beim Verknüpfen eines Gasts.
 */
type Payer = { userId: string; amountMinor: number };
type Split =
  | { type: "equal"; participants: string[] }
  | { type: "percent"; entries: { userId: string; bp: number }[] }
  | { type: "exact"; entries: { userId: string; amountMinor: number }[] }
  | { type: "shares"; entries: { userId: string; shares: number }[] }
  | { type: "adjust"; entries: { userId: string; adjustMinor: number }[] }
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

/** Beide kommen vor und es bleiben danach noch andere übrig (sonst ist „gleichmäßig“ bzw. der Posten weiterhin richtig). */
const both = (ids: string[], from: string, to: string) => ids.includes(from) && ids.includes(to) && new Set(ids).size > 2;

function toInput(split: Split): SplitInput {
  if (split.type === "items") return { type: "items", items: split.items.map((i) => ({ name: i.name, amount: i.amountMinor, participants: i.participants })), tax: split.taxMinor, tip: split.tipMinor };
  if (split.type === "equal" || split.type === "full") return split;
  if (split.type === "percent") return { type: "percent", entries: split.entries.map((e) => ({ id: e.userId, bp: e.bp })) };
  if (split.type === "exact") return { type: "exact", entries: split.entries.map((e) => ({ id: e.userId, amount: e.amountMinor })) };
  if (split.type === "adjust") return { type: "adjust", entries: split.entries.map((e) => ({ id: e.userId, adjust: e.adjustMinor })) };
  return { type: "shares", entries: split.entries.map((e) => ({ id: e.userId, shares: e.shares })) };
}

/** `total` wird nur gebraucht, wenn Einzelposten beide Personen enthalten (dann Umwandlung in feste Beträge). */
export function replaceUserInSplit(split: Split, from: string, to: string, total?: number): Split {
  switch (split.type) {
    case "equal":
      if (both(split.participants, from, to)) {
        return { type: "shares", entries: mergeBy(split.participants.map((userId) => ({ userId, shares: 1 })), from, to, (a, b) => ({ ...a, shares: a.shares + b.shares })) };
      }
      return { type: "equal", participants: uniq(split.participants.map((p) => swap(p, from, to))) };
    case "percent":
      return { type: "percent", entries: mergeBy(split.entries, from, to, (a, b) => ({ ...a, bp: a.bp + b.bp })) };
    case "exact":
      return { type: "exact", entries: mergeBy(split.entries, from, to, (a, b) => ({ ...a, amountMinor: a.amountMinor + b.amountMinor })) };
    case "shares":
      return { type: "shares", entries: mergeBy(split.entries, from, to, (a, b) => ({ ...a, shares: a.shares + b.shares })) };
    case "adjust": {
      // Beide beteiligt: die zusammengefasste Person trägt beide Anteile → feste Beträge (wie bei Einzelposten)
      if (total !== undefined && both(split.entries.map((e) => e.userId), from, to)) {
        const alloc = computeShares(total, toInput(split)).map((a) => ({ userId: a.id, amountMinor: a.amount }));
        return { type: "exact", entries: mergeBy(alloc, from, to, (a, b) => ({ ...a, amountMinor: a.amountMinor + b.amountMinor })) };
      }
      return { type: "adjust", entries: mergeBy(split.entries, from, to, (a, b) => ({ ...a, adjustMinor: a.adjustMinor + b.adjustMinor })) };
    }
    case "full":
      return { type: "full", owner: swap(split.owner, from, to) };
    case "items":
      if (total !== undefined && split.items.some((i) => both(i.participants, from, to))) {
        const alloc = computeShares(total, toInput(split)).map((a) => ({ userId: a.id, amountMinor: a.amount }));
        return { type: "exact", entries: mergeBy(alloc, from, to, (a, b) => ({ ...a, amountMinor: a.amountMinor + b.amountMinor })) };
      }
      return { ...split, items: replaceUserInItems(split.items, from, to) };
  }
}

/** Standard-Aufteilung der Gruppe (equal/percent/shares mit `value`). */
export function replaceUserInDefaultSplit<T extends { type: "equal" | "percent" | "shares"; entries: { userId: string; value: number }[] }>(d: T, from: string, to: string): T {
  const ids = d.entries.map((e) => e.userId);
  if (d.type === "equal" && both(ids, from, to)) {
    return { ...d, type: "shares", entries: mergeBy(d.entries.map((e) => ({ ...e, value: 1 })), from, to, (a, b) => ({ ...a, value: a.value + b.value })) };
  }
  return { ...d, entries: mergeBy(d.entries, from, to, (a, b) => ({ ...a, value: a.value + b.value })) };
}

export function replaceUserInTemplate<T extends { amountMinor: number; payers: Payer[]; split: Split }>(t: T, from: string, to: string): T {
  return {
    ...t,
    payers: mergeBy(t.payers, from, to, (a, b) => ({ ...a, amountMinor: a.amountMinor + b.amountMinor })),
    split: replaceUserInSplit(t.split, from, to, t.amountMinor),
  };
}
