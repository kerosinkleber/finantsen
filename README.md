# Finantsen

Selbst gehostete Web-App zum Teilen von Ausgaben (Splitwise-Alternative). Proprietäre Software, siehe Abschnitt Lizenz. Mobile-first, als PWA auf iOS/Android installierbar, Deutsch/Englisch.

**Funktionen (Phase 1):** unbegrenzt viele Gruppen und Freunde, Einladung per Link, Ausgaben mit mehreren Zahlern, Aufteilung gleichmäßig / Prozent / feste Beträge / Anteile / eine Person trägt alles, Salden pro Gruppe und gesamt, Schuldenvereinfachung (minimale Überweisungen), Zahlungen verbuchen, Bearbeiten/Löschen (Soft Delete) mit Änderungsverlauf.

**Funktionen (Phase 2):** Kommentare zu Ausgaben, Suche und Filter (Text, Betrag, Datum, Kategorie, Person), Standard-Aufteilung pro Gruppe, Benachrichtigungen (In-App und optional Web Push), Auswertungen nach Kategorie, Monat und Person.

**Funktionen (Phase 3):** Ausgaben in allen Währungen, für die der Kursanbieter Kurse liefert (Standard: über 150), mit automatischer Umrechnung in die Gruppenwährung; Belegscan per Foto (optional, immer vom Nutzer zu bestätigen); Aufteilung nach Einzelposten mit anteiliger Steuer und Trinkgeld.

## Lokal mit Docker testen
Voraussetzung: Docker Desktop (oder Docker Engine + Compose) läuft. Keine Domain, kein HTTPS, keine `.env` nötig:
```bash
git clone <dieses-repo> finantsen && cd finantsen
docker compose -f docker-compose.local.yml up --build
```
Der erste Build dauert einige Minuten. Wenn im Log `migrations applied` und `Ready` erscheinen, öffne http://localhost:3000. Du landest auf der **Einrichtung**: Lege das Admin-Konto an (Passwort mindestens 20 Zeichen mit Groß-/Kleinbuchstabe, Ziffer, Sonderzeichen, zum Beispiel `Correct-Horse-Battery-9!`). Weitere Personen legst du unter *Konto → Nutzer verwalten* an (Einmal-Link oder Passwort setzen). Zum Testen mit mehreren Personen den Einmal-Link in einem privaten Fenster öffnen und dort das Passwort wählen. Vom Handy im selben WLAN: `http://<IP-deines-Rechners>:3000` (PWA-Installation und Push brauchen HTTPS und gehen nur auf dem echten Server oder über `localhost`).

Nützlich: `docker compose -f docker-compose.local.yml logs -f app` (Logs), `... down` (stoppen, Daten bleiben), `... down -v` (stoppen und Daten löschen), anderer Port: `LOCAL_PORT=3001 docker compose -f docker-compose.local.yml up --build`. Optionale Funktionen: `ANTHROPIC_API_KEY=sk-... docker compose -f docker-compose.local.yml up --build` aktiviert den Belegscan.

Den produktiven Stack (mit Caddy/HTTPS) kannst du lokal mit `DOMAIN=localhost` in `.env` und `docker compose up -d` testen; der Browser warnt dann wegen des selbstsignierten Zertifikats.

## Server-Setup (Schritt für Schritt)

Voraussetzungen: ein Linux-Server mit Docker + Docker Compose, eine Domain, deren DNS-Eintrag (A/AAAA) auf den Server zeigt, offene Ports 80 und 443.

```bash
git clone <dieses-repo> finantsen && cd finantsen
cp .env.example .env
# .env bearbeiten: DOMAIN=splits.example.com und ein Datenbankpasswort setzen:
#   openssl rand -hex 24
docker compose up -d
```

