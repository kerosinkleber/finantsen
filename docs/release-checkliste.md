# Release-Checkliste

Vor dem Produktivbetrieb abhaken.

## Konfiguration
- [ ] `.env` ausgefüllt: `DOMAIN`, `POSTGRES_PASSWORD` (zufällig, `openssl rand -hex 24`), `APP_SECRET` (zufällig, `openssl rand -hex 32`).
- [ ] **Testfunktionen sind aus.** Der produktive Stack `docker-compose.yml` setzt `TEST_FEATURES_DEFAULT` nicht, damit ist der Schalter „Testfunktionen“ standardmäßig aus. Nur `docker-compose.local.yml` (lokaler Test) setzt `TEST_FEATURES_DEFAULT=true`.
  - Wurde der Schalter im Admin-Bereich einmal bewusst gesetzt, behält er diese Wahl (Datenbank hat Vorrang). Vor dem Release unter *Konto → Nutzer verwalten → Einstellungen* prüfen: „Testfunktionen“ **aus**.
- [ ] Testnutzer und Testdaten aufgeräumt (Testnutzer löschen, solange die Funktion noch an ist). Danach ausschalten.
- [ ] Selbstregistrierung gewünscht? Standard ist aus.
- [ ] Optional: `VAPID_*` (Push), `ANTHROPIC_API_KEY` (Belegscan), `EXCHANGE_RATE_PROVIDER`.

## Sicherheit
- [ ] Admin-Konto über `/setup` eingerichtet, **bevor** die Domain weitergegeben wurde (wer die Seite zuerst aufruft, wird Admin).
- [ ] HTTPS aktiv (Caddy holt das Zertifikat automatisch, DNS muss auf den Server zeigen, Port 80/443 offen).
- [ ] Backup eingerichtet (`pg_dump`, siehe README) und einmal testweise zurückgespielt.

## Prüfen
- [ ] `docker compose up -d --build`, `https://<DOMAIN>/api/health` liefert `ok`.
- [ ] Anmelden, Gruppe anlegen, Ausgabe buchen.
