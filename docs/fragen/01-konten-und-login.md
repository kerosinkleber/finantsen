# Fragebogen 1: Konten, Anmeldung, Sicherheit

So füllst du ihn aus: Kreuze mit `[x]` an (bei Einfachauswahl nur eins) oder schreibe unter **Antwort**. Mit "(Empfehlung)" markiere ich, was ich nehmen würde. Wenn du fertig bist, kopiere den ganzen Inhalt zurück in den Chat. Fragen ohne Antwort behandle ich wie empfohlen.

---

## Schon entschieden (nur zur Kontrolle, bitte nicht ausfüllen)

- Es gibt Konten, die der Admin anlegt: mit gesetztem Passwort **oder** Einmal-Link, über den der Nutzer sein Passwort selbst wählt.
- **Öffentliche Registrierung** gibt es nur, wenn der Admin sie aktiviert. Standard: aus.
- **Passwort ist Pflicht**: mindestens 20 Zeichen, mindestens ein Groß- und ein Kleinbuchstabe, eine Ziffer, ein Sonderzeichen.
- **TOTP** kann der Admin erzwingen: globaler Schalter "für alle", dazu optional pro Nutzer, Admins immer. Wer es braucht und noch nicht hat, muss es nach dem Passwort-Login einrichten. Freiwillig einschaltbar ist es immer.
- **Wiederherstellungscodes** für TOTP: Standard **1** Code, vom Admin einstellbar. Geräteverlust: der Admin setzt TOTP zurück.
- **Passkeys**: niedrigste Priorität, kein Zwang durch den Admin, Passwort bleibt Pflicht.
- **Kein SMTP/E-Mail-Versand** vorerst (siehe Erklärung unten). Der Admin gibt Links weiter.
- **Admin-Verwaltung**: Nutzerliste mit Anlegen, Einmal-Link neu erzeugen, Passwort setzen, TOTP zurücksetzen, Deaktivieren (kein Löschen), Admin-Recht vergeben. Mehrere Admins möglich, der letzte kann sich nicht degradieren oder deaktivieren. Beim Deaktivieren enden alle Sitzungen sofort.
- **Gruppeneinladung** per Link (und per QR-Code, siehe Frage 6).
- **Erster Admin**: Gibt es noch keinen, läuft beim ersten Aufruf ein Einrichtungsablauf (Name, Passwort, TOTP). Details in Frage 3.

---

## Frage 1: Womit meldet man sich an?

Du hast bei der Einrichtung "Nutzername und Passwort" geschrieben, bisher meldet man sich mit der E-Mail an. Da wir keine Mails versenden, braucht die App die E-Mail-Adresse eigentlich gar nicht.

- [ ] **A: Nutzername** (eindeutig, Groß-/Kleinschreibung egal). Die E-Mail ist ein **optionales** Feld, mehrfach nutzbar, nur für später. (Empfehlung)
  - Folge: Die Kontoauswahl beim Login und der Schalter "Mehrere Konten pro E-Mail" entfallen, denn der Wunsch "viele Konten mit einer E-Mail" ist dann automatisch erfüllt. Das macht den Login einfacher.
- [ ] **B: E-Mail** (wie jetzt). Die Auswahl bei mehreren Konten und der Schalter bleiben, Standard aus.
- [ ] **C: Beides**: Login mit Nutzername oder E-Mail.

Antwort / Anmerkung:

---

## Frage 2: Öffentliche Registrierung (wenn der Admin sie einschaltet)

Wie läuft es ab, wenn der Schalter an ist?

- [ ] **A: Offen, Konto sofort aktiv.** Jeder mit dem Link zur Seite kann sich anlegen.
- [ ] **B: Offen, aber Admin muss freigeben.** Das Konto ist angelegt, aber gesperrt, bis der Admin zustimmt. (Empfehlung)
- [ ] **C: Nur mit Einladungscode** vom Admin (jemand ohne Code kann sich nicht registrieren).

Hinweis: Die Passwortregeln und ein erzwungenes TOTP gelten auch bei Selbstregistrierung.

Antwort / Anmerkung:

---

## Frage 3: Einrichtung des ersten Admins

Beim ersten Aufruf ohne Admin erscheint der Einrichtungsablauf. Du sagst, das System geht erst online, wenn du eingerichtet hast. Zur Sicherheit könnten wir trotzdem verhindern, dass ein Fremder schneller ist (zum Beispiel bei einem Tippfehler in der Domain oder einem Neustart):

- [ ] **A: Setup-Code.** Beim Start steht ein einmaliger Code im Server-Log (`docker compose logs app`), den du im Formular eingibst. (Empfehlung)
- [ ] **B: Kein Schutz.** Wer die Seite zuerst aufruft, richtet den Admin ein.

Und: Der Admin muss beim Einrichten **TOTP** anlegen. Das Passkey kommt später als Alternative dazu.
- [ ] Einverstanden (Empfehlung)
- [ ] Nein, TOTP für den Admin soll optional sein

Antwort / Anmerkung:

---

## Frage 4: Zusätzliche Passwortregeln

Meine Einschätzung zu deinen Ideen:

