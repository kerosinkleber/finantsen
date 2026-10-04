# Fragebogen 2: Admin-Testfunktionen (Testnutzer)

So füllst du ihn aus: Kreuze mit `[x]` an (bei Einfachauswahl nur eins) oder schreibe unter **Antwort**. Mit "(Empfehlung)" markiere ich, was ich nehmen würde. Wenn du fertig bist, kopiere den ganzen Inhalt zurück in den Chat. Fragen ohne Antwort behandle ich wie empfohlen.

---

## Schon entschieden (nur zur Kontrolle, bitte nicht ausfüllen)

- Der Admin kann **Testnutzer anlegen**.
- Ihre **Gruppenzugehörigkeiten und weitere Optionen** lassen sich auf **einer Seite** bearbeiten.
- Testnutzer werden **aus dem Admin-Konto heraus gesteuert**.
- Testnutzer haben **kein Passwort** und können sich **nie als eigenständiger Nutzer anmelden**.
- Das Ganze hat **Vorrang** vor Etappe B (TOTP) und C (QR-Code). Es steht in `docs/roadmap.md`.

---

## Meine Einwände und Hinweise (zur Kenntnis, keine Antwort nötig)

1. **Sicherheit:** "Aus dem Admin-Konto steuern" bedeutet, dass der Admin als anderer Nutzer handeln kann. Das darf **ausschließlich für Testnutzer** gehen, nie für echte Konten. Ich sichere das serverseitig ab (eigene Kontoart, nicht nur ein Haken in der Oberfläche), nur ein echter Admin darf es, und auch die Admin-Seiten bleiben unter dem echten Admin-Konto.
2. **Vermischung mit echten Daten:** Sobald ein Testnutzer in einer Gruppe mit echten Nutzern ist, tauchen seine Ausgaben in deren Salden und Auswertungen auf. Deshalb kennzeichne ich Testnutzer überall sichtbar und frage unten, ob sie auch in echten Gruppen sein dürfen.
3. **Aufräumen:** Testdaten sollen sich später wieder entfernen lassen, ohne echte Salden zu verändern. Das ist Frage 6.
4. **Passwortlos heißt nicht ungeschützt:** Testnutzer können sich weder anmelden noch per Einmal-Link, Registrierung oder Passwort-Zurücksetzen aktivieren. Das teste ich ausdrücklich.
5. **Produktivbetrieb:** Auf dem echten Server willst du vermutlich keine Testnutzer herumliegen haben. Deshalb schlage ich einen Schalter vor (Frage 3).

---

## Frage 1: Wie steuerst du einen Testnutzer?

- [ ] **A: "Handeln als"**: Ein Klick, und du siehst die App genau so wie der Testnutzer (seine Gruppen, Salden, Benachrichtigungen) und kannst für ihn Ausgaben anlegen, kommentieren, Zahlungen verbuchen. Oben ein deutliches Banner "Du handelst als X, zurück zum Admin". (Empfehlung)
- [ ] **B: Nur Bearbeitungsseite**: Du pflegst Daten und Mitgliedschaften nur auf der Admin-Seite, ohne die App als der Nutzer zu sehen.
- [ ] **C: Beides** (A enthält die Bearbeitungsseite ohnehin; B allein wäre deutlich weniger Aufwand)

Antwort / Anmerkung:

---

## Frage 2: Was bearbeitest du auf der Testnutzer-Seite?

Kreuze an, was dort einstellbar sein soll:

- [x] Anzeigename und Nutzername (Empfehlung)
- [x] Gruppenzugehörigkeiten: hinzufügen und entfernen (Empfehlung)
- [x] Rolle in der Gruppe (Besitzer oder Mitglied) (Empfehlung)
- [x] Sprache (Deutsch oder Englisch) (Empfehlung)
- [ ] E-Mail (nur zum Testen von E-Mail-Dubletten und Filtern)
- [ ] Freundschaften zu anderen Konten (Direktgruppen)
- [ ] Push-Benachrichtigungen für diesen Nutzer an oder aus (ohne echtes Gerät nur simuliert)
- [ ] Später dazu: TOTP-Status und erzwungener Passwortwechsel (kommt mit Etappe B)

Antwort / Anmerkung (weitere Optionen, die du brauchst):

---

## Frage 3: Soll es einen Schalter "Testfunktionen" geben?

