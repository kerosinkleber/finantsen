# Finantsen – Projektleitfaden

Selbst gehostete Web-App zum Teilen von Ausgaben (Splitwise-Alternative), mobile-first, als PWA installierbar.

## Stack
Next.js 16 (App Router, Turbopack-Build, UI + API in einem Projekt; ESLint-Flat-Config direkt aus `eslint-config-next`), React 19, Tailwind 3, Drizzle ORM + PostgreSQL (`postgres.js`), Zod, argon2 (`@node-rs/argon2`), Vitest, Playwright. Deployment: Docker Compose (app, db, caddy).

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
- Itemisierung: `computeItemized` in `lib/money/split.ts` (exakte Anteile über alle Positionen mit BigInt-Gewichten (kgV der Teilnehmerzahlen), Steuer/Trinkgeld proportional, **einmal** gerundet per größtem Rest: jede Person < 1 Cent neben dem exakten Wert); Positionen liegen als jsonb in `expenses.items`, berechnete Anteile wie immer in `expense_shares`. Im Formular ist der Betrag bei „Einzelposten“ abgeleitet.
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
- Fragebogen und Entscheidungen: `docs/fragen/01-konten-und-login.md`. QR-Anzeige (Etappe C): `components/QrCode.tsx` (clientseitig via `qrcode`) in `InviteBox` und Aktivierungslink; Scanner in der App bewusst nicht gebaut. Passkeys: siehe unten, Fragebogen `docs/fragen/03-passkeys.md`.

## Zwei-Faktor (TOTP, Etappe B)
- `server/totp.ts` (RFC 6238 ohne Bibliothek: Base32, HOTP, `verifyTotp` mit Fenster ±1 und `afterStep`), `server/secrets.ts` (AES-256-GCM, HMAC, signierte kurzlebige Tokens, alles aus `APP_SECRET` abgeleitet; `env.appSecret` wirft ohne ≥16 Zeichen), `server/qr.ts` (QR als SVG-Data-URL, auch für Etappe C), `services/totp.ts`.
- Ablauf: `/api/auth/login` liefert bei aktivem TOTP **keine Sitzung**, sondern `{totpRequired, challenge}` (signiert, 5 min); `/api/auth/login/totp` prüft Challenge + Code und legt die Sitzung an. Einmal-Links (`/api/activate`) loggen bei TOTP-Konten nicht automatisch ein. Dev-Login ist ausgenommen.
- Replay-Schutz: `users.totp_last_step` (atomar weitergeschaltet); Wiederherstellungscodes `XXXXX-XXXXX` nur als HMAC in `recovery_codes`, einmal nutzbar. Eigener Fehlzähler `totp_failed_attempts/totp_locked_until` (gleiche Backoff-Kurve `lockSeconds`), den ein richtiges Passwort nicht löscht.
- Zwang: `users.totp_required` (Admin) oder Einstellung `totp_required_all`. `resolveSession` berechnet `totpSetupRequired` für das **echte** Konto; `route()` antwortet 403 `totp_setup_required` (Ausnahme `allowTotpSetup`: `me`, `api/auth/totp/*`), `(app)/layout` leitet auf `/two-factor`. Ausschalten ist bei Zwang gesperrt.
- Einstellungen: `totp_required_all`, `recovery_code_count` (0–20, Standard 1). Admin-Aktionen in `adminAction`: `requireTotp`, `unrequireTotp`, `resetTotp` (beendet Sitzungen, löscht Codes).
- Tests: `totp.test.ts` (RFC-Vektoren), Integrationstests „Etappe B: TOTP“, e2e „two-factor“ (liest den Schlüssel von der Seite, nutzt `totpAt` mit Schritt-Offsets −1/0/+1, weil jeder Code nur einmal gilt).
- `APP_SECRET` ist Pflicht und darf nach Produktivstart nicht geändert werden (`docker-compose.yml` verlangt ihn; lokal fester Dev-Wert in `docker-compose.local.yml`).

