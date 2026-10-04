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
Der erste Build dauert einige Minuten. Wenn im Log `migrations applied` und `Ready` erscheinen, öffne http://localhost:3000. Im lokalen Test läuft der **Entwicklungs-Admin**: Beim ersten Start wird der Admin `admin` (ohne Passwort, ohne eigenen Anzeigenamen) angelegt, die Ersteinrichtung entfällt. Auf der Anmeldeseite meldet dich der Knopf **„Als admin anmelden (Entwicklung)“** mit einem Klick an, ein rotes Banner erinnert an den Entwicklungsmodus. Das gilt nur mit `DEV_ADMIN=true` (setzt nur `docker-compose.local.yml`); im produktiven Stack gibt es das nicht. Weitere Personen legst du unter *Konto → Nutzer verwalten* an (Einmal-Link oder Passwort setzen). Der Anzeigename ist überall optional und entspricht ohne Eingabe dem Nutzernamen. Willst du die echte Ersteinrichtung testen, starte ohne `DEV_ADMIN` (Zeile in der Compose-Datei entfernen) und nutze ein gültiges Passwort wie `Correct-Horse-Battery-9!`. Zum Testen mit mehreren Personen den Einmal-Link in einem privaten Fenster öffnen und dort das Passwort wählen. Vom Handy im selben WLAN: `http://<IP-deines-Rechners>:3000` (PWA-Installation und Push brauchen HTTPS und gehen nur auf dem echten Server oder über `localhost`).

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
- **Zwei-Faktor-Anmeldung (TOTP):** Jeder kann sie unter *Konto* freiwillig einrichten (Authenticator-App, QR-Code oder Schlüssel). Der Admin kann sie **für alle** oder **für einzelne Konten verlangen**; wer sie braucht und noch nicht hat, muss sie nach dem Passwort zuerst einrichten, vorher geht nichts anderes. Beim Einrichten gibt es Wiederherstellungscodes (Standard 1, vom Admin auf 0 bis 20 einstellbar, jeder gilt einmal, unter *Konto* neu erzeugbar). Jeder Code (auch jeder TOTP-Code) gilt nur einmal; Fehlversuche haben eine eigene Wartezeit. Bei Geräteverlust setzt der Admin TOTP zurück. Ausschalten geht freiwillig nur mit Passwort und Code, nicht wenn es verlangt wird. Die Geheimnisse liegen mit `APP_SECRET` verschlüsselt in der Datenbank: **`APP_SECRET` ist Pflicht (mindestens 16 Zeichen) und darf nicht mehr geändert werden**, sonst sind alle TOTP-Konten unbenutzbar.
- **QR-Codes:** Zu jedem Einladungslink (Gruppe, Freund, Konto-Aktivierung) wird ein QR-Code angezeigt; scannen geht mit der normalen Handy-Kamera. Ein Scanner in der App ist bewusst nicht gebaut. Passkeys sind zurückgestellt.

### Admin-Testfunktionen (Testnutzer)
Zum Ausprobieren legt der Admin unter *Konto → Nutzer verwalten → Testnutzer verwalten* **Testnutzer** an (einzeln mit eigenem Namen oder mehrere auf einmal: `test-1`, `test-2`, …). Testnutzer haben **kein Passwort** und können sich **nie** selbst anmelden, auch nicht über Einmal-Link, Registrierung oder Passwort-Zurücksetzen. Sie werden überall mit „(Test)“ gekennzeichnet.
- **Eine Seite pro Testnutzer:** Anzeigename, Nutzername, Sprache, Gruppen (hinzufügen, entfernen, Rolle Besitzer/Mitglied) und Freundschaften. Beim Hinzufügen zu einer Gruppe mit echten Mitgliedern kommt eine Warnung. Zur Auswahl stehen nur Gruppen, in denen du selbst Mitglied bist, und reine Testnutzer-Gruppen, damit das Werkzeug nicht in fremden Gruppen stöbert. Entfernen geht auch mit offenem Saldo nach Bestätigung, die Ausgaben bleiben.
- **„Handeln als“:** Ein Klick, und du siehst die App wie der Testnutzer (Gruppen, Salden, Benachrichtigungen) und kannst für ihn Ausgaben anlegen, kommentieren und Zahlungen verbuchen. Ein Banner „Du handelst als … (Testnutzer)“ mit „Zurück zum Admin“ bleibt sichtbar. Als Testnutzer hast du keinen Zugriff auf Admin-Seiten. Im Ausgabenverlauf und bei Kommentaren steht „durch Admin …“.
- **Löschen:** Gruppen, Ausgaben und Zahlungen, an denen nur Testnutzer beteiligt sind, werden mitgelöscht. Hängen Daten des Testnutzers in einer Gruppe mit echten Nutzern, wird **nichts** gelöscht und die App nennt die betroffenen Gruppen. Bloße Mitgliedschaften werden aufgelöst.
- **Schalter „Testfunktionen“:** Im lokalen Test (`docker-compose.local.yml`) standardmäßig an. **Im produktiven Stack ist er standardmäßig aus**, weil dort `TEST_FEATURES_DEFAULT` nicht gesetzt ist. Eine bewusste Wahl im Admin-Bereich hat Vorrang. Siehe `docs/release-checkliste.md`.

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
