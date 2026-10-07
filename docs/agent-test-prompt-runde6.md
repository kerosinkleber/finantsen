# Testrunde 6: Abschluss vor dem Release

Drei Teile, je ein eigener Prompt:

- **A – NAS-Session:** Push-Schlüssel eintragen und das richtige Image einspielen. Kommt zuerst.
- **B – Test-Agent am PC (Browser):** alles, was nicht das Handy braucht.
- **C – Wrapper-Session (Handy):** nur, was es ausschließlich im Wrapper gibt.

Voraussetzung: Der Release-Probelauf auf der Test-NAS ist erledigt (frische Datenbank, Admin eingerichtet).

---

## A – NAS-Session: Vorbereitung

```
Auftrag: Test-NAS für Testrunde 6 vorbereiten. Es gelten dieselben Regeln wie bisher:
- Arbeite nur in /volume1/docker/finantsen und nur am Compose-Projekt "finantsen".
- Fass keine anderen Container an. Kein prune. Kein `down -v`.
- Gib keine Geheimnisse aus. Tippe keine Passwörter ein. sudo nicht versuchen.

1. Image mit den neuesten Korrekturen
   - In der .env die Zeile FINANTSEN_TAG setzen:
     - FINANTSEN_TAG=latest, wenn main inzwischen Commit ecff3eb oder neuer enthält. Frag mich,
       wenn du dir nicht sicher bist.
     - Sonst FINANTSEN_TAG=claude-magical-feynman-h8qjkz.
   - `docker compose pull app`, dann die Revision prüfen:
     `docker image inspect ghcr.io/kerosinkleber/finantsen:<Tag> --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'`
     Erwartet: ecff3eb… oder neuer.

2. Push-Schlüssel (VAPID) erzeugen, ohne sie anzuzeigen
   - Nur wenn in der .env noch kein nicht-leeres VAPID_PRIVATE_KEY steht
     (`grep -cE '^VAPID_PRIVATE_KEY=.+' .env` ergibt 0).
   - Leere VAPID_*-Zeilen aus der .env entfernen. Danach die Schlüssel direkt in die .env
     schreiben, ohne Bildschirmausgabe:
       docker compose exec -T app node -e "const k=require('web-push').generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey);console.log('VAPID_PRIVATE_KEY='+k.privateKey)" >> .env
     Falls `web-push` im Container nicht gefunden wird, stattdessen:
       docker run --rm node:22-alpine sh -c "cd /tmp && npm i -s web-push >/dev/null 2>&1 && node -e \"const k=require('web-push').generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey);console.log('VAPID_PRIVATE_KEY='+k.privateKey)\"" >> .env
   - Zusätzlich `VAPID_SUBJECT=https://finantsen.jm-pt.de` eintragen.
   - Prüfen, dass jede der drei Variablen genau einmal mit Wert vorkommt (`grep -c`, keine
     Werte zeigen). Die Schlüssel dürfen später nicht mehr geändert werden, sonst müssen alle
     Push neu einschalten.

3. APP_URL
   Frag mich, ob die App ab jetzt hauptsächlich über https://finantsen.jm-pt.de:8443 genutzt
   wird. Wenn ja: APP_URL auf diese Adresse setzen. Sie wird für Links in Einladungen und
   Benachrichtigungen benutzt.

4. `docker compose up -d`. Warten, bis /api/health "ok" liefert. In den Logs darf kein
   Fehler stehen.

5. Bericht: Tag und Revision, ob die VAPID-Schlüssel gesetzt sind (ja/nein, keine Werte),
   APP_URL (die Adresse darfst du nennen).
```

---

## B – Test-Agent am PC

```
Du bist ein sorgfältiger QA-Tester für die Web-App Finantsen (geteilte Ausgaben). Dies ist
Testrunde 6. Du prüfst gezielt Restpunkte vor dem Release. Du änderst keinen Quellcode.

Umgebung
- Getestet wird nur im Browser auf diesem PC unter https://finantsen.jm-pt.de:8443 (Test-NAS).
  Keine anderen Adressen. Kein Docker, keine Befehle auf der NAS.
- Der Auftraggeber meldet dich an. Du tippst keine Passwörter. Wenn ein Schritt ein Passwort
  braucht (zweites Konto anlegen, Bezahldaten speichern), bitte mich genau an dieser Stelle.
- Nur erfundene Daten mit Präfix qa-. Gruppe für alles: `qa-runde6` (EUR).
- Spezifikation: docs/tester-guide.md im Projektordner (Abschnitte 4, 5, 8, 8d). Vorher
  `git pull` im Ordner finantsen (Zweig claude/magical-feynman-h8qjkz), nur lesen.