## Passkeys (WebAuthn)
- `@simplewebauthn/server|browser` (MIT). `services/passkeys.ts`, Tabelle `passkeys` (Credential-ID eindeutig, Public Key, Zähler, Name, `last_used_at`), Routen `api/auth/passkeys*` und `api/auth/login/passkey*`, UI `components/Passkeys.tsx` (auf `/two-factor`) und Knopf im `LoginForm`.
- Relying Party aus der Anfrage (`rpFromRequest`: Host, `x-forwarded-*`), Challenge stateless als signiertes Token (`signToken`, 5 min). Einrichten/Löschen nur mit Passwort. Anmelde-Optionen sind für unbekannte Konten und Konten ohne Passkey nicht unterscheidbar (erfundene Credential-ID). Fehlversuche zählen auf `failedAttempts/lockedUntil` (wie Passwort).
- Entscheidungen: Passkey ersetzt Passwort **und** TOTP bei der Anmeldung, zählt für den TOTP-Zwang (`resolveSession`: `totpSetupRequired` false mit Passkey), und wer bei Zwang keinen TOTP, aber einen Passkey hat, kann sich nicht nur mit Passwort anmelden (403 `passkey_required`). Admin-Reset (`resetTotp`) löscht auch Passkeys. Nur `kind='user'`; Dev-Login unverändert.
- Test: e2e mit virtuellem Authenticator (CDP `WebAuthn.addVirtualAuthenticator`); Integrationstests ohne Kryptografie (Optionen, Token, Rechte, Zähler, Zwang).

## Wiederkehrende Ausgaben
- Fragebogen `docs/fragen/05-wiederkehrende-ausgaben.md`. Tabelle `recurring_expenses` (Vorlage = `ExpenseBody` ohne `date`/`rate` als jsonb, `unit` day|week|month|year + `every`, `start_date`, `end_date`, `next_index/next_date`, `paused`, `last_error`), `expenses.recurring_id` (eindeutiger Index `(recurring_id, date)` gegen Doppelbuchung), `groups.recurring_policy` (members|owner, vom Besitzer in den Gruppeneinstellungen).
- `lib/recurrence.ts` (rein): n-ter Termin immer vom Start aus (31. → 28. → 31.), `dueOccurrences`. `services/recurring.ts`: `bookDue` beansprucht jeden Termin atomar (`next_index` hochzählen mit Bedingung), bucht über `createExpense(..., { recurringId })` (Ersteller = Anleger, Kurs zum Buchungstag, Benachrichtigung „automatisch“) und nimmt den Anspruch bei Fehlern zurück. Fehler: `rate_unavailable` → später erneut (kein geratener Kurs), `not_a_member` → pausiert mit `member_left`, sonst `booking_failed` (pausiert). Verpasste Termine werden nachgebucht (max. 400 je Lauf).
- Scheduler: `startRecurringScheduler` aus `instrumentation.ts` (beim Start + alle 15 Minuten, `SCHEDULER=off` schaltet ab). Anlegen/Ändern/Fortsetzen bucht Fälliges sofort. Rhythmus/Start ändern = Folge beginnt neu, aber **erst nach der letzten Buchung** der Vorlage (`lastBookedDate`, auch gelöschte zählen) – nie doppelt; nur Inhalt ändern behält sie.
- UI: Gruppenansicht `?tab=recurring` (Link unter den Filtern, kein eigener Reiter wegen der Breite), Formular = `ExpenseForm` mit Prop `recurring` (ohne Belegscan/manuellen Kurs), Seiten `groups/[id]/recurring/new|[rid]`. Testnutzer: Löschschutz berücksichtigt Vorlagen.