Beim ersten Start baut Docker die App, Caddy holt automatisch ein HTTPS-Zertifikat, und die Datenbankmigrationen laufen automatisch. Öffne `https://<DOMAIN>`: Solange es noch kein Konto gibt, erscheint die **Einrichtung**, dort legst du den Administrator an (Name, Nutzername, Passwort). **Richte das Konto ein, bevor du die Domain weitergibst**: Wer die Seite zuerst aufruft, wird Admin.

- Weitere Konten legt der Admin unter *Konto → Nutzer verwalten* an (siehe unten). Wer in eine Gruppe soll, bekommt aus *Mitglieder → Mitglied einladen* (oder *Freunde → Freund hinzufügen*) einen Link, den er nach der Anmeldung annimmt.
- Lokal testen: `DOMAIN=localhost` (Caddy nutzt ein selbstsigniertes Zertifikat).
- Health-Check: `GET /api/health`.
- Update: `git pull && docker compose up -d --build`.

### Web Push (optional)
Ohne Konfiguration sind Push-Nachrichten sauber deaktiviert (In-App-Benachrichtigungen funktionieren immer). Zum Aktivieren:
```bash
npm install && npm run vapid     # gibt VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT aus
```
Die Zeilen in `.env` eintragen, `docker compose up -d`, danach unter *Konto → Push aktivieren*. Auf iOS funktioniert Push nur, wenn die App zum Home-Bildschirm hinzugefügt wurde. Die Schlüssel nach dem ersten Einsatz nicht mehr ändern, sonst müssen alle Geräte Push neu aktivieren.

### Währungen und Wechselkurse
Jede Ausgabe wird in ihrer Originalwährung gespeichert und beim Buchen in die **Gruppenwährung** umgerechnet; Salden, Schuldenvereinfachung und Auswertungen laufen in der Gruppenwährung. Der Kurs zum Buchungsdatum wird an der Ausgabe gespeichert und ändert sich später nicht mehr (auch nicht beim Bearbeiten, solange Währung und Datum gleich bleiben). Im Formular kann der Kurs manuell überschrieben werden (z. B. der echte Kurs der Kreditkarte). Ändert man die Gruppenwährung, gilt das nur für neue Ausgaben, alte behalten ihre Abrechnungswährung.

Der Anbieter ist per `EXCHANGE_RATE_PROVIDER` wählbar: `fawazahmed0` (Standard, kostenlos, ohne API-Key, 200+ Codes, historische Tageskurse), `open-er-api` (~160 Währungen, nur aktuelle Kurse), `frankfurter` (EZB, ca. 30 Währungen) oder `static` (feste Tabelle aus `EXCHANGE_RATES_STATIC`, z. B. für Server ohne Internetzugang). Kurse werden in der Datenbank gecacht (vergangene Tage unbegrenzt, heutige 6 Stunden). Ist der Anbieter nicht erreichbar, nutzt die App veraltete Cache-Kurse oder verlangt einen manuellen Kurs.

### Belegscan (optional)
Mit `ANTHROPIC_API_KEY` in `.env` erscheint beim Anlegen einer Ausgabe der Button „Beleg scannen“: Foto aufnehmen oder hochladen, das Vision-Modell liest Positionen, Steuer, Trinkgeld und Total aus und füllt das Formular für die Einzelposten vor. **Es wird nie automatisch gespeichert**, alle Werte sind vor dem Speichern editierbar, bei abweichender Summe erscheint ein Hinweis. Das Foto wird im Browser verkleinert, an die Anthropic-API gesendet und **nicht gespeichert**. Das Modell lässt sich mit `RECEIPT_SCAN_MODEL` ändern (Standard `claude-opus-5-5`; ein günstigeres Modell reicht für Belege oft). Pro Nutzer sind 30 Scans pro Stunde erlaubt.

