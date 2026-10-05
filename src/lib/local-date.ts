/**
 * Heutiges Datum (YYYY-MM-DD) in der Zeitzone des Geräts. `toISOString()` liefert UTC und wäre in Deutschland
 * zwischen Mitternacht und 1 bzw. 2 Uhr noch „gestern“.
 */
export function localToday(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