- Bericht: test-report/bericht-runde6-<Datum>.md, sonst schreibst du nichts.

Vorbereitung
- Gruppe qa-runde6 anlegen. Im Reiter Mitglieder zwei Gäste anlegen: qa-anna, qa-ben.
- „Ich“ ist im Folgenden das angemeldete Admin-Konto.

1. Rest-Cent geht an den Zahler (Tester-Guide 4)
   Regel: Lässt sich ein Betrag nicht glatt aufteilen, bekommt der Zahler den ersten
   übrigen Cent, aber nur, wenn sein eigener genauer Anteil nicht glatt ist. Weitere Cents
   gehen nach dem größten Nachkommarest. Niemand liegt mehr als 1 Cent neben seinem genauen
   Anteil.
   Jede Ausgabe anlegen, die Detailseite öffnen und die Anteile notieren. Die Summe der
   Anteile muss immer genau dem Betrag entsprechen.

   | ID | Ausgabe | Zahler | Aufteilung | Erwartete Anteile |
   |---|---|---|---|---|
   | 1.1 | qa-gleich 10,00 € | ich | gleich auf alle drei | ich 3,34, Anna 3,33, Ben 3,33 |
   | 1.2 | qa-prozent 0,07 € | ich | Prozent: ich 20, Anna 30, Ben 50 | ich 0,02, Anna 0,02, Ben 0,03 |
   | 1.3 | qa-anteile 0,10 € | ich | Anteile: ich 1, Anna 2, Ben 4 | ich 0,02, Anna 0,03, Ben 0,05 |
   | 1.4 | qa-anpassung 10,01 € | ich | Gleich mit Anpassungen: Ben +1,00 | ich 3,01, Anna 3,00, Ben 4,00 |
   | 1.5 | qa-posten | ich | Einzelposten: Pizza 10,00 (alle drei), Wein 5,00 (ich und Anna) | ich 5,84, Anna 5,83, Ben 3,33 (Summe 15,00) |
   | 1.6 | qa-glatt 0,10 € | ich | Prozent: ich 50, Anna 25, Ben 25 | ich genau 0,05; der übrige Cent geht an Anna oder Ben (0,03 und 0,02) |
   | 1.7 | qa-zwei-zahler 10,00 € | Anna 7,00 und ich 3,00 | gleich auf alle drei | Anna 3,34, ich 3,33, Ben 3,33 (Hauptzahler ist Anna) |

   Zusätzlich: 1.1 bearbeiten und unverändert speichern. Die Anteile bleiben gleich. Nach
   allen Buchungen den Reiter Salden prüfen. Die Salden müssen zu den Anteilen passen, bitte
   nachrechnen.

2. Zahlung verbuchen ohne Betrag (Tester-Guide 5)
   - Reiter Salden → der allgemeine Link „Zahlung verbuchen“ (nicht der Vorschlag). Das
     Betragsfeld ist leer.
   - Ohne Betrag „Zahlung speichern“ drücken. Erwartet: Es wird nicht gespeichert, und
     sichtbar erscheint ein Hinweis am Feld (Browser-Sprechblase). Bitte Screenshot.
   - Betrag 0 bzw. „abc“: Es erscheint eine Fehlermeldung „Ungültiger Betrag“ im sichtbaren
     Bereich. Nichts wird gespeichert.

3. Bezahlbox mit GiroCode und PayPal (Tester-Guide 5, „Paying when settling up“)
   - Zweites Konto qa-b anlegen (Nutzer verwalten; das Passwort setze ich). In qa-runde6
     einladen bzw. hinzufügen.
   - Als qa-b: Konto → Bezahldaten: IBAN DE89 3704 0044 0532 0130 00, Kontoinhaber
     „qa B“, PayPal qa-b. Speichern verlangt das Passwort, also mich holen.
   - Als ich: eine Ausgabe 20,00 €, bezahlt von qa-b, gleich auf mich und qa-b.
   - Als ich: Reiter Salden → Ich schulde qa-b 10,00 €. Die Bezahlbox zeigt IBAN, Inhaber,
     GiroCode (QR) und den PayPal-Link mit 10,00. „Kopieren“ der IBAN zeigt „Kopiert“.
   - Als qa-b: Bei qa-b erscheint keine Bezahlbox für die eigenen Daten.

4. Große Schrift: „Suchen & filtern“ (Tester-Guide 8d)
   - Fenster bzw. Gerätesimulation 360 px breit, Schrift 200 % (in den DevTools auf `html`
     `font-size: 200%` setzen oder Browser-Zoom 200 %).
   - Gruppe → Ausgaben → „Suchen & filtern“ aufklappen. Erwartet: kein seitliches Scrollen
     (`document.documentElement.scrollWidth <= clientWidth`), Felder untereinander,
     „Zahlungsart“ vollständig lesbar, „Zurücksetzen“ ganz sichtbar.

