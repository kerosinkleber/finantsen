# Fragebogen 5: Wiederkehrende Ausgaben

So füllst du ihn aus: Kreuze mit `[x]` an (bei Einfachauswahl nur eins) oder schreibe unter **Antwort**. Mit "(Empfehlung)" markiere ich, was ich nehmen würde. Wenn du fertig bist, kopiere den ganzen Inhalt zurück in den Chat. Fragen ohne Antwort behandle ich wie empfohlen.

---

## Schon entschieden (nur zur Kontrolle, bitte nicht ausfüllen)

- Wiederkehrende Ausgaben (Miete, Abos) werden **automatisch gebucht**.
- Gebuchte Ausgaben sind ganz normale Ausgaben (Salden, Statistik, Verlauf, Kommentare, Löschen/Wiederherstellen wie bisher).
- Geld bleibt Ganzzahl in Minor-Units, Anteile werden wie immer deterministisch gerundet.

---

## Meine Hinweise (keine Antwort nötig)

1. **Wie läuft das ohne Cron?** Die App hat keinen eigenen Zeitplaner. Ich würde einen kleinen Hintergrund-Takt im App-Prozess nehmen (prüft z. B. alle 15 Minuten, was fällig ist) **und** beim Start nachholen, was in der Zwischenzeit fällig war. Ein Neustart verliert also nichts, und es wird nie doppelt gebucht (Absicherung in der Datenbank).
2. **Vorlage statt Kopie:** Es gibt eine Vorlage (Titel, Betrag, Aufteilung, Zahler, Rhythmus). Jede Buchung ist eine eigene Ausgabe. Eine Änderung der Vorlage gilt nur für **künftige** Buchungen.
3. **Fremdwährung:** Bei einer Vorlage in anderer Währung als der Gruppenwährung wird der Kurs **zum Buchungstag** geholt. Ist der Kursdienst nicht erreichbar, versuche ich es später erneut und buche nicht mit einem geratenen Kurs.
4. **Mitglied ist ausgetreten:** Die Vorlage hält an, bis ein Mitglied sie anpasst, statt jemanden zu belasten, der nicht mehr in der Gruppe ist.

---

## Frage 1: Welche Rhythmen?

- [x] Täglich
- [x] Wöchentlich (Wochentag wie Startdatum)
- [x] Monatlich (Tag des Monats wie Startdatum; am 29. bis 31. gilt in kürzeren Monaten der letzte Tag) (Empfehlung)
- [x] Jährlich
- [ ] Alle N Tage/Wochen/Monate frei einstellbar (z. B. alle 2 Wochen)

Antwort / Anmerkung:

## Frage 2: Wer darf Vorlagen anlegen und ändern?

- [x] **Jedes Gruppenmitglied** (wie bei normalen Ausgaben) (Empfehlung)
- [ ] Nur Gruppenbesitzer

Antwort / Anmerkung:

## Frage 3: Ende

- [x] **Optional ein Enddatum**; ohne Enddatum läuft die Vorlage bis zum Pausieren oder Löschen (Empfehlung)
- [ ] Immer unbegrenzt

Antwort / Anmerkung:

## Frage 4: Benachrichtigung

- [x] **Die anderen Mitglieder bekommen bei jeder automatischen Buchung die normale Benachrichtigung** („X hat … hinzugefügt“, mit dem Zusatz „automatisch“). (Empfehlung)
- [ ] Keine Benachrichtigung für automatische Buchungen (nur in der Liste sichtbar)

Antwort / Anmerkung:

## Frage 5: Wer steht als Ersteller der automatischen Buchung?

- [x] **Das Mitglied, das die Vorlage angelegt hat**, im Verlauf mit Kennzeichnung „automatisch“. (Empfehlung)
- [ ] Ein neutraler Eintrag „System“

Antwort / Anmerkung:

## Frage 6: Verpasste Termine

Falls die App länger aus war (z. B. 3 Monate Miete fällig):

- [x] **Alle verpassten Termine nachbuchen**, jeweils mit dem damaligen Datum. (Empfehlung)
- [ ] Nur den letzten fälligen Termin buchen
- [ ] Nichts nachbuchen, nur künftige

Antwort / Anmerkung:

---

## Meine Annahmen (gelten, wenn du nichts anderes schreibst)

1. Vorlagen erscheinen im Gruppenreiter „Wiederkehrend“ (anlegen, bearbeiten, pausieren, löschen; Löschen einer Vorlage lässt bereits gebuchte Ausgaben unberührt).
2. Beim Anlegen kann man den **ersten Termin** wählen (auch in der Vergangenheit; dann werden die verpassten Termine nach Frage 6 gebucht, mit einer Warnung vorher).
3. Testnutzer können Vorlagen anlegen wie normale Ausgaben (mit „Handeln als“ und Kennzeichnung).
4. Eine Vorlage nutzt dieselbe Aufteilungs-Logik wie das Ausgabenformular (gleichmäßig, Prozent, feste Beträge, Anteile, Einzelposten), nur ohne Belegscan.
5. Die Zeitrechnung erfolgt nach dem Datum (ohne Uhrzeit) in UTC; gebucht wird morgens ab 00:00 UTC des Fälligkeitstags.
