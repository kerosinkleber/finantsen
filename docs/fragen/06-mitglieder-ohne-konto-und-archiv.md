# Fragebogen 6: Mitglieder ohne Konto, Gruppen archivieren, Export

So füllst du ihn aus: Kreuze mit `[x]` an (bei Einfachauswahl nur eins) oder schreibe unter **Antwort**. Mit "(Empfehlung)" markiere ich, was ich nehme. **Ich baue bereits nach den Empfehlungen** (du wolltest, dass ich ohne Unterbrechung fertig baue). Was du anders ankreuzt, ändere ich danach.

---

## Schon entschieden (nur zur Kontrolle, bitte nicht ausfüllen)

- Restliche Roadmap-Punkte werden gebaut: CSV-Export, Gruppe archivieren, Mitglieder ohne Konto.
- Kein E-Mail-Versand (SMTP), keine öffentliche Registrierung per Default.
- Geld bleibt Ganzzahl in Minor-Units, Rechte werden nur serverseitig geprüft.

---

## Meine Hinweise (keine Antwort nötig)

1. **Mitglied ohne Konto** ("Gast") ist eine Person, die in einer Gruppe mitgerechnet wird (zahlt, bekommt Anteile, hat einen Saldo), sich aber nicht anmelden kann. Typisch: Oma, Kind, jemand, der die App nicht nutzen will.
2. **Verknüpfen:** Später kann der Gast ein echtes Konto bekommen. Alle seine Ausgaben, Zahlungen und Salden gehen dann auf dieses Konto über. Danach gibt es den Gast nicht mehr.
3. **Sicherheit:** Gäste können sich nie anmelden (wie Testnutzer). Jede Anmelde- und Passwortfunktion schließt sie aus.

---

## Frage 1: Wer darf Gäste anlegen?

- [x] **Jedes Gruppenmitglied** in seiner Gruppe (Empfehlung; der Gast gehört dann nur zu dieser Gruppe)
- [ ] Nur Gruppenbesitzer

Antwort / Anmerkung:

## Frage 2: Wie wird ein Gast zu einem echten Konto?

- [x] **Per Verknüpfungs-Link**: Ein Mitglied erzeugt für den Gast einen Link (wie die Gruppeneinladung, mit QR-Code). Wer ihn mit seinem Konto öffnet und bestätigt, übernimmt alles vom Gast und ist Mitglied der Gruppe. (Empfehlung)
- [ ] Nur der Admin verknüpft (wählt Gast und Konto aus)

Antwort / Anmerkung:

## Frage 3: Gast löschen

- [x] **Nur, wenn er keine Ausgaben/Zahlungen hat**; sonst erst verknüpfen oder Ausgaben ändern (Empfehlung, damit Salden nicht verfälscht werden)
- [ ] Immer erlaubt (Ausgaben bleiben, Name erscheint als "ehemaliger Gast")

Antwort / Anmerkung:

## Frage 4: Gruppe archivieren

- [x] **Jeder für sich**: Ein Mitglied blendet die Gruppe in **seiner** Übersicht aus (Bereich "Archiv"); die anderen sehen sie weiter. Salden zählen weiter. Neue Aktivität in der Gruppe holt sie nicht automatisch zurück. (Empfehlung)
- [ ] Für alle: Der Besitzer archiviert die Gruppe; danach ist sie schreibgeschützt.

Antwort / Anmerkung:

## Frage 5: Export

- [x] **CSV je Gruppe** (Ausgaben mit Anteilen je Person, Zahlungen, Salden), Trennzeichen passend zur Sprache (Deutsch `;`, Englisch `,`), lesbar in Excel/LibreOffice. (Empfehlung)
- [x] **Konto-Export als JSON** (alle eigenen Daten aus allen Gruppen, z. B. vor einem Umzug). (Empfehlung)

Antwort / Anmerkung:

---

## Meine Annahmen (gelten, wenn du nichts anderes schreibst)

1. Gäste tragen in der App die Kennzeichnung "(Gast)", bekommen keine Benachrichtigungen und tauchen nicht in der Admin-Nutzerverwaltung auf.
2. Freundschaften (2-Personen-Gruppen) bekommen keine Gäste.
3. Ein Konto, das bereits Mitglied der Gruppe ist, kann einen Gast trotzdem übernehmen; seine und die Daten des Gasts werden zusammengeführt.
4. Der Verknüpfungs-Link gilt 7 Tage und nur einmal.
5. Die CSV enthält Beträge als Dezimalzahl in der Ausgabenwährung und zusätzlich in der Gruppenwährung; gelöschte Ausgaben sind nicht enthalten.
