# Fragebogen 7: E-Mail-Versand, QR-Scanner, weitere Belegscan-Anbieter

So füllst du ihn aus: Kreuze mit `[x]` an oder schreibe unter **Antwort**. Mit "(Empfehlung)" markiere ich, was ich nehme. **Ich baue bereits nach den Empfehlungen** (du bist bis 17 Uhr weg und wolltest, dass ich alle optionalen Punkte abarbeite). Was du anders ankreuzt, ändere ich danach.

---

## Schon entschieden (nur zur Kontrolle, bitte nicht ausfüllen)

- Alle drei optionalen Punkte werden gebaut: E-Mail-Versand (SMTP), QR-Codes in der App scannen, weitere Belegscan-Anbieter.
- Ohne Konfiguration bleibt alles wie bisher (kein Mailversand, Belegscan nur mit Schlüssel).
- Lizenzen: nur freizügige Bibliotheken (`nodemailer`: MIT-0, `jsqr`: Apache-2.0).

---

## Frage 1: Welche E-Mails soll die App verschicken?

- [x] **Einmal-Links** (Konto aktivieren, Passwort neu setzen) an die hinterlegte E-Mail, zusätzlich zur Anzeige für den Admin (Empfehlung)
- [x] **„Passwort vergessen“ auf der Anmeldeseite** (Selbstbedienung), nur wenn SMTP eingerichtet ist; vom Admin abschaltbar (Empfehlung)
- [x] **Benachrichtigungen per E-Mail** (neue Ausgabe, Kommentar, Wiederherstellung), **pro Person einschaltbar, Standard aus** (Empfehlung)
- [x] Wöchentliche Zusammenfassung der offenen Salden, **pro Person einschaltbar, Standard aus**

Antwort / Anmerkung: ich habe zu "Wöchentliche Zusammenfassung der offenen Salden" hinzugefügt: ", **pro Person einschaltbar, Standard aus**"

## Frage 2: Wo konfiguriere ich den Mailserver?

- [x] **In der `.env`** (`SMTP_URL`, `MAIL_FROM`), wie alle anderen Zugangsdaten. Admin-Seite zeigt nur „E-Mail aktiv/aus“ und hat einen Knopf „Test-E-Mail an mich“. (Empfehlung, keine Passwörter in der Datenbank)
- [x] Im Admin-Bereich der App (Zugangsdaten in der Datenbank)

Antwort / Anmerkung:

## Frage 3: QR-Scanner in der App

- [x] **Knopf „QR-Code scannen“ auf der Übersicht**: öffnet die Kamera, erkennt Einladungs- und Verknüpfungslinks dieser App und öffnet sie. Fremde Links werden nicht geöffnet, nur angezeigt. Ohne Kamera gibt es ein Feld zum Einfügen des Links. (Empfehlung)
- [ ] Zusätzlich Belege per QR-Code (z. B. Rechnungs-QR) auslesen

Antwort / Anmerkung:

## Frage 4: Welche weiteren Belegscan-Anbieter?

- [ ] **OpenAI** (GPT mit Bilderkennung) über API-Schlüssel (Empfehlung)
- [ ] **Beliebiger OpenAI-kompatibler Dienst**, z. B. ein **lokales Modell mit Ollama** auf deinem Server: die Fotos verlassen dann dein Netz nicht (Empfehlung)
- [ ] Google Gemini

Antwort / Anmerkung: bevor das feature angegangen wird, planen wir das bitte nochmal gemeinsam

---

## Meine Annahmen (gelten, wenn du nichts anderes schreibst)

1. Mails gehen nur an E-Mail-Adressen, die im Konto hinterlegt sind. Die Adressen werden nicht verifiziert (wie bisher).
2. „Passwort vergessen“ verrät nie, ob es ein Konto oder eine E-Mail gibt (immer dieselbe Antwort) und ist pro IP und Konto begrenzt. Bei Konten mit Zwei-Faktor bleibt der zweite Faktor nach dem Zurücksetzen nötig.
3. Testnutzer, Gäste und deaktivierte Konten bekommen nie Mails.
4. Belegscan-Anbieter wählt der Betreiber in der `.env` (`RECEIPT_SCAN_PROVIDER`); in der App sieht man keinen Unterschied.
5. Der QR-Scanner nutzt die eingebaute Barcode-Erkennung des Browsers, wo vorhanden, sonst eine mitgelieferte Bibliothek (auch für iPhone).

---

## Umsetzung (meine Auslegung deiner Antworten)

**Frage 1 – E-Mails:** alle vier Punkte gebaut.
- Einmal-Links gehen zusätzlich an die hinterlegte Adresse; der Admin sieht den Link weiterhin und einen Hinweis, ob der Versand geklappt hat.
- „Passwort vergessen?“ auf der Anmeldeseite, nur mit Mailserver; im Admin-Bereich abschaltbar (Standard an). Immer dieselbe Antwort, Begrenzung pro IP (10/Stunde) und pro Konto (3/Stunde). Zwei-Faktor bleibt nach dem Zurücksetzen nötig.
- Benachrichtigungen per E-Mail (neue Ausgabe, Kommentar, Wiederherstellung), unter *Konto → E-Mail* pro Person einschaltbar, Standard aus.
- Wöchentliche Zusammenfassung der offenen Salden, pro Person einschaltbar, Standard aus. Versand montags ab 06:00 UTC (verpasste Läufe werden in derselben Woche nachgeholt), nur wenn etwas offen ist, die erste erst in der Woche nach dem Einschalten.
- Damit jemand Mails bekommen kann, kann jede Person ihre E-Mail-Adresse jetzt selbst unter *Konto* ändern (nur mit aktuellem Passwort, gegen Übernahme per „Passwort vergessen“).

**Frage 2 – Mailserver:** beides angekreuzt, beides gebaut. `.env` (`SMTP_URL`, `MAIL_FROM`) hat Vorrang; dann ist das Formular im Admin-Bereich gesperrt. Ohne `.env` richtet der Admin Server, Port, Verschlüsselung, Zugang und Absender im Admin-Bereich ein. Das Passwort wird mit `APP_SECRET` verschlüsselt gespeichert und nie wieder angezeigt (leer lassen = behalten; bei anderem Server oder Benutzer wird es nicht übernommen). „Test-E-Mail an mich“ zeigt bei Fehlern die Meldung des Mailservers.

**Frage 3 – QR-Scanner:** wie empfohlen gebaut (schon im letzten Stand).

**Frage 4 – Belegscan-Anbieter:** **nicht gebaut**, wie gewünscht planen wir das vorher gemeinsam. Ein Entwurf (OpenAI und OpenAI-kompatibel, z. B. Ollama, mit Tests) lag schon vor; ich habe ihn wieder herausgenommen und baue ihn erst nach unserer Abstimmung.

**Zusätzlich für den lokalen Test:** `docker-compose.local.yml` startet das Test-Postfach **Mailpit** (MIT-Lizenz). Alle Mails erscheinen unter http://localhost:8025, nichts verlässt den Rechner. Der Test-Agent prüft die Mails dort (Tester-Guide Abschnitt 6b).