### Konten, Anmeldung und Passwörter
- **Anmeldung** mit Nutzername (3–32 Zeichen, a–z 0–9 . _ -, eindeutig) oder E-Mail. Die E-Mail ist optional und wird nicht verifiziert oder für Versand genutzt; es gibt keinen Mailserver. Standardmäßig darf eine E-Mail nur einmal vorkommen. Erlaubt der Admin Duplikate, fragt der Login bei mehreren passenden Konten nach, welches gemeint ist.
- **Konten legt der Admin an** (*Konto → Nutzer verwalten*): entweder mit einem **Einmal-Link**, über den der Nutzer sein Passwort selbst wählt (Standard 72 Stunden gültig, einstellbar, nur einmal verwendbar, ein neuer Link ersetzt den alten), oder mit einem vom Admin gesetzten Passwort, das beim ersten Login geändert werden muss (abwählbar). Den Link gibt der Admin selbst weiter. „Passwort vergessen“ läuft genauso über einen neuen Link.
- **Selbstregistrierung** ist standardmäßig aus. Der Admin kann sie einschalten; neue Konten warten dann auf seine **Freigabe**.
- **Passwortrichtlinie** (überall gleich, auch beim Admin-Setzen): mindestens 20 Zeichen (höchstens 200), je ein Groß- und Kleinbuchstabe, eine Ziffer, ein Sonderzeichen (Leerzeichen zählt, daher gehen auch Passphrasen), und das Passwort enthält weder den Nutzernamen noch die E-Mail. Ändern geht nur mit dem aktuellen Passwort und nicht auf dasselbe Passwort; danach werden alle anderen Geräte abgemeldet.
- **Schutz vor Raten:** Nach 5 Fehlversuchen pro Konto steigt die Wartezeit (30 s, dann verdoppelt, höchstens 15 Minuten); zusätzlich Begrenzung pro IP.
- **Admin-Verwaltung:** Konten anlegen, freigeben, Einmal-Link erzeugen, Passwort setzen, deaktivieren (Sitzungen enden sofort, Ausgaben und Salden bleiben erhalten) und wieder aktivieren, Admin-Recht vergeben oder entziehen. Es kann mehrere Admins geben; der letzte aktive Admin kann sich weder degradieren noch deaktivieren.
- **Kommt noch (Etappe B):** TOTP (Zwang durch den Admin, Wiederherstellungscodes), danach QR-Code für Gruppeneinladungen (Etappe C). Passkeys sind zurückgestellt.

### Als App installieren
iOS (Safari): Teilen → „Zum Home-Bildschirm“. Android (Chrome): Menü → „App installieren“. Voraussetzung ist HTTPS.

### Backup und Restore
```bash
# Backup
docker compose exec -T db pg_dump -U finantsen -Fc finantsen > backup-$(date +%F).dump
# Restore (App vorher stoppen)
docker compose stop app
docker compose exec -T db pg_restore -U finantsen -d finantsen --clean --if-exists < backup-2026-01-01.dump
docker compose start app
```
Sichere die Dumps außerhalb des Servers (z. B. per Cron + `rclone`/`rsync`).

## Entwicklung
```bash
npm install
# PostgreSQL bereitstellen, z. B. docker run -e POSTGRES_USER=finantsen -e POSTGRES_PASSWORD=finantsen -e POSTGRES_DB=finantsen -p 5432:5432 postgres:16-alpine
export DATABASE_URL=postgres://finantsen:finantsen@localhost:5432/finantsen
npm run dev
npm run ci        # lint, typecheck, Tests (mit TEST_DATABASE_URL auch Integrationstests)
```
Details zu Architektur und Konventionen: [CLAUDE.md](CLAUDE.md).

## Lizenz
Proprietär, alle Rechte vorbehalten (siehe [LICENSE](LICENSE)). Nur der Rechteinhaber darf die Software nutzen, verkaufen, hosten und Lizenzen an Dritte vergeben. Der Code ist kein Open Source; jede Nutzung durch andere braucht einen gesonderten schriftlichen Lizenzvertrag. Abhängigkeiten stehen unter ihren eigenen Open-Source-Lizenzen (MIT, Apache-2.0, MPL-2.0, Unlicense).
