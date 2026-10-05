# Fragebogen 8: Weitere Funktionen und Planung Belegscan-Anbieter

So füllst du ihn aus: Kreuze mit `[x]` an oder schreibe unter **Antwort**. Mit "(Empfehlung)" markiere ich, was ich nehme. **Diesmal baue ich erst nach deinen Antworten.** Es geht um neue Funktionen, und beim Belegscan wolltest du vorher gemeinsam planen.

Grundlage: Recherche bei Splitwise (inkl. Pro), Tricount, Settle Up, Splid, Splitser, Spliit und SplitPro (beide Open Source), Cospend, IHateMoney, dazu Nutzerwünsche aus App-Bewertungen und GitHub-Issues. Quellen stehen am Ende.

---

## Schon entschieden (nur zur Kontrolle, bitte nicht ausfüllen)

- E-Mail-Versand ist fertig (Fragebogen 7), ebenso der QR-Scanner.
- Performance ist geprüft und verbessert: große Gruppen bis zu 35-mal schneller, siehe `docs/performance.md`.
- Weitere Belegscan-Anbieter sind **nicht gebaut** (dein Wunsch: vorher planen). Ein Entwurf für OpenAI und OpenAI-kompatible Dienste ist schnell wieder da, siehe Frage 4.

---

## Frage 1: Welche neuen Funktionen willst du? (mehrere möglich)

Aufwand: **S** = bis ein Tag, **M** = einige Tage, **L** = deutlich mehr.

- [x] **Bezahlen beim Begleichen erleichtern** (S): Beim Vorschlag „Ben zahlt Anna 23,50 €“ erscheint ein **GiroCode/EPC-QR** (SEPA-Überweisung, jede deutsche Banking-App füllt Empfänger, IBAN und Betrag aus) und/oder ein **PayPal.me-Link** mit Betrag. Die App bewegt kein Geld, deshalb braucht es keine Lizenz. (Empfehlung, größter Nutzen)
- [x] **Aufteilung „gleich mit Anpassungen“** (S): z. B. „Anna +5 €, Rest gleich“. Splitwise hat das, und bei Spliit ist es ein häufiger Wunsch. (Empfehlung)
- [x] **Import** aus Splitwise (CSV-Export) und Tricount sowie allgemeine CSV (M): Wer umsteigt, nimmt seine Gruppen mit, unbekannte Personen werden zu Gästen. (Empfehlung)
- [x] **„Erinnern“-Knopf** bei offenen Schulden (S): schickt der Person eine Benachrichtigung (In-App, Push, E-Mail), höchstens einmal pro Tag und Person. (Empfehlung)
- [x] **Rechner im Betragsfeld** (`12,50+3*4`) und **„Ausgabe kopieren“** (S, beides zusammen). (Empfehlung)
- [x] **Belegfoto an Ausgabe speichern** (M): Bisher gilt „Bilder werden nie gespeichert“, das würde sich ändern. Details in Frage 3.
- [x] **Rückerstattung** (S–M): z. B. Pfand oder zurückgegebene Ware als eigene Buchungsart, die Salden in die Gegenrichtung bewegt. Heute sind nur positive Beträge möglich.
- [x] **Gruppenbudget** mit Warnung bei Überschreitung, je Monat oder Reise (M)
- [x] **Zahlungsart je Ausgabe** (bar, Karte, Konto) mit Filter und Statistik (S)
- [x] **Mehr Statistik**: je Person, Monatsverlauf, Durchschnitt (S)
- [ ] **Zahlenformat unabhängig von der Sprache** (z. B. Englisch mit 1.234,56) (S)
- [ ] **Abrechnung als PDF** (z. B. Reiseabschluss) (M)
- [ ] **Anmeldung über eigenen Identitätsdienst** (OIDC: Authentik, Keycloak, Nextcloud) (M), sinnvoll, wenn du so etwas schon betreibst
- [ ] **Kontoauszug-Import als Datei** (CSV/CAMT der Bank, bleibt auf deinem Server): Umsätze auswählen und als Ausgaben übernehmen (M–L)
- [ ] **Programmierschnittstelle (API) mit persönlichen Schlüsseln** für eigene Skripte (M)

**Nicht empfohlen**, nur zur Info:

- **Direkte Bankanbindung** (Umsätze automatisch abrufen): geht nur über lizenzierte Drittanbieter (PSD2). Der kostenlose Dienst GoCardless/Nordigen nimmt seit Juli 2025 keine Neukunden mehr, die Alternativen kosten Geld, und die Bankdaten laufen über Dritte. Das widerspricht dem Selbsthosten.
- **Bezahlen in der App** (wie Tricount/bunq oder Revolut): Dafür bräuchte es eine Zahlungsdienst-Lizenz oder einen Partner wie Stripe mit Gebühren und Identitätsprüfung.
- Antwort / Anmerkung:
"**Belegfoto an Ausgabe speichern**" was genau tut diese Funktion?

## Frage 2: Bezahldaten (nur wenn du „Bezahlen beim Begleichen“ willst)

