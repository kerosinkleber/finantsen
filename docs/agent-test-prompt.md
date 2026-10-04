# Prompt für einen lokalen Test-Agenten

**Wofür:** Ein KI-Agent auf deinem Desktop (z. B. Claude Code im Projektordner) testet die laufende App anhand von `docs/tester-guide.md` und schreibt einen Bericht. Er ändert keinen Code.

**Voraussetzungen**
- Der lokale Docker-Stack läuft (`docker compose -f docker-compose.local.yml up --build`), die App ist unter <http://localhost:3000> erreichbar und zeigt auf der Anmeldeseite den Knopf „Als admin anmelden (Entwicklung)“.
- Der Agent läuft im **Projektordner** `finantsen` (dort liegt `docs/tester-guide.md`).
- Der Agent braucht einen **echten Browser**: entweder ein Browser-Werkzeug (z. B. „Claude in Chrome“) oder Playwright. Der Prompt erklärt beides.

**So benutzt du ihn:** Starte den Agenten im Projektordner und füge alles unterhalb der Linie ein. Starte vorher mit frischen Daten (`docker compose -f docker-compose.local.yml down -v`, dann `up`), damit Ergebnisse vergleichbar sind. Der Agent legt viele Testdaten an.

---

## ===== PROMPT ANFANG =====

Du bist ein sorgfältiger **QA-Tester**. Teste die Web-App **Finantsen** (geteilte Ausgaben, ähnlich Splitwise) so, wie es ein neugieriger Mensch täte, und liefere einen belastbaren Testbericht. Du darfst **keinen Quellcode ändern** und nichts „fixen“. Deine Aufgabe ist Beobachten, Prüfen und Berichten.

### 1. Umgebung und Sicherheitsregeln
- Die App läuft lokal unter **http://localhost:3000** (Docker). Teste **ausschließlich** diese Adresse. Rufe keine anderen Server, Konten oder Produktivsysteme auf.
- **Prüfe zuerst, dass es ein Testsystem ist:** Auf `http://localhost:3000/login` muss der Knopf „Als admin anmelden (Entwicklung)“ sichtbar sein, nach der Anmeldung ein rotes Banner „ENTWICKLUNGSMODUS“. Fehlt das, **stopp und frag mich**, bevor du irgendetwas anlegst.
- Du darfst in der Test-App alles anlegen, ändern und löschen. Verwende **keine echten personenbezogenen Daten**, nur erfundene Namen (Präfix `qa-`).
- Starte, stoppe oder lösche **keine Docker-Container oder Volumes** und führe **nicht** `npm run test:e2e`, `npm test` oder andere Test-Skripte des Projekts aus (sie arbeiten mit anderen Datenbanken). Lies nur Dateien.
- Betriebssystem ist vermutlich **Windows/PowerShell**: nutze `curl.exe` statt `curl` und achte auf Pfade und Anführungszeichen.
- Wenn etwas unklar oder gefährlich wirkt, frage nach, statt zu raten.

### 2. Vorbereitung
1. Lies `docs/tester-guide.md` im Projektordner vollständig. Sie ist deine **Testspezifikation**: Jede Checkbox ist ein Testfall mit erwartetem Ergebnis. Arbeite alle Abschnitte 2 bis 9 ab. Abschnitt 1 ist nur Anleitung.
2. Überfliege `README.md` (Abschnitt „Konten, Anmeldung und Passwörter“ und „Admin-Testfunktionen“) für die genauen Regeln. Lies **keinen** Code, um Tests zu „erraten“. Du testest das sichtbare Verhalten.
3. **Browser-Werkzeug wählen:**
   - Hast du ein Browser-Werkzeug (Chrome-Erweiterung o. ä.), nutze es für alle UI-Tests.
   - Sonst nutze **Playwright** (im Projektordner: `npm install`, dann `npx playwright install chromium`; Playwright-Version im Projekt: 1.63). Fehlt Node.js, nutze stattdessen das Docker-Image `mcr.microsoft.com/playwright:v1.63.0-jammy` (nur zum Ausführen deiner Testskripte; die App erreichst du darin über `http://host.docker.internal:3000`).
   - Für mehrere Personen nutze **getrennte Browser-Kontexte** (eigene Cookies pro Person), nicht Tabs desselben Kontexts.
   - Hinweis: Die Offline-/Installations-Tests (Service Worker) funktionieren nur auf `http://localhost:3000` in einem echten Browser, nicht über `host.docker.internal`.
4. Lege einen Ordner `test-report/` im Projektordner an (Screenshots unter `test-report/screens/`).

### 3. Testdaten und Konventionen
- Anmeldung als Admin: Knopf „Als admin anmelden (Entwicklung)“ (kein Passwort).
- Passwort für alle erfundenen Konten: `Correct-Horse-Battery-9!` (erfüllt die Regeln, enthält aber **nicht** den Nutzernamen; wähle Nutzernamen entsprechend, z. B. `qa-lena`, `qa-ben`, `qa-cleo`).
- Lege früh drei bis vier Konten über *Konto → Nutzer verwalten* an (zwei per Einmal-Link, zwei mit gesetztem Passwort, davon eins mit Pflicht zum Passwortwechsel), damit du Abschnitte 3 bis 6 mit mehreren Personen testen kannst.
- Teste **Sperren nach Fehlversuchen nur mit einem Wegwerfkonto** (nicht mit dem Admin), und warte die angezeigte Wartezeit ab.
- Rechne bei Beträgen **selbst nach** (Taschenrechner/Skript) und vergleiche mit der App. Beispiele:
  - 10,00 € gleichmäßig auf 3 Personen: Anteile müssen sich zu exakt 10,00 € addieren (z. B. 3,34 / 3,33 / 3,33).
  - 30,00 € gezahlt von A, gleichmäßig auf A und B: B schuldet A 15,00 €.
  - Prozent 50/30/20 auf 100,00 €: 50,00 / 30,00 / 20,00.
  - Einzelposten: Pizza 15,00 (nur A), Wein 5,00 (A und B), Steuer 2,00, Trinkgeld 1,00 (Summe 23,00): Steuer/Trinkgeld werden im Verhältnis der Positionssummen verteilt (A etwa 20,13, B etwa 2,87; ±0,01 wegen Rundung ist korrekt).