- **"Keine Wörter aus dem Wörterbuch"** würde ich **nicht** einführen. Ein Passwort aus vier zufälligen Wörtern ("Pferd-Lampe-Wolke-Tisch!7") ist lang und sicher, würde aber abgelehnt. Wörterlisten gibt es außerdem je Sprache, und Tricks wie "P4ssw0rt" umgehen sie leicht. Aktuelle Empfehlungen (NIST) raten davon ab.
- **"Nicht mehr als 3 gleiche Zeichen hintereinander"** ist harmlos und billig umzusetzen, bringt aber bei 20 Zeichen mit den anderen Regeln kaum etwas.
- Was dagegen echten Nutzen hat, ist die Länge selbst (die hast du schon) und der Schutz vor Raten (Begrenzung der Fehlversuche).

Kreuze an, was zusätzlich gelten soll:

- [ ] Höchstens 3 gleiche Zeichen in Folge
- [ ] Kein Wörterbuch-Check (nicht empfohlen)
- [x] Passwort darf Nutzername/E-Mail nicht enthalten (Empfehlung)
- [x] Neues Passwort darf nicht dem aktuellen entsprechen (Empfehlung)
- [x] Passwort ändern nur mit Eingabe des aktuellen Passworts (Empfehlung)
- [x] Zunehmende Wartezeit nach mehreren Fehlversuchen beim Login (Empfehlung)

Antwort / Anmerkung:

---

## Frage 5: Wiederherstellungscodes (TOTP)

Standard ist 1 Code pro Nutzer, vom Admin einstellbar. Welche Grenzen soll der Admin einstellen können?

- [ ] **0 bis 20** (0 = keine Codes, Geräteverlust nur über den Admin) (Empfehlung)
- [ ] 1 bis 10
- [ ] Andere Grenzen:

Wenn ein Code benutzt wurde, kann der Nutzer unter *Konto* neue erzeugen (die alten werden dann ungültig). Einverstanden?
- [ ] Ja (Empfehlung)
- [ ] Nein, anders:

Antwort / Anmerkung:

---

## Frage 6: QR-Code für Gruppeneinladungen

Machbar. Zwei Teile, mit sehr unterschiedlichem Aufwand:

1. **QR-Code anzeigen**: der Code enthält denselben Einladungslink. Der andere scannt ihn mit der normalen Kamera-App und landet im Browser. Aufwand klein. Bei iPhones öffnet er Safari, nicht unbedingt die installierte App.
2. **Scanner in der App**: Kamera direkt in der App. Braucht HTTPS, auf iPhones eine Zusatzbibliothek, und ist deutlich mehr Aufwand und Testarbeit.

- [ ] **Nur QR anzeigen** jetzt, Scanner in der App später (Empfehlung)
- [ ] Beides jetzt
- [ ] Gar nicht, nur Link

Antwort / Anmerkung:

---

## Frage 7: In welcher Reihenfolge bauen?

Das Ganze ist groß. Ich schlage Etappen vor, nach jeder hältst du an und testest:

- **Etappe A**: Einrichtung des ersten Admins, Anmeldung, Passwortregeln, Admin-Nutzerverwaltung mit Einmal-Links, Schalter für die öffentliche Registrierung.
- **Etappe B**: TOTP mit Zwang, Wiederherstellungscodes.
- **Etappe C**: QR-Code für Einladungen.

- [ ] **Drei Etappen** mit Test dazwischen (Empfehlung)
- [ ] Alles auf einmal

Antwort / Anmerkung:

---

## Frage 8: Gültigkeit der Einmal-Links (Konto aktivieren, Passwort neu setzen)

- [ ] **72 Stunden** (Empfehlung)
- [ ] 24 Stunden
- [ ] 7 Tage
- [ ] Im Admin-Bereich einstellbar (Standard 72 Stunden)

Antwort / Anmerkung:

---

## Meine Annahmen (nur melden, wenn du etwas anders willst)

1. Ohne SMTP laufen alle Links über **eine zentrale Funktion**. Später ersetze ich sie durch Mailversand und ergänze einen "Per Mail senden"-Button, ohne den Rest umzubauen.
2. Admin-gesetzte Passwörter müssen beim ersten Login geändert werden (Haken, Standard an).
3. Der Einrichtungsablauf existiert nur, solange kein Admin vorhanden ist. Danach gibt es ihn nicht mehr.
4. Deaktivierte Nutzer bleiben mit Namen in alten Ausgaben und Salden sichtbar, können sich aber nicht anmelden.
5. Passwortänderung, TOTP-Zurücksetzung und Deaktivierung beenden die anderen Sitzungen.
6. TOTP: 6 Stellen, 30 Sekunden, Toleranz um ein Zeitfenster, jeder Code nur einmal gültig, Begrenzung der Fehlversuche.
7. Wird der TOTP-Zwang eingeschaltet, während Nutzer eingeloggt sind, werden sie beim nächsten Login zur Einrichtung geführt.
8. `APP_SECRET` in der `.env` wird **Pflicht**, weil die TOTP-Geheimnisse damit verschlüsselt gespeichert werden. Ändert man ihn später, funktioniert TOTP nicht mehr.
9. `REGISTRATION_ENABLED` in der `.env` entfällt, der Schalter lebt im Admin-Bereich.
10. Einladungslinks für Gruppen kann nur ein eingeloggtes Konto annehmen.
11. Der lokale Docker-Test braucht danach keine Zugangsdaten in der Konfiguration, du richtest den Admin über die Einrichtungsseite ein (Starten mit `down -v` für frische Daten).
