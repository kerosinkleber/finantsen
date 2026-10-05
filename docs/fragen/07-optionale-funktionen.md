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
- [ ] Wöchentliche Zusammenfassung der offenen Salden

Antwort / Anmerkung:

## Frage 2: Wo konfiguriere ich den Mailserver?

- [x] **In der `.env`** (`SMTP_URL`, `MAIL_FROM`), wie alle anderen Zugangsdaten. Admin-Seite zeigt nur „E-Mail aktiv/aus“ und hat einen Knopf „Test-E-Mail an mich“. (Empfehlung, keine Passwörter in der Datenbank)
- [ ] Im Admin-Bereich der App (Zugangsdaten in der Datenbank)

Antwort / Anmerkung:

## Frage 3: QR-Scanner in der App

- [x] **Knopf „QR-Code scannen“ auf der Übersicht**: öffnet die Kamera, erkennt Einladungs- und Verknüpfungslinks dieser App und öffnet sie. Fremde Links werden nicht geöffnet, nur angezeigt. Ohne Kamera gibt es ein Feld zum Einfügen des Links. (Empfehlung)
- [ ] Zusätzlich Belege per QR-Code (z. B. Rechnungs-QR) auslesen

Antwort / Anmerkung:

## Frage 4: Welche weiteren Belegscan-Anbieter?

- [x] **OpenAI** (GPT mit Bilderkennung) über API-Schlüssel (Empfehlung)
- [x] **Beliebiger OpenAI-kompatibler Dienst**, z. B. ein **lokales Modell mit Ollama** auf deinem Server: die Fotos verlassen dann dein Netz nicht (Empfehlung)
- [ ] Google Gemini

Antwort / Anmerkung:

---

## Meine Annahmen (gelten, wenn du nichts anderes schreibst)

1. Mails gehen nur an E-Mail-Adressen, die im Konto hinterlegt sind. Die Adressen werden nicht verifiziert (wie bisher).
2. „Passwort vergessen“ verrät nie, ob es ein Konto oder eine E-Mail gibt (immer dieselbe Antwort) und ist pro IP und Konto begrenzt. Bei Konten mit Zwei-Faktor bleibt der zweite Faktor nach dem Zurücksetzen nötig.
3. Testnutzer, Gäste und deaktivierte Konten bekommen nie Mails.
4. Belegscan-Anbieter wählt der Betreiber in der `.env` (`RECEIPT_SCAN_PROVIDER`); in der App sieht man keinen Unterschied.
5. Der QR-Scanner nutzt die eingebaute Barcode-Erkennung des Browsers, wo vorhanden, sonst eine mitgelieferte Bibliothek (auch für iPhone).
