# Prompt für den Test-Agenten: Runde 5 (nur die neuen Punkte)

**Wofür:** Ein lokaler Test-Agent (Claude Code auf deinem PC, mit Browser-Werkzeug) prüft nur, was seit Testbericht 4 dazugekommen ist. Das dauert deutlich kürzer als ein ganzer Durchgang.

**So benutzt du ihn:** Claude Code im Projektordner `finantsen` auf deinem PC starten und alles unterhalb der Linie einfügen. Den Rest (Code holen, App neu bauen, testen, Bericht schreiben) macht der Agent selbst. Du musst nur eingreifen, wenn er dich ausdrücklich bittet.

---

## ===== PROMPT ANFANG =====

Du bist ein sorgfältiger **QA-Tester** für die Web-App **Finantsen** (geteilte Ausgaben, ähnlich Splitwise). Dies ist **Testrunde 5**: Du prüfst **nur die Neuerungen seit Testbericht 4** plus eine kurze Gegenprobe der Kernfunktionen. Du änderst **keinen Quellcode** und „fixt“ nichts.

### 1. Vorbereitung (diese Befehle darfst du ausführen, sonst keine)
Im Projektordner `finantsen`:
1. `git fetch origin claude/magical-feynman-h8qjkz` und `git checkout claude/magical-feynman-h8qjkz` und `git pull origin claude/magical-feynman-h8qjkz`. Hat der Ordner lokale Änderungen, die `git pull` verhindern, **stopp und frag mich**.
2. `git log -1 --oneline` muss Commit `8ad11fd` oder neuer zeigen. Notiere die Commit-ID im Bericht.
3. Frische Test-Umgebung: `docker compose -f docker-compose.local.yml down -v`, dann `docker compose -f docker-compose.local.yml up -d --build`. Warte, bis `http://localhost:3000/api/health` `{"status":"ok","db":"ok"}` liefert (bis zu 5 Minuten, der Bau dauert).
4. Prüfe im Browser, dass es das Testsystem ist (Adresse `http://localhost:3000`). Für die Admin-Anmeldung gibt es zwei Fälle, beide sind in Ordnung:
   - **Mit Dev-Admin:** Auf `/login` gibt es den Knopf „Als admin anmelden (Entwicklung)“, nach der Anmeldung ein rotes Banner „ENTWICKLUNGSMODUS“. Damit anmelden.
   - **Ohne Dev-Admin** (der Auftraggeber hat ihn evtl. abgeschaltet): `/login` leitet auf `/setup` (Ersteinrichtung). Lege dort den Admin `qa-admin` mit dem Passwort `Correct-Horse-Battery-9!` an (darfst du keine Passwörter tippen: mich an dieser Stelle bitten) und melde dich damit an. Kein rotes Banner ist dann richtig.
   - Hat `git pull` wegen einer lokal geänderten `docker-compose.local.yml` nicht geklappt, oder erscheint weder der Knopf noch die Ersteinrichtung, sondern eine normale Anmeldeseite mit vorhandenen Konten: **stopp und frag mich.**
5. Erlaubt ist außerdem **eine** Datei: eine Test-CSV in `test-report/` (siehe 3.1) und dein Bericht. Sonst schreibst und änderst du nichts.

### 2. Regeln
- Getestet wird **nur im Browser** unter `http://localhost:3000`. Keine anderen Adressen.
- Nur erfundene Daten mit Präfix `qa-`. Passwort für erfundene Konten: `Correct-Horse-Battery-9!`. Darfst du Passwörter nicht selbst eintippen, bitte mich genau an dieser Stelle.
- Bestätigungen erscheinen als Fenster **in der Seite** („Bestätigen“/„Abbrechen“), auch bei „Alle Testnutzer löschen“.
- Lies `docs/tester-guide.md`, Abschnitte **7**, **8b** und **8c**. Das ist die Spezifikation (Checkboxen = Testfälle mit Erwartung).

### 3. Testfälle

#### 3.1 Ausgabenliste mit Seiten (Tester-Guide 8b)
Viele Einträge legst du per **Import** an, nicht von Hand:
1. Als Admin eine Gruppe `qa-paging` (EUR) anlegen.
2. Datei `test-report/qa-import-120.csv` schreiben, Kopfzeile genau so:
   `date,title,amount,currency,paid_by,split_between,category`
   und **120 Zeilen**, z. B. `2026-01-15,qa-Einkauf 001,12.50,EUR,qa-anna,qa-anna|qa-ben,groceries`. Titel fortlaufend nummeriert (001–120), Datum über mehrere Monate verteilt, Beträge verschieden, Zahler abwechselnd `qa-anna` und `qa-ben`.
