# Performance-Prüfung (Stand 2026-10-05)

## Vorgehen
Testdatenbank mit einer großen Gruppe: **3000 Ausgaben, 8 Mitglieder** (jede Ausgabe gleich auf alle 8 verteilt, also 24 000 Anteile), dazu 5 kleine Gruppen. Gemessen wurde
1. jeder Lesepfad der Services (Mittel aus 3 Läufen nach einem Aufwärmlauf) und
2. die echten Seiten über den Produktions-Build (`next start`, `curl` mit Sitzungs-Cookie, lokal, PostgreSQL 16).

## Befund
| Pfad | vorher |
|---|---|
| `loadExpenses` / `listExpenses` | 1,2–1,4 s |
| `groupBalances` | 1,1 s |
| `overallBalances` (Übersicht) | 1,2 s |
| `getGroupStats` | 1,1 s |

Ursachen:
1. **Quadratische Zuordnung in `hydrate`**: Für jede Ausgabe wurde die komplette Liste aller Zahler/Anteile gefiltert (3000 × 24 000 Vergleiche).
2. **`IN (...)`-Liste mit einem Parameter pro Ausgabe**: langsam zu parsen und ab 65 535 Ausgaben einer Gruppe ein harter Fehler (PostgreSQL-Grenze).
3. **Salden luden alle Ausgaben**, obwohl für vereinfachte Schulden (Standard) nur Summen pro Person nötig sind; die Übersicht tat das **nacheinander für jede Gruppe**.
4. **Die Gruppenseite renderte alle Einträge**: 4,6 MB HTML bei 3000 Ausgaben.

## Plan (klein, ohne Architekturänderung, selbst umgesetzt)
1. `hydrate` gruppiert Zahler/Anteile einmal per `Map` (linear).
2. Ein einzelner Array-Parameter (`= any($1::uuid[])`) statt der IN-Liste.
3. `netBalancesSql`: Nettosalden direkt in SQL summiert (Zahler +, Anteile −, Zahlungen ±, nur nicht gelöschte, Abrechnungswährung). `groupBalances` nutzt das für Gruppen mit vereinfachten Schulden; nur bei paarweisen Schulden bleibt der vollständige Weg (`groupBalancesFull`). Die Übersicht fragt alle vereinfachten Gruppen mit **einer** Abfrage ab, die übrigen parallel.
4. Ausgabenliste der Gruppe mit Seiten: 50 Einträge je Seite (auf Wunsch 100, `?per=100`), „← Neuere / Ältere →“ (`?page=`). Geladen werden nur Sortierschlüssel bis zur Seite (`listExpenseKeys`, plus Anzahl) und die vollen Daten der sichtbaren Einträge (`loadExpenses(..., { ids })`). Salden, Statistik und Export zählen weiterhin alles.
   - Vorher (bis Oktober 2026) gab es „Ältere anzeigen“, das die Liste immer um 100 verlängerte. Messung mit 1000 Ausgaben: die Seite mit allen Einträgen war 1,6 MB groß, der Speicher der App stieg dabei auf 415 MB (eine Person) bis 780 MB (20 gleichzeitig). Normale Seiten: 110 MB im Leerlauf, 250–370 MB unter Last.
5. Absicherung: Integrationstest „SQL-Nettosalden stimmen mit der vollständigen Berechnung überein“ (Zahler, Anteile, mehrere Zahler, Zahlung, gelöschte Ausgabe, Übersicht) und Test für das Limit.

## Ergebnis
| Pfad | vorher | nachher |
|---|---|---|
| `listExpenses` | 1,2 s | 0,10 s |
| `groupBalances` | 1,1 s | 0,014 s |
| `overallBalances` | 1,2 s | 0,019 s |
| `getGroupStats` | 1,1 s | 0,11 s |
| Seite `/` (Übersicht) | 1,80 s | 0,05 s |
| Seite Gruppe (Ausgaben) | 1,92 s, 4,6 MB | 0,06 s, 180 KB |
| Seite Gruppe → Salden | 1,36 s | 0,05 s |
| Seite Gruppe → Statistik | 1,31 s | 0,19 s |