- [x] **Jede Person hinterlegt unter „Konto“ optional IBAN (mit Name) und/oder PayPal.me-Namen.** Sichtbar ist das nur für Mitglieder gemeinsamer Gruppen, und nur dort, wo man dieser Person Geld schuldet. (Empfehlung)
- [ ] Bezahldaten je Gruppe statt je Konto
- [ ] Nur PayPal.me, keine IBAN
- [ ] Nur GiroCode/IBAN, kein PayPal

Antwort / Anmerkung:

## Frage 3: Belegfoto speichern (nur wenn du das willst)

- [x] **Auf deinem Server** (Docker-Volume), nur für Gruppenmitglieder sichtbar, höchstens 5 MB je Foto, wird verkleinert. Es verschwindet mit der Ausgabe aus dem Papierkorb bzw. beim endgültigen Löschen. Teil des Backups. (Empfehlung)
- [ ] Zusätzlich vom Admin abschaltbar
- [ ] Speicherplatz pro Gruppe begrenzen (z. B. 500 MB)

Antwort / Anmerkung:

## Frage 4: Belegscan-Anbieter (gemeinsame Planung)

Heute gilt: nur Anthropic (Claude) mit API-Schlüssel. Das Foto geht an Anthropic, gespeichert wird es nicht.

**4a. Welche Anbieter sollen zusätzlich möglich sein?**

- [ ] **Lokales Modell über Ollama** (oder einen anderen OpenAI-kompatiblen Dienst) auf deinem Server. Die Fotos verlassen dein Netz nicht, es entstehen keine laufenden Kosten, braucht aber einen Rechner mit genug Arbeitsspeicher bzw. Grafikkarte. Belege liest es meist etwas schlechter als die großen Modelle. (Empfehlung)
- [ ] **OpenAI** (GPT mit Bilderkennung) über API-Schlüssel
- [ ] **Google Gemini** über API-Schlüssel
- [ ] Keine weiteren, Anthropic reicht

**4b. Wer wählt den Anbieter?**

- [ ] **Der Betreiber in der `.env`** (wie beim E-Mail-Versand). (Empfehlung)
- [ ] Zusätzlich im Admin-Bereich (Schlüssel verschlüsselt in der Datenbank, wie beim Mailserver)

**4c. Wenn der Anbieter nicht antwortet**

- [ ] **Fehlermeldung, man gibt den Beleg von Hand ein.** (Empfehlung, einfach und vorhersehbar)
- [ ] Automatisch auf einen zweiten Anbieter ausweichen (z. B. erst lokal, dann Anthropic)

**4d. Datenschutz-Hinweis**

- [ ] **Im Scan-Dialog steht, wohin das Foto geht** (z. B. „wird an Anthropic gesendet, nicht gespeichert“ bzw. „bleibt auf diesem Server“). (Empfehlung)
- [ ] Kein Hinweis nötig

**4e. Kosten begrenzen**

- [ ] **Wie bisher 30 Scans pro Person und Stunde.** (Empfehlung)
- [ ] Zusätzlich ein Monatslimit pro Person: ______

Antwort / Anmerkung: diese fragen greifen zu kurz. ich möchte nochmal ausführlich über das Thema beraten. ich komme damit wieder auf dich zu

## Frage 5: Reihenfolge

Schreib die Nummern oder Stichworte aus Frage 1 in deiner Wunschreihenfolge auf. Ohne Angabe nehme ich: Bezahlen beim Begleichen → gleich mit Anpassungen → Erinnern → Rechner/Kopieren → Import → Belegscan-Anbieter.

Antwort:

---

## Meine Annahmen (gelten, wenn du nichts anderes schreibst)

1. Jede neue Funktion bekommt wie bisher Tests, Doku und einen Abschnitt im Tester-Guide.
2. GiroCode gibt es nur für Euro-Beträge (so will es der Standard). Bei anderen Währungen erscheint nur der PayPal-Link, falls vorhanden.
3. Importe legen nichts doppelt an: Eine bereits importierte Datei wird erkannt und abgelehnt.
4. Code aus Open-Source-Projekten übernehme ich nicht, nur Ideen (Lizenz).
5. Bezahldaten (IBAN, PayPal-Name) erscheinen nie im Export für andere Personen und nie in E-Mails.

---

## Quellen (Auswahl)

- Splitwise Pro: https://kb.splitwise.com/pro/what-is-splitwise-pro
- Splitwise PayPal/Venmo: https://kb.splitwise.com/payment-integrations/how-do-i-send-money-via-paypal-or-venmo
- Tricount: https://tricount.com/features, https://together.bunq.com/d/60470-tricount-request-links
- Spliit: https://github.com/spliit-app/spliit/issues (u. a. #150 „gleich mit Anpassungen“)
- SplitPro: https://github.com/oss-apps/split-pro
- Cospend: https://github.com/julien-nc/cospend-nc
- IHateMoney: https://ihatemoney.readthedocs.io/en/latest/api.html
- GiroCode/EPC-QR: https://github.com/mtgrosser/girocode
- GoCardless-Stopp für Neukunden: https://bankaccountdata.gocardless.com/new-signups-disabled

