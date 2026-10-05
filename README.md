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

Nützlich: `docker compose -f docker-compose.local.yml logs -f app` (Logs), `... down` (stoppen, Daten bleiben), `... down -v` (stoppen und Daten löschen), anderer Port: `LOCAL_PORT=3001 docker compose -f docker-compose.local.yml up --build`. Optionale Funktionen: `ANTHROPIC_API_KEY=sk-... docker compose -f docker-compose.local.yml up --build` aktiviert den Belegscan. Mails landen lokal im Test-Postfach Mailpit unter <http://localhost:8025>.

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

### E-Mail-Versand (optional)
Ohne Mailserver gibt der Admin Einmal-Links selbst weiter. Eingerichtet wird er **entweder** in der `.env` (`SMTP_URL`, z. B. `smtps://user:passwort@mail.example.org:465`, und `MAIL_FROM`) **oder** im Admin-Bereich (*Konto → Nutzer verwalten → E-Mail-Versand*: Server, Port, Verschlüsselung, Zugang, Absender; das Passwort liegt mit `APP_SECRET` verschlüsselt in der Datenbank und wird nie angezeigt). Die `.env` hat Vorrang. Der Knopf „Test-E-Mail an mich“ prüft die Zugangsdaten (bei Fehlern zeigt er die Meldung des Servers). Dann gilt:
- **Einmal-Links** (Aktivierung, Passwort neu setzen) gehen zusätzlich an die hinterlegte Adresse; der Admin sieht den Link weiterhin und einen Hinweis, ob der Versand geklappt hat.
- **„Passwort vergessen?“** erscheint auf der Anmeldeseite (im Admin-Bereich abschaltbar). Die Antwort ist immer gleich, egal ob es das Konto gibt; begrenzt pro IP (10/Stunde) und pro Konto (3/Stunde). Zwei-Faktor bleibt danach nötig.
- **Benachrichtigungen per E-Mail** (neue Ausgabe, Kommentar, Wiederherstellung) und eine **wöchentliche Zusammenfassung** der offenen Salden (montags ab 06:00 UTC, nur wenn etwas offen ist) kann jede Person unter *Konto → E-Mail* einschalten; beides ist standardmäßig aus.
- Testnutzer, Gäste, deaktivierte Konten und Konten ohne Adresse bekommen nie Mails. Mails sind reiner Text in der Sprache des Empfängers; die Links nutzen `APP_URL`.

Für den lokalen Test (`docker-compose.local.yml`) läuft **Mailpit** mit: alle Mails landen unter <http://localhost:8025>, nichts verlässt den Rechner.

### Aufteilungsarten
Gleich, **gleich mit Anpassungen** (z. B. „Anna +5 €, Ben −2 €, Rest gleich“: erst die Anpassungen abziehen, den Rest gleich teilen, dann die Anpassung je Person addieren), Prozent, feste Beträge, Anteile (ganze Zahlen), Einzelposten mit Steuer/Trinkgeld und „eine Person trägt alles“. Summe der Anteile ist immer exakt der Betrag.

### Rechner und Kopieren
Im Betragsfeld darf man rechnen, z. B. `12,50+3*4` oder `(30+15)/3`: darunter steht das Ergebnis, beim Verlassen des Felds wird es übernommen (exakt gerechnet, kaufmännisch gerundet). Auf dem Handy schaltet der Knopf „±×“ auf eine Tastatur mit Rechenzeichen. Auf der Seite einer Ausgabe legt **„Kopieren“** eine neue Ausgabe mit denselben Werten an (Datum heute, Kurs neu).

### Erinnern
Schuldet dir jemand laut Ausgleichsvorschlag Geld, steht im Reiter *Salden* daneben **„Erinnern“**. Die Person bekommt eine Benachrichtigung „Anna erinnert dich: Du schuldest 23,50 € in WG“ (In-App, Push, E-Mail falls eingeschaltet), die zu den Salden führt. Höchstens einmal pro Tag je Person und Gruppe; Mitglieder ohne Konto können nicht erinnert werden.