- [ ] **Ja, mit Schalter, Standard aus.** Du schaltest ihn im Admin-Bereich ein. Solange er aus ist, sind Testnutzer-Verwaltung und "Handeln als" unsichtbar und gesperrt. Bereits angelegte Testnutzer bleiben gespeichert. (Empfehlung)
- [ ] Ja, mit Schalter, Standard **an**
- [ ] Nein, immer verfügbar

Antwort / Anmerkung:

---

## Frage 4: Testnutzer und echte Gruppen

- [ ] **A: Frei.** Testnutzer dürfen in jede Gruppe, auch mit echten Nutzern. Sie sind überall mit "Test" gekennzeichnet, und beim Hinzufügen zu einer Gruppe mit echten Mitgliedern erscheint eine Warnung. (Empfehlung)
- [ ] **B: Getrennt.** Testnutzer dürfen nur in Gruppen, in denen kein echter Nutzer außer dir als Admin ist. Das schützt die Salden echter Nutzer vollständig, ist aber mehr Aufwand und weniger flexibel.

Antwort / Anmerkung:

---

## Frage 5: Mehrere Testnutzer auf einmal und Beispieldaten

- [ ] **Mehrere auf einmal anlegen** (z. B. "5 Testnutzer": test-1 bis test-5). (Empfehlung)
- [ ] **Beispielszenario-Knopf** (legt eine Testgruppe mit einigen Beispielausgaben an). Später, nicht jetzt. (Empfehlung: später)
- [ ] Beispielszenario **jetzt** mitbauen
- [ ] Nur einzeln anlegen

Antwort / Anmerkung:

---

## Frage 6: Löschen von Testnutzern und Testdaten

Ausgaben verweisen auf Nutzer, deshalb kann man sie nicht einfach entfernen.

- [ ] **A: Löschen mit Bereinigung, aber geschützt.** Ein Testnutzer lässt sich löschen. Gruppen, Ausgaben und Zahlungen, an denen **nur Testnutzer** beteiligt sind, werden mitgelöscht. Ist ein echter Nutzer beteiligt, wird das Löschen **blockiert** mit Hinweis, wo er noch vorkommt. (Empfehlung)
- [ ] **B: Nur deaktivieren, nie löschen.**
- [ ] **C: Löschen mit Bereinigung auch in gemischten Gruppen.** Betroffene Ausgaben werden gelöscht, dadurch ändern sich Salden echter Nutzer. Nicht empfohlen.

Antwort / Anmerkung:

---

## Frage 7: Nachvollziehbarkeit

Wenn du als Testnutzer handelst, soll das im Verlauf einer Ausgabe erkennbar sein ("Anlegt von test-2, durch Admin")?

- [ ] **Ja** (Empfehlung). Kleiner Zusatz in der Datenbank, das Ändern des Verlaufs-Feldes ist rückwirkungsfrei.
- [ ] Nein, es soll aussehen, als hätte der Testnutzer selbst gehandelt.

Antwort / Anmerkung:

---

## Meine Annahmen (nur melden, wenn du etwas anders willst)

1. Testnutzer sind eine **eigene Kontoart** (kein Passwort, kein Login, kein Einmal-Link, nicht über Setup oder Registrierung erreichbar). Ein Testnutzer kann **nie Admin** sein und zählt nicht als Admin.
2. "Handeln als" geht **nur für Testnutzer**, nur durch einen **echten Admin**, und die Sitzung bleibt in Wahrheit die des Admins. Admin-Seiten und Admin-API sind dabei weiterhin nur mit der Admin-Identität erreichbar. Abmelden beendet auch das Handeln als Testnutzer. Die "Handeln als"-Sitzung läuft wie die normale Sitzung.
3. Benachrichtigungen für Testnutzer werden in der App erzeugt und sind beim Handeln als Testnutzer sichtbar. **Push-Nachrichten** gehen nie an Testnutzer.
4. Der Nutzername ist frei wählbar, mein Vorschlag für neue Testnutzer ist `test-1`, `test-2` usw. (Regeln wie bei echten Nutzernamen, eindeutig).
5. Testnutzer erscheinen in der Nutzerliste getrennt von echten Konten, mit Kennzeichnung "Test".
6. Aus einer Gruppe entfernen geht bei Testnutzern **auch mit offenem Saldo** nach einer Bestätigung (bei echten Nutzern bleibt die Sperre). Die Ausgaben bleiben erhalten.
7. Die Reihenfolge danach bleibt wie vereinbart: Etappe B (TOTP), Etappe C (QR-Code), Passkeys zuletzt.
