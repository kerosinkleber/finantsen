# Finantsen – Projektleitfaden

Selbst gehostete Web-App zum Teilen von Ausgaben (Splitwise-Alternative), mobile-first, als PWA installierbar.

## Stack
Next.js 15 (App Router, UI + API in einem Projekt), React 19, Tailwind 3, Drizzle ORM + PostgreSQL (`postgres.js`), Zod, argon2 (`@node-rs/argon2`), Vitest, Playwright. Deployment: Docker Compose (app, db, caddy).

## Befehle
- `npm run dev` – Dev-Server (braucht `DATABASE_URL`, Migrationen laufen beim Start via `src/instrumentation.ts`)
- `npm run lint` / `npm run typecheck` / `npm test` – Unit-Tests; Integrationstests (`*.int.test.ts`) laufen nur mit `TEST_DATABASE_URL`
- `npm run build && npm run test:e2e` – Playwright (nutzt `TEST_DATABASE_URL`, setzt die DB zurück; ggf. `PLAYWRIGHT_CHROMIUM_PATH` setzen)
- `npm run ci` (= `scripts/ci.sh`, mit `E2E=1` inkl. Build + E2E)
- `npm run db:generate` – nach Schemaänderung in `src/server/schema.ts` neue Migration in `drizzle/` erzeugen (immer mit einchecken)
- `npm run icons` – PWA-Icons neu erzeugen

## Architektur
- `src/lib/money/` – **reine Funktionen**, keine UI-/DB-Abhängigkeit: `currency` (Minor-Units, Parsing, Format), `split` (alle Aufteilungsarten, Largest-Remainder-Rundung), `balances` (Salden, paarweise Schulden), `simplify` (minimale Überweisungen: exakt per Bitmasken-DP bis 18 Beteiligte, darüber Heuristik).
- `src/lib/schemas.ts` – Zod-Schemas (geteilt Client/Server). `src/lib/categories.ts`.
- `src/server/` – `schema.ts` (Drizzle), `db.ts`, `auth.ts` (Sessions: Token-Hash in DB, httpOnly-Cookie), `http.ts` (`route()`-Wrapper: Auth, Origin-Check, Fehlerabbildung), `services/*` (Geschäftslogik **und** Rechteprüfung).
- `src/app/api/**` – dünne Route-Handler; `src/app/(app)` geschützte Seiten (Server Components lesen über Services), `src/app/(auth)` Login/Registrierung/Einladung.
- `src/components/` – Client-Komponenten (Formulare). `src/i18n/` – eigenes Wörterbuch de/en (`de.ts` ist die Schlüssel-Quelle, `en.ts` ist typgleich).
- `public/sw.js` – Service Worker (Navigationen network-first mit Offline-Fallback aus Cache; Static cache-first; API nie gecacht). Cache wird beim Logout geleert.

## Phase-2-Bausteine
- Kommentare: `services/comments.ts`, UI `components/Comments.tsx`. Benachrichtigungen: `services/notifications.ts` (`notifyGroup` legt In-App-Einträge an und sendet Push; Text wird beim Rendern/Senden in der Sprache des Empfängers erzeugt, in der DB liegen nur strukturierte Daten). Web Push: `services/push.ts` (aktiv nur mit `VAPID_*`, sonst No-Op), `public/sw.js` (push/notificationclick), `npm run vapid`.
- Filter: `server/filter.ts` parst Query-Parameter (Betragsfilter in der Gruppenwährung), `expenses.ts#loadExpenses` baut die SQL-Bedingungen; UI `components/FilterForm.tsx` ist ein reines GET-Formular.
- Standard-Aufteilung: `groups.default_split` (jsonb, nur equal/percent/shares), wird in `ExpenseForm` vorbelegt, sofern alle Beteiligten noch Mitglieder sind.
- Auswertung: `lib/money/stats.ts` (rein, je Währung), `services/stats.ts`, UI `components/StatsTab.tsx` (CSS-Balken, kein Chart-Paket).

## Konventionen / Regeln
- Geld IMMER als Ganzzahl in Minor-Units (`bigint` mode number), Währung je Ausgabe/Zahlung. Nie Float.
- Summe der Anteile == Gesamtbetrag (Rundung deterministisch: Rest nach größtem Nachkommarest, Gleichstand nach `id`-Reihenfolge).
- Rechteprüfung ausschließlich serverseitig in den Services (`requireMember` → 404 bei Nicht-Mitgliedern). Neue Services müssen sie aufrufen.
- Freunde = Gruppe mit `kind='direct'` (genau 2 Personen); gleiche Logik wie Gruppen.
- Löschen von Ausgaben/Zahlungen ist Soft Delete (`deletedAt`); Ausgaben haben `expense_history` (Snapshot je Änderung).
- Neue UI-Texte: Schlüssel in `de.ts` UND `en.ts` (Test prüft Gleichheit).
- Keine Secrets im Repo, Konfiguration über `.env` (siehe `.env.example`).
- Jeder sinnvolle Schritt = eigener Commit.

## Roadmap
Phase 0/1/2 fertig. Phase 3 (Währungsumrechnung, Belegscan, Itemisierung) offen.