5. Offline-Hinweis verschwindet von selbst (Tester-Guide 8d)
   - In den DevTools unter Network-Request-Blocking das Muster `*/api/*` sperren. Eine
     Ausgabe speichern. Erwartet: Meldung „Keine Verbindung zum Server …“ sichtbar, gelber
     Offline-Balken oben, Eingaben bleiben.
   - Sperre aufheben, nichts anklicken. Erwartet: Der gelbe Balken verschwindet innerhalb von
     etwa 5 Sekunden von selbst. Danach einmal speichern: Die Ausgabe gibt es genau einmal.

6. Über HTTPS: Installieren und Offline-Lesen (Tester-Guide 8)
   - In Chrome bzw. Edge: Die Adresszeile bietet „App installieren“ an. Einstellungen zeigen
     keinen Kasten „Ohne HTTPS …“.
   - Übersicht und Gruppe öffnen, dann in den DevTools Network auf „Offline“ stellen und
     neu laden: Die schon besuchten Seiten sind lesbar, mit Offline-Hinweis. Eine nie
     besuchte Seite zeigt die Offline-Seite. Danach wieder online.
   - Abmelden, dann offline gehen: Die Seiten des vorherigen Kontos dürfen nicht mehr
     angezeigt werden (Cache wird beim Abmelden geleert).

7. Push-Benachrichtigungen (Tester-Guide 6), nur wenn die NAS-Session VAPID eingerichtet hat
   - Als qa-b in einem zweiten Browserprofil bzw. Inkognito-Fenster mit Benachrichtigungen
     erlaubt: Einstellungen → „Push aktivieren“ → Browser-Erlaubnis geben.
   - Als ich: in qa-runde6 eine Ausgabe mit qa-b anlegen. Erwartet: qa-b bekommt eine
     System-Benachrichtigung. Ein Klick darauf öffnet die Ausgabe bzw. die Gruppe.
   - „Push deaktivieren“ bei qa-b funktioniert. Danach kommt keine Push-Nachricht mehr.

Bericht (Deutsch)
1. Zusammenfassung: Image-Stand (falls sichtbar), PASS/FAIL/BLOCKED/SKIPPED, wichtigste Probleme.
2. Tabelle: ID | Schritt | Erwartet | Tatsächlich | Ergebnis | Beleg.
3. Fehlerliste nach Schwere, mit Schritten zur Reproduktion.
4. Beobachtungen, nicht Getestetes mit Grund, angelegte Testdaten.
Räume nichts auf. Gib am Ende den Pfad zum Bericht an.
```

---

## C – Wrapper-Session (Handy)

```
Testrunde 6, nur Wrapper-spezifisches. Der Rest läuft am PC. Gleiche Regeln wie bisher:
- keine Passwörter
- eigene Gruppe „WRAPPER-TEST <Datum>“, am Ende löschen
- Bericht mit getrennten Listen für Web-App-Bugs und Wrapper-Bugs

Adresse: https://finantsen.jm-pt.de:8443/ (Image ecff3eb oder neuer).

1. A5 nachprüfen: Schriftgröße 2.0 → Gruppe → Ausgaben → „Suchen & filtern“ aufklappen.
   Erwartet: scrollWidth <= clientWidth (360), Felder untereinander, „Zahlungsart“ lesbar,
   „Zurücksetzen“ ganz sichtbar.
2. A6 nachprüfen: Flugmodus an, eine Ausgabe speichern → Meldung und Offline-Balken.
   Flugmodus aus, nichts antippen. Erwartet: Der Balken verschwindet nach höchstens etwa
   10 Sekunden von selbst. Einmal speichern → genau ein Eintrag.
3. QR-Scan mit Kamera (nach dem Wrapper-Fix für die Kamera-Berechtigung): Übersicht →
   „QR-Code scannen“ → Kamera-Erlaubnis geben → den Einladungs-QR einer zweiten Testgruppe
   vom PC-Bildschirm scannen. Erwartet: /join/<code> öffnet sich. Ein fremder QR-Code
   (z. B. eine beliebige Webadresse) wird abgelehnt.
4. Bitwarden (nach dem Wrapper-Fix): Ausfüllen wird auf /login angeboten. Auswählen und
   anmelden macht der User.
5. Push im Wrapper: Einstellungen → Push-Bereich. Eine WebView kann kein Web-Push. Erwartet
   ist deshalb der Hinweis „Dieser Browser unterstützt kein Push …“, kein Absturz und kein endloses Laden. Nur
   beobachten und berichten.
```