### Bezahlen beim Begleichen
Unter *Konto → Bezahldaten* kann jede Person optional **IBAN mit Kontoinhaber** und/oder ihren **PayPal.me-Namen** hinterlegen (Ändern nur mit Passwort). Wer ihr in einer gemeinsamen Gruppe laut Ausgleichsvorschlag Geld schuldet, sieht im Reiter *Salden* „Bezahlen an …“: einen **GiroCode** (EPC-QR, nur Euro, jede Banking-App füllt Empfänger, IBAN, Betrag und Verwendungszweck aus), die IBAN zum Kopieren und einen **PayPal.me-Link mit Betrag**. Die App bewegt kein Geld; danach trägt man die Zahlung wie gewohnt mit „Begleichen“ ein. Andere sehen die Bezahldaten nie, auch nicht im Export.

### Konten, Anmeldung und Passwörter
- **Anmeldung** mit Nutzername (3–32 Zeichen, a–z 0–9 . _ -, eindeutig) oder E-Mail. Die E-Mail ist optional und wird nicht verifiziert; sie wird nur genutzt, wenn ein Mailserver eingerichtet ist (siehe „E-Mail-Versand“). Jede Person kann ihre Adresse unter *Konto* ändern (mit Passwort). Standardmäßig darf eine E-Mail nur einmal vorkommen. Erlaubt der Admin Duplikate, fragt der Login bei mehreren passenden Konten nach, welches gemeint ist.
- **Konten legt der Admin an** (*Konto → Nutzer verwalten*): entweder mit einem **Einmal-Link**, über den der Nutzer sein Passwort selbst wählt (Standard 72 Stunden gültig, einstellbar, nur einmal verwendbar, ein neuer Link ersetzt den alten), oder mit einem vom Admin gesetzten Passwort, das beim ersten Login geändert werden muss (abwählbar). Den Link gibt der Admin selbst weiter; mit Mailserver geht er zusätzlich an die hinterlegte E-Mail. „Passwort vergessen“ läuft genauso über einen neuen Link (mit Mailserver auch als Selbstbedienung auf der Anmeldeseite).
- **Selbstregistrierung** ist standardmäßig aus. Der Admin kann sie einschalten; neue Konten warten dann auf seine **Freigabe**.
- **Passwortrichtlinie** (überall gleich, auch beim Admin-Setzen): mindestens 20 Zeichen (höchstens 200), je ein Groß- und Kleinbuchstabe, eine Ziffer, ein Sonderzeichen (Leerzeichen zählt, daher gehen auch Passphrasen), und das Passwort enthält weder den Nutzernamen noch die E-Mail. Ändern geht nur mit dem aktuellen Passwort und nicht auf dasselbe Passwort; danach werden alle anderen Geräte abgemeldet.
- **Schutz vor Raten:** Nach 5 Fehlversuchen pro Konto steigt die Wartezeit (30 s, dann verdoppelt, höchstens 15 Minuten); zusätzlich Begrenzung pro IP.
- **Admin-Verwaltung:** Konten anlegen, freigeben, Einmal-Link erzeugen, Passwort setzen, deaktivieren (Sitzungen enden sofort, Ausgaben und Salden bleiben erhalten) und wieder aktivieren, Admin-Recht vergeben oder entziehen. Es kann mehrere Admins geben; der letzte aktive Admin kann sich weder degradieren noch deaktivieren.
- **Zwei-Faktor-Anmeldung (TOTP):** Jeder kann sie unter *Konto* freiwillig einrichten (Authenticator-App, QR-Code oder Schlüssel). Der Admin kann sie **für alle** oder **für einzelne Konten verlangen**; wer sie braucht und noch nicht hat, muss sie nach dem Passwort zuerst einrichten, vorher geht nichts anderes. Beim Einrichten gibt es Wiederherstellungscodes (Standard 1, vom Admin auf 0 bis 20 einstellbar, jeder gilt einmal, unter *Konto* neu erzeugbar). Jeder Code (auch jeder TOTP-Code) gilt nur einmal; Fehlversuche haben eine eigene Wartezeit. Bei Geräteverlust setzt der Admin TOTP zurück. Ausschalten geht freiwillig nur mit Passwort und Code, nicht wenn es verlangt wird. Die Geheimnisse liegen mit `APP_SECRET` verschlüsselt in der Datenbank: **`APP_SECRET` ist Pflicht (mindestens 16 Zeichen) und darf nicht mehr geändert werden**, sonst sind alle TOTP-Konten unbenutzbar.
- **QR-Codes:** Zu jedem Einladungslink (Gruppe, Freund, Konto-Aktivierung) wird ein QR-Code angezeigt; scannen geht mit der normalen Handy-Kamera. Zusätzlich gibt es auf der Übersicht **„QR-Code scannen“**: Die App öffnet die Kamera und öffnet erkannte Einladungs- oder Verknüpfungslinks dieser App (andere Links nie). Ohne Kamera kann man den Link einfügen. 
- **Passkeys:** Unter *Konto → Zwei-Faktor* kann jeder mehrere benannte Passkeys einrichten (nur mit erneuter Passworteingabe; Löschen ebenso). Anmeldung: Nutzername eingeben, dann „Mit Passkey anmelden“. Der Passkey ersetzt Passwort **und** TOTP; das Passwort bleibt Pflicht und Rückfall. Ein Passkey erfüllt den TOTP-Zwang des Admins; wer nur einen Passkey als zweiten Faktor hat, kann sich bei Zwang nicht allein mit dem Passwort anmelden. Der Admin kann Passkeys nicht erzwingen, aber zusammen mit TOTP zurücksetzen. Ein Passkey gilt nur für die Domain, unter der er angelegt wurde (bei Domainwechsel neu einrichten).