## Gäste, Archiv, Export
- Fragebogen `docs/fragen/06-mitglieder-ohne-konto-und-archiv.md`. **Gäste**: `users.kind = 'guest'` mit `guest_group_id` (FK auf Gruppe, kaskadiert), nie anmeldbar (alle Login-Funktionen filtern weiter auf `kind = 'user'`), keine Benachrichtigungen (`notifyGroup` filtert), Kennzeichnung in `listGroups` über `guest.label` in der **Sprache der Seite** (`getLocale`, Fallback Kontosprache). `services/guests.ts`: `addGuest/renameGuest/deleteGuest` (nur ohne Daten; `removeMember` auf einen Gast = löschen; Besitz geht nie an Gäste, das letzte Konto-Mitglied neben Gästen kann nicht austreten: `last_account_member`), `createGuestLink` (Einladung mit `invites.guest_id`, 7 Tage, einmalig), `claimGuest` läuft in `acceptInvite`: Zahler/Anteile zusammenführen (Beträge, `input` addiert; Ausgaben mit Gast **und** Konto: `equal` → `shares` 2:1, `items` → `exact`, damit späteres Bearbeiten dieselben Anteile ergibt), Einzelposten/Vorlagen/Standard-Aufteilung über `lib/merge.ts`, Verlaufs-Snapshots per Text-Ersatz der UUID, Zahlungen umhängen (Selbstzahlungen soft löschen), Mitgliedschaft anlegen, Gast löschen. UI `components/Guests.tsx` (Mitglieder-Reiter).
- **Archiv**: `group_members.archived_at` (je Mitglied), `setArchived`, Übersicht mit „Archiv (n)“.
- **Export**: `lib/csv.ts` (Quoting, CSV-Injection-Schutz, Dezimalformat), `services/export.ts` (`groupCsv` je Sprache der Seite, `accountExport` JSON ohne Geheimnisse), Routen `api/groups/[id]/export`, `api/account/export`.

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
- Löschen von Ausgaben/Zahlungen ist Soft Delete (`deletedAt`); Ausgaben haben `expense_history` (Snapshot je Änderung: create/update/delete/restore). `restoreExpense` (jedes Mitglied) holt gelöschte Ausgaben zurück; Papierkorb in `groups/[id]` (`listExpenses(..., {onlyDeleted})`), Benachrichtigung `expense_restored`.
- Neue UI-Texte: Schlüssel in `de.ts` UND `en.ts` (Test prüft Gleichheit).
- Keine Secrets im Repo, Konfiguration über `.env` (siehe `.env.example`).
- Uhrzeiten nie serverseitig formatieren (Server = UTC): `components/LocalTime.tsx` (formatiert erst im Browser). Falsches Passwort bei Passwort-Bestätigung: Fehlercode `wrong_password` (nicht `invalid_credentials`).
- Weiterleitungsziele nach dem Login nur über `safeNext` (`lib/safe-next.ts`, blockt `//host` und `/\host`); Web-Push-Endpunkte nur über `isAllowedPushEndpoint` (HTTPS + bekannte Push-Dienste, gegen SSRF), geprüft beim Speichern und beim Senden.
- Betragsfilter vergleicht nur Ausgaben derselben Abrechnungswährung (`amountCurrency`); Anteile (`shares`) sind ganze Zahlen, „1,5“ wird abgelehnt statt abgeschnitten.
- Jeder sinnvolle Schritt = eigener Commit.
- Neue Funktion = Eintrag in README, CLAUDE.md, `docs/roadmap.md` und eine Testanleitung in `docs/tester-guide.md` (ggf. Hinweis in `docs/agent-test-prompt.md`).

## Roadmap
Siehe `docs/roadmap.md` (maßgeblich). Alle vereinbarten Funktionen sind gebaut (Phasen 0–3, Konten A–C, Passkeys, Testnutzer, Papierkorb, wiederkehrende Ausgaben, Gäste, Archiv, Export, Release-Reife). Nächster Schritt: Tests durch Auftraggeber/Test-Agent (`docs/tester-guide.md`, `docs/agent-test-prompt.md`), Funde abarbeiten, Release nach `docs/release-checkliste.md`. **Jede neue Funktion braucht einen Abschnitt im Tester-Guide** (Testanleitung für den Agenten).