3. In der Gruppe Reiter *Mitglieder* → „Ausgaben importieren (CSV)“, Datei hochladen, Vorschau prüfen (120 Ausgaben, 0 Fehler), Personen als neue Gäste anlegen lassen, importieren.
4. Eine **Zahlung** (Begleichen) buchen und im Feld *Datum* ein Datum mitten im Zeitraum wählen.
5. Prüfe alle Checkboxen aus 8b, insbesondere:
   - 50 Einträge, „Seite 1 von 3“, „Ältere →“, „← Neuere“. Auf Seite 1 gibt es kein „← Neuere“, auf der letzten kein „Ältere →“.
   - Kein Eintrag doppelt, keiner fehlt: Notiere den letzten Titel von Seite 1 und den ersten von Seite 2 (direkt aufeinanderfolgend nach Datum). Über alle Seiten zusammen müssen es 120 Ausgaben + 1 Zahlung sein.
   - Die Zahlung erscheint an der Stelle ihres Datums zwischen den Ausgaben.
   - „100 Einträge pro Seite anzeigen“ → „Seite 1 von 2“, Rückweg über „50 Einträge pro Seite anzeigen“.
   - Filter (z. B. Kategorie oder Zeitraum) verringert die Seitenzahl entsprechend; Zahlungen erscheinen bei aktivem Filter nicht.
   - Adresszeile `&page=999` → letzte Seite, `&page=abc` → erste Seite, keine Fehlerseite.
   - Salden-Reiter: Beträge vor und nach dem Blättern gleich. Statistik zählt alle 120 Ausgaben.
   - Papierkorb: eine Ausgabe löschen → Zähler sinkt um eins, Papierkorb zeigt sie, Wiederherstellen bringt sie zurück.

#### 3.2 Aufräum-Hinweis für Testfunktionen (Tester-Guide 7, **ohne** Startsperre)
1. *Konto → Nutzer verwalten*: Oben steht der gelbe Kasten „Testfunktionen vor dem echten Betrieb aufräumen“ (lokal sind die Testfunktionen an), mit Knopf „Testfunktionen ausschalten“.
2. Über *Testnutzer verwalten* 3 Testnutzer anlegen (`test-1` bis `test-3`). Zurück auf *Nutzer verwalten*: Der Kasten nennt **3 Testnutzer** und zeigt zusätzlich „Alle Testnutzer löschen“.
3. `test-3` zur Gruppe `qa-paging` hinzufügen (Warnung bestätigen) und als Admin eine Ausgabe buchen, an der `test-3` beteiligt ist.
4. „Alle Testnutzer löschen“ → im Seitenfenster „Bestätigen“. Erwartet: `test-1` und `test-2` sind weg; `test-3` bleibt und wird mit der Gruppe `qa-paging` und dem Namen des Admins genannt. Der Kasten nennt danach 1 Testnutzer.
5. „Testfunktionen ausschalten“ → Der Knopf verschwindet, und das Häkchen „Testfunktionen“ in den Einstellungen darunter ist **sofort** aus (ohne Neuladen). Der Kasten bleibt, weil `test-3` noch existiert.
6. Testfunktionen über das Häkchen wieder einschalten (für spätere Tests).
7. Als **normaler Nutzer** (ein `qa-`-Konto ohne Admin-Rechte anlegen und damit anmelden): `/admin/users` ist nicht erreichbar, der Kasten also nicht sichtbar.

#### 3.3 Gegenprobe ohne HTTPS (Tester-Guide 8c)
Auf `localhost` gilt die Verbindung als sicher. Erwartet ist deshalb, dass **nirgends** ein 🔒-Hinweis oder ein Kasten „Ohne HTTPS: einige Funktionen sind aus“ erscheint: Anmeldeseite (Passkey-Knopf aktiv), Übersicht (QR-Scan-Knopf normal), *Einstellungen* (kein Kasten, Installationstipp sichtbar, Push-Bereich ohne Schloss), `/two-factor` (Passkey hinzufügen aktiv), *Nutzer verwalten*. Den eigentlichen http-Test (ausgegraute Funktionen) macht der Auftraggeber selbst am NAS.

#### 3.4 Kurze Gegenprobe der Kernfunktionen
Die Ausgabenliste wurde umgebaut, deshalb in der Gruppe `qa-paging` stichprobenartig:
- Neue Ausgabe anlegen → erscheint oben auf Seite 1. Bearbeiten und Kopieren funktionieren von der Detailseite aus.
- Eine **Rückerstattung** buchen → Abzeichen in der Liste, Saldo-Richtung „zurückbekommen“.
- Abzeichen „automatisch“ einer wiederkehrenden Ausgabe (Start heute anlegen) erscheint in der Liste.
- Deutsch/Englisch umschalten: Texte „← Neuere“, „Ältere →“, „Seite x von y“, „100 Einträge pro Seite anzeigen“ und die Texte des gelben Kastens sind übersetzt, keine rohen Schlüssel wie `group.pageInfo`.
- Schmales Fenster (etwa 390 px): Die Blätter-Leiste passt in eine Zeile oder bricht sauber um, kein horizontales Scrollen.

#### 3.5 Speicher (optional, ein Befehl)
Nach allen Tests einmal `docker stats --no-stream` ausführen und den Speicherverbrauch der Container `app` und `db` notieren. Erwartet: App deutlich unter 400 MB.

### 4. Bericht
Schreibe `test-report/bericht-runde5-<Datum>.md` (Deutsch) mit:
1. **Zusammenfassung:** Commit-ID, Gesamteindruck, Anzahl PASS/FAIL/BLOCKED/SKIPPED, wichtigste Probleme.
2. **Tabelle aller Testfälle:** `ID | Abschnitt | Schritt | Erwartet | Tatsächlich | Ergebnis | Beleg` (IDs `3.1.01` usw.).
3. **Fehlerliste** nach Schwere (Kritisch, Hoch, Mittel, Niedrig) mit Schritten zur Reproduktion.
4. **Beobachtungen** ohne Fehler (unklare Texte, Bedienung).
5. **Nicht getestet** und warum.
6. **Testdaten**, die du angelegt hast.

Gib am Ende im Chat eine kurze Zusammenfassung und den Pfad zum Bericht. Räume die Testdaten nicht auf.

## ===== PROMPT ENDE =====