### Admin-Testfunktionen (Testnutzer)
Zum Ausprobieren legt der Admin unter *Konto → Nutzer verwalten → Testnutzer verwalten* **Testnutzer** an (einzeln mit eigenem Namen oder mehrere auf einmal: `test-1`, `test-2`, …). Testnutzer haben **kein Passwort** und können sich **nie** selbst anmelden, auch nicht über Einmal-Link, Registrierung oder Passwort-Zurücksetzen. Sie werden überall mit „(Test)“ gekennzeichnet.
- **Eine Seite pro Testnutzer:** Anzeigename, Nutzername, Sprache, Gruppen (hinzufügen, entfernen, Rolle Besitzer/Mitglied) und Freundschaften. Beim Hinzufügen zu einer Gruppe mit echten Mitgliedern kommt eine Warnung. Zur Auswahl stehen nur Gruppen, in denen du selbst Mitglied bist, und reine Testnutzer-Gruppen, damit das Werkzeug nicht in fremden Gruppen stöbert. Entfernen geht auch mit offenem Saldo nach Bestätigung, die Ausgaben bleiben.
- **„Handeln als“:** Ein Klick, und du siehst die App wie der Testnutzer (Gruppen, Salden, Benachrichtigungen) und kannst für ihn Ausgaben anlegen, kommentieren und Zahlungen verbuchen. Ein Banner „Du handelst als … (Testnutzer)“ mit „Zurück zum Admin“ bleibt sichtbar. Als Testnutzer hast du keinen Zugriff auf Admin-Seiten. Im Ausgabenverlauf und bei Kommentaren steht „durch Admin …“.
- **Löschen:** Gruppen, Ausgaben und Zahlungen, an denen nur Testnutzer beteiligt sind, werden mitgelöscht. Hängen Daten des Testnutzers in einer Gruppe mit echten Nutzern, wird **nichts** gelöscht und die App nennt die betroffenen Gruppen. Bloße Mitgliedschaften werden aufgelöst.
- **Schalter „Testfunktionen“:** Im lokalen Test (`docker-compose.local.yml`) standardmäßig an. **Im produktiven Stack ist er standardmäßig aus**, weil dort `TEST_FEATURES_DEFAULT` nicht gesetzt ist. Eine bewusste Wahl im Admin-Bereich hat Vorrang. Siehe `docs/release-checkliste.md`.