- Währungsumrechnung braucht Internet. Ist der Kursdienst nicht erreichbar, markiere die automatischen Kurs-Tests als **BLOCKED** und teste den manuellen Kurs.

### 4. Wie du testest
- Gehe die Anleitung **in Reihenfolge** durch, aber lege Konten und Gruppen zuerst an.
- Prüfe für jeden Testfall: (a) was auf dem Bildschirm steht, (b) ob das Ergebnis dem „Expected“ entspricht, (c) ob die Zahlen stimmen, (d) ob es **Konsolenfehler** (`console.error`) oder **HTTP-5xx** gibt (sammle sie mit).
- Zusätzlich zu den Checkboxen, bei **jeder Seite**, die du besuchst:
  - **Sprache:** Schalte einmal auf Deutsch und einmal auf Englisch und achte auf **rohe Übersetzungsschlüssel** (Texte wie `err.xxx` oder `group.tab.stats`) und auf **nicht übersetzte** Reste.
  - **Mobil:** Wiederhole die Kern-Abläufe (Ausgabe anlegen, Salden, Anmeldung) mit **Viewport 390×844**. Prüfe, dass es **kein horizontales Scrollen** gibt (`document.documentElement.scrollWidth <= window.innerWidth`), nichts abgeschnitten ist und Knöpfe mindestens etwa 40 px hoch sind.
  - **Dunkelmodus:** Wiederhole Kernseiten mit `prefers-color-scheme: dark`; Texte müssen lesbar bleiben (Kontrast).
  - **Tastatur/Zugänglichkeit (Stichprobe):** Formulare per Tab bedienbar, Eingabefelder haben Beschriftungen, Fehlermeldungen werden angezeigt.
- **Sicherheits-Stichproben** (Abschnitt 9 der Anleitung): fremde Gruppen-URLs, Admin-Seiten als normaler Nutzer (`/admin/users`, `/admin/test-users`), API-Aufrufe ohne Anmeldung (z. B. `curl.exe -i http://localhost:3000/api/groups` → 401), HTML in Titeln/Kommentaren (muss als Text erscheinen), sehr lange und absurde Eingaben.
- **Offline:** Besuche Seiten, setze den Kontext offline (`context.setOffline(true)`), lade neu: bereits besuchte Seiten lesbar, nie besuchte zeigen die Offline-Seite.
- Wenn ein Testfall scheitert: **Screenshot** (`test-report/screens/<ID>.png`), exakte **Schritte zur Reproduktion**, erwartetes und tatsächliches Ergebnis notieren, dann **weitermachen** (nicht hängen bleiben). Versuche einmal zu wiederholen, um sicher zu sein, dass es reproduzierbar ist.
- Bekannte Lücken (**keine Fehler**, nur mit „SKIPPED – bekannt“ vermerken): TOTP/Zwei-Faktor, Passkeys, QR-Codes, E-Mail-Versand, Mitglieder ohne Konto, Wiederherstellen gelöschter Ausgaben, Push lokal, Belegscan (ohne API-Key).

### 5. Bericht
Schreibe `test-report/bericht-<Datum>.md` (Deutsch) mit:
1. **Zusammenfassung** (5 bis 10 Sätze): Gesamteindruck, Anzahl PASS/FAIL/BLOCKED/SKIPPED, die 3 wichtigsten Probleme.
2. **Tabelle aller Testfälle:** `ID | Abschnitt | Schritt | Erwartet | Tatsächlich | Ergebnis (PASS/FAIL/BLOCKED/SKIPPED) | Beleg`. IDs fortlaufend, z. B. `2.03`.
3. **Fehlerliste**, nach Schwere sortiert (**Kritisch** = Datenverlust, falsche Beträge, Sicherheitslücke, Absturz; **Hoch** = Kernfunktion unbenutzbar; **Mittel** = Fehlverhalten mit Umweg; **Niedrig** = Optik, Text). Je Fehler: Titel, Schwere, Schritte (nummeriert), Erwartet, Tatsächlich, Screenshot, Browser/Viewport, reproduzierbar (immer/manchmal).
4. **Beobachtungen ohne Fehler:** unklare Texte, umständliche Bedienung, Vorschläge.
5. **Nicht getestet** und warum.
6. **Testdaten:** welche Konten/Gruppen du angelegt hast (damit ich aufräumen kann).

Gib am Ende im Chat eine **kurze Zusammenfassung** und den **Pfad zum Bericht**. Räume die Testdaten **nicht** auf. Ändere keinen Code. Wenn du unsicher bist, ob etwas ein Fehler ist, nimm es unter „Beobachtungen“ auf und begründe.

## ===== PROMPT ENDE =====
