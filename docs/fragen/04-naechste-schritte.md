# Fragebogen 4: Wie geht es weiter?

So füllst du ihn aus: Kreuze mit `[x]` an oder schreibe unter **Antwort**. Mit "(Empfehlung)" markiere ich, was ich nehmen würde. Wenn du fertig bist, kopiere den ganzen Inhalt zurück in den Chat. Fragen ohne Antwort behandle ich wie empfohlen.

---

## Schon entschieden (nur zur Kontrolle, bitte nicht ausfüllen)

- Phasen 0 bis 3, Konten-Etappen A bis C, Testnutzer, TOTP, QR-Anzeige und Passkeys sind fertig.
- Der Test-Agent prüft den neuen Stand; seinen Bericht werte ich aus, sobald er da ist.
- Kein SMTP, keine Open-Source-Lizenz.

---

## Meine Hinweise (keine Antwort nötig)

1. **Docker-Prüfung fehlt:** Den Docker-Build habe ich seit Etappe A nicht mehr in meiner Umgebung gebaut (Migrationen 0006 und 0007, neue Pakete `qrcode` und `@simplewebauthn`). Du baust ihn lokal ohnehin neu; ein Fehler dort wäre sofort sichtbar, aber ich würde es vor einem Release gern selbst prüfen.
2. **Sicherungen:** Es gibt noch keine dokumentierte Datensicherung (Postgres-Dump) und keinen Wiederherstellungstest. Für eine selbst gehostete Finanz-App wichtig, bevor echte Daten drin liegen.
3. **Mitglieder ohne Konto** ist die größte Funktion (Salden, Einladungen und Rechte betreffen alles) und braucht eigene Entscheidungen.

---

## Frage 1: Was als Nächstes? (Reihenfolge: 1 = zuerst)

Schreibe Zahlen hinter die Punkte, die du willst; nicht gewünschte leer lassen.

- **A: Release-Reife**: Docker-Build prüfen, Backup/Restore-Anleitung mit Test, Sicherheitsdurchgang (Rate-Limits, Header, Abhängigkeiten, `npm audit`), Release-Checkliste abarbeiten. Zahl: ___ (Empfehlung: 1)
- **B: Gelöschte Ausgaben wiederherstellen** (Papierkorb, Soft Delete gibt es schon, nur UI und Recht fehlen). Klein. Zahl: ___ (Empfehlung: 2)
- **C: Wiederkehrende Ausgaben** (Miete, Abos: monatlich/wöchentlich automatisch buchen). Mittel. Zahl: ___ (Empfehlung: 3)
- **D: Mitglieder ohne Konto** (Platzhalter in einer Gruppe, später mit einem Konto verknüpfbar). Groß, braucht Fragebogen. Zahl: ___ (Empfehlung: 4)
- **E: Export** (CSV der Ausgaben und Salden je Gruppe, ein Konto-Export). Klein. Zahl: ___
- **F: Gruppe archivieren** (ausblenden statt löschen, Salden bleiben sichtbar). Klein. Zahl: ___
- **G: E-Mail-Versand (SMTP)** für Einmal-Links und Benachrichtigungen. Mittel, nur mit Mailserver sinnvoll. Zahl: ___

Antwort / Anmerkung:

## Frage 2: Test-Agent-Funde

- [x] Ich arbeite Funde des Test-Agents zuerst ab, bevor ich mit der Auswahl oben beginne. (Empfehlung)
- [ ] Neue Funktionen haben Vorrang, Funde sammle ich und arbeite sie später ab.

Antwort / Anmerkung:

---

## Meine Annahmen (gelten, wenn du nichts anderes schreibst)

1. Ich beginne mit A (Release-Reife), weil es keine neuen Entscheidungen von dir braucht und das Risiko für echte Daten senkt.
2. Jede Funktion bekommt wie bisher Tests, Doku (README, CLAUDE.md, Roadmap, Tester-Guide) und einen eigenen Commit.
3. Zu D (Mitglieder ohne Konto) schicke ich vorher einen eigenen Fragebogen.
