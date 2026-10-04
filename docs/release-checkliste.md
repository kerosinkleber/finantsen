# Release-Checkliste

Vor dem Produktivbetrieb abhaken.

## Konfiguration
- [ ] `.env` ausgefüllt: `DOMAIN`, `POSTGRES_PASSWORD` (zufällig, `openssl rand -hex 24`), `APP_SECRET` (**Pflicht**, zufällig, `openssl rand -hex 32`, mindestens 16 Zeichen). Der Stack startet ohne ihn nicht. Er verschlüsselt die TOTP-Geheimnisse; **nach dem Start nie mehr ändern** und im Backup mitsichern, sonst sind alle TOTP-Konten unbenutzbar (Admin muss sie zurücksetzen).
- [ ] **Testfunktionen sind aus.** Der produktive Stack `docker-compose.yml` setzt `TEST_FEATURES_DEFAULT` nicht, damit ist der Schalter „Testfunktionen“ standardmäßig aus. Nur `docker-compose.local.yml` (lokaler Test) setzt `TEST_FEATURES_DEFAULT=true`.
  - Wurde der Schalter im Admin-Bereich einmal bewusst gesetzt, behält er diese Wahl (Datenbank hat Vorrang). Vor dem Release unter *Konto → Nutzer verwalten → Einstellungen* prüfen: „Testfunktionen“ **aus**.
- [ ] **`DEV_ADMIN` ist nicht gesetzt** (Admin „admin“ ohne Passwort, Anmeldung per Knopf). Der produktive Stack `docker-compose.yml` reicht die Variable nie durch; nur `docker-compose.local.yml` setzt sie. Die Datenbank des lokalen Tests **nicht** für den Produktivbetrieb weiterverwenden: frische Datenbank (`down -v`) und Ersteinrichtung über `/setup`. (Notfalls kann sich der passwortlose Admin selbst unter *Nutzer verwalten → Passwort setzen* ein Passwort geben; danach ist der Dev-Zugang automatisch zu.)
- [ ] Testnutzer und Testdaten aufgeräumt (Testnutzer löschen, solange die Funktion noch an ist). Danach ausschalten.
- [ ] Zwei-Faktor gewünscht? Unter *Nutzer verwalten → Einstellungen* „für alle verpflichtend“ und Anzahl Wiederherstellungscodes festlegen. Der erste Admin richtet sein TOTP vorher selbst ein (sonst wird er beim nächsten Login dazu gezwungen).
- [ ] **Domain festlegen, bevor Passkeys eingerichtet werden:** Ein Passkey gilt nur für die Domain, unter der er angelegt wurde (und braucht HTTPS). Bei späterem Domainwechsel muss jeder seine Passkeys neu einrichten (Passwort und TOTP bleiben gültig). Passkeys, die lokal auf `localhost` angelegt wurden, funktionieren produktiv nicht.
- [ ] **Zeitplaner** für wiederkehrende Ausgaben läuft im App-Prozess (nicht `SCHEDULER=off` setzen). Bei mehreren App-Instanzen ist Doppelbuchung durch die Datenbank ausgeschlossen.
- [ ] Selbstregistrierung gewünscht? Standard ist aus.
- [ ] Optional: `VAPID_*` (Push), `ANTHROPIC_API_KEY` (Belegscan), `EXCHANGE_RATE_PROVIDER`.

## Sicherheit
- [ ] Admin-Konto über `/setup` eingerichtet, **bevor** die Domain weitergegeben wurde (wer die Seite zuerst aufruft, wird Admin).
- [ ] HTTPS aktiv (Caddy holt das Zertifikat automatisch, DNS muss auf den Server zeigen, Port 80/443 offen).
- [ ] Backup eingerichtet (`scripts/backup.sh` per Cron, siehe README), `APP_SECRET` getrennt gesichert, und einmal mit `scripts/restore-check.sh` geprüft.
- [ ] `npm audit --omit=dev` angesehen (Stand Next.js 16: keine bekannten Schwachstellen).

## Prüfen
- Zuletzt im Sandbox-Container geprüft (Build, alle 8 Migrationen, Sicherheits-Header, Health, TOTP- und Passkey-Endpunkte): Stand Passkeys + Release-Reife.
- [ ] `docker compose up -d --build`, `https://<DOMAIN>/api/health` liefert `ok`.
- [ ] Anmelden, Gruppe anlegen, Ausgabe buchen.