Bei normalen Gruppen (einige Dutzend bis wenige Hundert Ausgaben) war die App schon vorher flott; der Gewinn betrifft große und langlebige Gruppen.

## Bewusst nicht gemacht (nur bei Bedarf)
- **Statistik in SQL** (0,19 s bei 3000 Ausgaben ist vertretbar): `computeStats` bräuchte Gruppierungen nach Kategorie, Monat und Person in SQL.
- **Paarweise Schulden** (Gruppen mit ausgeschalteter Vereinfachung) laden weiter alle Ausgaben, weil die Zuordnung je Ausgabe nötig ist.
- **Caching** von Salden: nicht nötig, solange die SQL-Summen so schnell sind; würde Invalidierung bei jeder Änderung erfordern.
- Datenbank-Indizes: vorhanden und ausreichend (`expenses(group_id, date)`, Primärschlüssel `(expense_id, user_id)` für Zahler/Anteile, `payments(group_id)`).

## Speicher (Oktober 2026)

**Ausgangslage:** Node richtet seine Heap-Grenze nach dem RAM, den es sieht. In einem Container ohne Speicherlimit auf einem NAS mit 8 GB räumt es deshalb spät auf, und die Spitzen wachsen. Der Leerlauf liegt bei rund 110 MB (Node selbst).

**Maßnahme:** `NODE_OPTIONS=--max-old-space-size=256` im `Dockerfile` (Laufzeit-Stufe), in `docker-compose.yml`/`docker-compose.nas.yml` über die `.env` änderbar. Kein Code geändert.

**Messung** (`next start`/standalone, VmHWM des Node-Prozesses, je 20 Anfragen pro Seite: Übersicht, Gruppe, Salden, Statistik, Seite 30 mit 100 Einträgen, Gruppen-CSV, Konto-JSON):

| Daten | Gleichzeitig | ohne Grenze | mit 256 MB | Änderung |
|---|---|---|---|---|
| 1000 Ausgaben, 5 Personen | 1 / 5 / 20 | 328 / 378 / 397 MB | 198 / 208 / 226 MB | −40 / −45 / −43 % |
| 5000 Ausgaben (per Import), 5 Personen | 1 / 5 / 20 | 445 / 563 / 723 MB | 268 / 336 / 414 MB | −40 / −40 / −43 % |

- Alle Anfragen erfolgreich (HTTP 200), Antwortzeiten in den Messreihen mit 1000 Ausgaben unverändert.
- **Import von 5000 Zeilen** (Höchstgrenze) unter der Grenze: in 55 s gebucht, Spitze 178 MB.
- **Abgestürzt** („heap out of memory“) ist die App erst bei 64 MB und darunter; 96 MB hielt die Messreihe noch. 256 MB lässt also reichlich Luft.
- Gleiches Ergebnis im echten Basis-Image `node:22-bookworm-slim` und mit einem Container-Limit von 1 GB statt Heap-Grenze. Ohne Wirkung: Alpine-Basis-Image, `MALLOC_ARENA_MAX=2`. Kleinere Junge Generation (`--max-semi-space-size`) und `--optimize-for-size` sparen etwas mehr, kosten aber 10–40 % Geschwindigkeit, deshalb nicht genommen.
- Optional, nicht umgesetzt: 5 statt 10 Datenbankverbindungen spart in PostgreSQL rund 17 MB (52 → 35 MB).
- Steigt der Bedarf einmal über die Grenze, beendet sich der Prozess mit „heap out of memory“; `restart: unless-stopped` startet ihn neu. Dann `NODE_OPTIONS=--max-old-space-size=512` in der `.env` setzen.

## Wiederholen
Messskript liegt nicht im Repo (erzeugt Testdaten in einer eigenen Datenbank). Kurz: Datenbank `finantsen_perf` anlegen, per Services 3000 Ausgaben buchen, Zeiten der Services messen und die Seiten mit `next start` gegen diese Datenbank abrufen.
