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

## Phase-3-Bausteine
- Währungen: `lib/money/convert.ts` (BigInt-Umrechnung, Kurse als Dezimalstring mit 15 Stellen, kaufmännisch gerundet, `rescale` verteilt Zahler/Anteile neu, damit Summe == umgerechneter Betrag). Ausgaben haben `currency/amount_minor` (Original) und `base_currency/base_amount_minor/rate/rate_source` (Abrechnungswährung = Gruppenwährung beim Buchen); Zahler/Anteile tragen `base_amount_minor`. **Salden, Statistik und Betragsfilter rechnen mit den Basiswerten.** `isValidCurrency` prüft gegen ICU (Intl akzeptiert sonst jeden 3-Buchstaben-Code).
- Kurse: `server/rates/providers.ts` (Interface `RateProvider` + fawazahmed0, open-er-api, frankfurter, static), `server/rates/index.ts` (DB-Cache `exchange_rates`, `getRate`, `getSupportedCurrencies`, Test-Hook `setRateProvider`). Anbieterformate sind nach Dokumentation implementiert und in Tests gemockt, nicht live geprüft.
- Itemisierung: `computeItemized` in `lib/money/split.ts` (Rest-Cent rotiert je Position; Steuer/Trinkgeld getrennt proportional); Positionen liegen als jsonb in `expenses.items`, berechnete Anteile wie immer in `expense_shares`. Im Formular ist der Betrag bei „Einzelposten“ abgeleitet.
- Belegscan: `server/receipts/` (`scanner.ts` Interface + Anthropic-Implementierung mit `messages.parse` und Zod-Schema, `normalize.ts` wandelt Modell-Strings in Minor-Units, `image.ts` Magic-Byte-Prüfung), Route `api/receipts/scan`, UI `components/ReceiptScan.tsx`. Aktiv nur mit `ANTHROPIC_API_KEY`; Ergebnis ist nur ein Vorschlag. Bilder werden nie gespeichert.
- Migration `0002` füllt Basiswerte für Altdaten (= Originalwerte).

## Konten und Anmeldung
- Keine öffentliche Registrierung per Default. `users`: `username` (eindeutig, klein, kein „@“), optionale `email` (nicht eindeutig im DB-Index; Eindeutigkeit prüft `insertUser` unter Advisory Lock, solange `allow_duplicate_emails` aus ist), `passwordHash` null bis zur Aktivierung, `status` (`active | invited | pending | disabled`), `mustChangePassword`, `failedAttempts/lockedUntil`.
- Alles in `services/accounts.ts`: `needsSetup/setupAdmin` (nur solange kein Konto existiert, Lock), `createUserByAdmin`, `registerSelf` (Status `pending`), `authenticate` (Nutzername oder E-Mail; Backoff pro Konto `lockSeconds`; Status erst nach korrektem Passwort offengelegt), Einmal-Links (`issueLink/peekLink/redeemLink`, nur SHA-256 in `user_tokens`, einmalig, ersetzt alte, Gültigkeit aus Einstellung), `changePassword`, `adminAction` (approve/disable/enable/makeAdmin/removeAdmin/link/setPassword; Last-Admin-Schutz; Sitzungen enden bei disable/setPassword/Änderung).
- Passwortrichtlinie: `lib/password.ts` (rein, gemeinsam Client/Server; UI `PasswordField` mit Live-Checkliste). Server wirft `password_policy` mit `issues`.
- Einstellungen (Tabelle `settings`, `services/settings.ts`, Admin-UI `/admin/users`, API `api/admin/settings`): `registration_enabled` (aus), `allow_duplicate_emails` (aus), `link_validity_hours` (72).
- `route()` blockiert alle API-Aufrufe mit 403 `password_change_required`, solange `mustChangePassword` gilt (Ausnahme `allowMustChange`: me, Passwort ändern); `(app)/layout` leitet auf `/change-password`.
- Einmal-Links laufen über **eine** Stelle (`linkUrl` in accounts.ts); SMTP wäre dort nachrüstbar (bewusst nicht gebaut).
- Ersteinrichtung: `/setup` (ohne Schutzcode, vom Auftraggeber so gewollt), `/login` und `/register` leiten dorthin, solange es kein Konto gibt.
- Gruppeneinladungen (`/join/[code]`) nimmt nur ein angemeldetes Konto an.
- Fragebogen und Entscheidungen: `docs/fragen/01-konten-und-login.md`. Offen: Etappe B (TOTP) und C (QR), Passkeys zuletzt.