### Mitglieder ohne Konto (Gäste)
In einer Gruppe unter *Mitglieder → Mitglieder ohne Konto* legt jedes Mitglied Personen ohne eigenes Konto an (z. B. Kinder, Großeltern). Sie zahlen, bekommen Anteile und haben einen Saldo wie alle anderen, sind mit „(Gast)“ gekennzeichnet, bekommen keine Benachrichtigungen und können sich nie anmelden. Später erzeugt ein Mitglied einen **Verknüpfungs-Link** (7 Tage, einmalig, mit QR-Code): Wer ihn mit seinem Konto einlöst, übernimmt alle Ausgaben, Zahlungen und Salden des Gasts. War das Konto schon Mitglied, werden die Beträge zusammengefasst. Löschen geht nur, solange ein Gast keine Ausgaben oder Zahlungen hat.

### Archiv und Export
- **Gruppe archivieren** (*Mitglieder → Gruppe archivieren*): nur für dich; die Gruppe steht dann unten in der Übersicht im Bereich „Archiv“. Salden zählen weiter, andere Mitglieder merken nichts.
- **CSV-Export je Gruppe** (*Mitglieder → Als CSV exportieren*): eine Zeile je Ausgabe und Zahlung, je Person „bezahlt“ und „Anteil“, am Ende die Salden. Deutsche Oberfläche: `;` und Dezimalkomma, englische: `,` und Punkt. Formeln in Titeln werden entschärft.
- **Konto-Export** (*Konto → Meine Daten exportieren*): alle eigenen Gruppen mit Ausgaben, Zahlungen und Salden als JSON, ohne Passwörter, 2FA-Geheimnisse oder Passkeys.

### Wiederkehrende Ausgaben
In jeder Gruppe unter den Ausgaben („Wiederkehrende Ausgaben“): Vorlage mit Rhythmus (alle N Tage/Wochen/Monate/Jahre), erstem Termin und optionalem Enddatum. Die App bucht zum Termin automatisch eine normale Ausgabe (Kurs zum Buchungstag, andere Mitglieder werden benachrichtigt) und holt verpasste Termine nach, auch nach einem Neustart. Der Gruppenbesitzer kann die Verwaltung auf Besitzer beschränken. Der Zeitplaner läuft im App-Prozess (beim Start und alle 15 Minuten); mit `SCHEDULER=off` ist er abgeschaltet.

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
Einfacher mit den Skripten: `scripts/backup.sh` legt einen Dump in `./backups` ab (behält die letzten 14; Cron-Zeile steht im Skript). `scripts/restore-check.sh <dump> <Quell-URL> <Admin-URL>` spielt einen Dump in eine Wegwerf-Datenbank zurück und vergleicht Zeilenzahlen (zur Prüfung, dass die Sicherung brauchbar ist).
**Sichere zusätzlich `APP_SECRET` aus der `.env`** (getrennt vom Dump): Ohne ihn sind eingerichtete TOTP-Konten nach einer Wiederherstellung unbenutzbar. Sichere die Dumps außerhalb des Servers (z. B. per Cron + `rclone`/`rsync`).

### Sicherheits-Header
Die App sendet `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` und (produktiv) eine Content-Security-Policy (nur eigene Herkunft, kein Einbetten); Caddy ergänzt HSTS. `npm audit --omit=dev` meldet keine bekannten Schwachstellen (Stand Next.js 16).

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