## Entwicklungs-Admin und Anzeigename
- `DEV_ADMIN=true` (nur `docker-compose.local.yml`; produktiv nie durchgereicht): `ensureDevAdmin` (Start, `instrumentation.ts`) legt bei **leerer** Datenbank genau einen Admin `admin` ohne Passwort an (`name` = Nutzername); `/api/dev/login` + Knopf auf der Anmeldeseite + rotes Banner. `devLogin` gilt nur, solange Variable gesetzt, Konto `admin` echtes Konto (`kind user`), Admin, aktiv und **ohne Passwort**; sonst 404. Normaler Login bleibt für passwortlose Konten immer zu. Release: `docs/release-checkliste.md`.
- Anzeigename optional: Schemas (`displayName` preprocess leer → undefined), Services setzen `name = username`, wenn leer (`insertUser`, `insertTest`). DB-Spalte bleibt `NOT NULL`.

## Admin-Testfunktionen
- Testnutzer: `users.kind = 'test'` (kein Passwort, `status active`, nie Admin). **Jede** Login-/Link-/Passwort-Funktion filtert auf `kind = 'user'` (`authenticate`, `loadValidToken`, `target` in `adminAction`, `changePassword`, `resolveSession`). Neue Konto-Funktionen müssen das beachten.
- „Handeln als“: `sessions.acting_as_user_id`. `resolveSession` (cookie-frei, testbar) liefert die **effektive** Identität (`SessionUser.id/isAdmin` = Testnutzer, `isAdmin` dann false) und die echte unter `user.real`; es greift nur, wenn das echte Konto Admin ist, das Ziel `kind='test'` ist **und** Testfunktionen an sind. Admin-Seiten/-APIs prüfen die effektive Identität, sind also beim Handeln als Testnutzer gesperrt; `/api/admin/act` DELETE beendet es.
- Nachvollziehbarkeit: `acted_by` (echter Admin) in `expense_history`, `expense_comments`, `payments`; Services `createExpense/updateExpense/deleteExpense/addComment/createPayment` nehmen `actedBy` (Routen: `actedBy(user)` aus `http.ts`).
- `services/testUsers.ts`: anlegen (`test-N` fortlaufend oder einzeln), bearbeiten, `addToGroup` (Warnung `needs_confirmation`; Auswahl nur Gruppen mit dem Admin oder nur Testnutzern), `setGroupRole` (Besitzerschutz), `removeFromGroup` (offener Saldo nur mit `confirmed`; Besitzer wird weitergereicht), `addFriend` (Direktgruppe), `deleteTestUser` (blockiert bei Daten in Gruppen mit echten Nutzern; Ersteller-Verweis und Besitzer werden umgehängt), `startActingAs/stopActingAs`.
- Schalter: `settings.testFeaturesEnabled()`; Default aus `TEST_FEATURES_DEFAULT` (nur `"true"`), DB-Wert hat Vorrang. Nur `docker-compose.local.yml`, Playwright und `.env.example` (auskommentiert) setzen ihn. Testnutzer erhalten nie Push (In-App-Benachrichtigungen ja). In `listGroups` tragen Testnutzer „(Test)“ im Namen, ebenso Verlauf/Kommentare/Benachrichtigungen.
- Release: `docs/release-checkliste.md`.

## Lizenz
Proprietär (`LICENSE`, `package.json` → `UNLICENSED`). Keine Open-Source-Lizenz, keine Copyleft-Abhängigkeiten hinzufügen (aktuell nur MIT/Apache/Unlicense/MPL-2.0). Neue Dateien brauchen keinen Lizenzkopf.

## Zusammenarbeit
Offene Fragen an den Auftraggeber werden als **Markdown-Fragebogen** unter `docs/fragen/NN-thema.md` bereitgestellt (Checkboxen, Empfehlung markiert, Abschnitt „Schon entschieden“ und „Meine Annahmen“), nicht als lange Chat-Liste. Kein PDF/Formular-Tool. Den Fragebogen **immer sofort** per `SendUserFile` als Download an den Auftraggeber schicken (er öffnet ihn selbst im Editor); Antworten danach ins Repo übernehmen und eine Abschnitt „Umsetzung“ mit meiner Auslegung anhängen.

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
Siehe `docs/roadmap.md` (maßgeblich, mit Reihenfolge). Kurz: Phase 0–3 und Konten-Etappe A sind fertig. **Aktuell vorgezogen: Admin-Testfunktionen** (Testnutzer ohne Passwort, vom Admin steuerbar; Fragebogen `docs/fragen/02-testnutzer.md`). Danach Etappe B (TOTP), Etappe C (QR), zuletzt Passkeys.
