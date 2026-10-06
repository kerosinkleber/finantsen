# Prompt: Finantsen durch die Android-Wrapper-App testen

**Wofür:** Eine lokale Claude-Code-Session mit adb-Zugriff auf das Handy (Samsung S26, Android 16) testet die Web-App Finantsen **durch die Wrapper-App** `de.finantsen.fritzwrapper.debug`. Die App zeigt die Seite in einer WebView an und verbindet sich über ihren eigenen WireGuard-Tunnel. Ziel: Kernabläufe auf echtem Gerät und typische WebView-Risiken.

**So benutzt du ihn:** Vorbereitung (Teil A) selbst erledigen, dann alles ab „PROMPT ANFANG“ in die Test-Session einfügen.

---

## Teil A: Vorbereitung durch dich (manuell, vor dem Start)

1. **App-Stand auf der NAS aktuell:** Image `ghcr.io/kerosinkleber/finantsen:claude-magical-feynman-h8qjkz` ab Commit `2e56747`. Erkennbar daran, dass das Formular „Zahlung verbuchen“ ein **Datumsfeld** hat.
2. **Im Wrapper anmelden:** App öffnen, mit deinem normalen Konto anmelden. Falls 2FA aktiv ist, Code eingeben. Danach auf der Übersicht stehen lassen.
3. **Optional für den Bezahl-Test (T10):** Ein zweites Konto (z. B. `wrapper-b`) mit Passwort anlegen. Damit anmelden und unter *Konto → Bezahldaten*:
   - Kontoinhaber: `Test B`
   - IBAN: `DE89370400440532013000` (offizielle Beispiel-IBAN, gehört niemandem)
   - PayPal-Name: `finantsentest` (beliebig, es wird nichts bezahlt)

   Die Test-Session meldet sich, wenn sie das Konto für T10 einladen muss. Ohne zweites Konto wird T10 übersprungen.
4. **Nicht nötig:** Mailversand, Testfunktionen, Push. Es werden keine Einladungen an echte Personen verschickt.

## ===== PROMPT ANFANG =====

Du testest die Web-App **Finantsen** (geteilte Ausgaben, ähnlich Splitwise) auf einem echten Android-Handy **durch die Wrapper-App** `de.finantsen.fritzwrapper.debug`. Du hast adb-Zugriff (Screenshots, Tippen, Wischen, Texteingabe, Zurück-Taste, Hintergrund/Vordergrund, logcat) und das Chrome-DevTools-Protokoll der WebView (JavaScript ausführen, DOM, Netzwerk, Cookies, localStorage, Konsole). Du änderst keinen Code.

### 1. Rahmen und Regeln
- **Start-URL:** `http://192.168.77.27:3000/` (nur HTTP). Erreichbar sind nur `192.168.77.27` und `finantsen.fritz.box`, alles andere blockiert der Wrapper-Proxy (403).
- **Keine Passwörter, kein Login:** Der Nutzer ist bereits angemeldet (Sitzungs-Cookie, httpOnly, also in `document.cookie` **nicht** sichtbar). Alles, was Abmelden, Anmelden, 2FA, Passkey oder Einmal-Links braucht, ist ein **manueller Schritt durch den Nutzer**: anhalten, ihn bitten, danach weitermachen.
- **Keine echten Daten anfassen:** Lege nur die Gruppe `WRAPPER-TEST <heutiges Datum>` an und arbeite ausschließlich darin. Am Ende löschst du sie (siehe Aufräumen). Keine Einladungslinks an echte Personen senden, keine Mails auslösen, keine echte Zahlung.
- **Bekanntes Wrapper-Verhalten, kein Fehler:**
  - PayPal-Links (`paypal.me`/`paypal.com`) gehen an die PayPal-App bzw. den Standardbrowser, andere externe Links werden blockiert (Toast).
  - Downloads mit `Content-Disposition: attachment` öffnen den Android-Speichern-Dialog; `blob:`-Downloads gehen nicht.
  - Web-Push geht in der WebView grundsätzlich nicht. Passkeys gehen nicht (kein HTTPS).
  - Pull-to-Refresh nur ganz oben. Zurück-Taste = Verlauf zurück. Cookies und localStorage überstehen Neustarts, die zuletzt besuchte Seite öffnet wieder.
- **Bekanntes Web-App-Verhalten über HTTP, kein Fehler:** Die Web-App erkennt die unsichere Verbindung (`window.isSecureContext === false`).
  - Kamera-QR-Scan, Passkeys, Push und App-Installation sind **ausgegraut mit 🔒-Hinweis**.
  - In *Konto* (Einstellungen) steht ein Kasten „Ohne HTTPS: einige Funktionen sind aus“.
  - Über HTTP registriert die Web-App normalerweise **keinen Service Worker** (Browser erlauben ihn nur in sicherem Kontext). Prüfe in T0, was in dieser WebView tatsächlich passiert, und dokumentiere es.
- **Prüfen per DevTools statt nur per Pixel:** Nutze die unten genannten `data-testid`-Attribute (`document.querySelector('[data-testid="…"]')`), URL-Pfade (`location.pathname`) und API-Antworten (`fetch` aus der Seite heraus, der Cookie geht automatisch mit).
- Bei Fehlern: Screenshot, `location.href`, Konsolenfehler, relevante logcat-Zeilen (Tag des Wrappers, blockierte Hosts, Tunnel-Status) festhalten, einmal wiederholen, dann weitermachen.

### 2. Testdaten
- **Gruppe:** `WRAPPER-TEST <Datum>`, Währung EUR.
- **Mitglieder ohne Konto (Gäste):** `WT-Anna`, `WT-Ben`. Sie haben kein Konto, bekommen nichts zugeschickt und verschwinden mit der Gruppe.
- **CSV für T13:** vorher per adb aufs Handy legen:
  ```
  adb push wrapper-test.csv /sdcard/Download/wrapper-test.csv
  ```
  Inhalt (genau so, UTF-8, Komma-getrennt):
  ```
  date,title,amount,currency,paid_by,split_between,category
  2026-10-01,WT-Import Kino,24.00,EUR,WT-Anna,WT-Anna|WT-Ben,entertainment
  2026-10-02,WT-Import Pizza,31.50,EUR,WT-Ben,WT-Anna|WT-Ben,restaurant
  2026-10-03,WT-Import Taxi,12.30,EUR,WT-Anna,WT-Anna|WT-Ben,transport
  ```
- **Foto für T11:** Irgendein Foto reicht (z. B. Tisch oder Wand). Inhalt egal, es wird nur angehängt und angezeigt.

### 3. Testfälle

Für jeden Fall gilt: Erwartung erfüllt → OK, sonst FEHLER (mit Beleg). Nicht durchführbar → ÜBERSPRUNGEN mit Grund.

#### Kernabläufe

**T0 Umgebung und Sitzung**
1. App starten, Screenshot. In DevTools ausführen:
   - `location.href`
   - `window.isSecureContext`
   - `'serviceWorker' in navigator`
   - `navigator.serviceWorker && (await navigator.serviceWorker.getRegistrations()).length`
   - `navigator.onLine`
   - `typeof navigator.clipboard`
   - `navigator.userAgent`
2. `await (await fetch('/api/auth/me')).json()` → enthält `user` mit `username`.
3. `await (await fetch('/api/health')).json()` → `{"status":"ok","db":"ok"}`.
4. logcat: Tunnel verbunden, keine blockierten Anfragen an `192.168.77.27`.

Erwartet: Seite `/`, angemeldet, `isSecureContext` = `false`. Notiere alle Werte im Bericht, vor allem Service Worker und `navigator.clipboard`.

**T1 Übersicht und HTTP-Hinweise**
- Auf `/` gibt es den Knopf `[data-testid="qr-scan-open"]` (abgedunkelt) und darunter `[data-testid="insecure-note"]` mit „HTTPS“. Antippen öffnet `[data-testid="qr-scanner"]` **ohne** Kameraabfrage, mit einem Feld zum Einfügen eines Einladungslinks.
- Unten-Navigation: Übersicht, Freunde, Konto; jeweils ein Pfadwechsel (`/`, `/friends`, `/settings`).
- In `/settings`:
  - `[data-testid="insecure-info"]` ist sichtbar.
  - In `[data-testid="push"]` ist `[data-testid="push-enable"]` deaktiviert.
  - Kein Installations-Tipp.

**T2 Gruppe anlegen (Formular + Tastatur)**
1. `/groups/new` öffnen (über „Neue Gruppe“ auf der Übersicht).
2. Feld `#name` antippen: Die Tastatur verdeckt das Feld nicht, Screenshot mit offener Tastatur. Namen `WRAPPER-TEST <Datum>` tippen, Währung `#cur` = EUR, speichern.

Erwartet: Weiterleitung auf `/groups/<uuid>`, Gruppenname als Überschrift. Merke die Gruppen-ID für die nächsten Schritte.

**T3 Gäste hinzufügen**
- Reiter Mitglieder (`?tab=members`). Im Bereich `[data-testid="guests"]` nacheinander `WT-Anna` und `WT-Ben` eintragen und jeweils `[data-testid="guest-add"]` tippen.
- Erwartet: zwei `[data-testid="guest-item"]`.

**T4 Ausgabe anlegen mit Rechner**
1. In der Gruppe „Ausgabe hinzufügen“ → Pfad `/groups/<id>/expenses/new`.
2. Ausfüllen:
   - `#title` = `WT-Einkauf`
   - `#amount` = `12,50+7,50`: Während der Eingabe erscheint `[data-testid="calc-result"]` mit „= 20,00“. Beim Verlassen des Feldes steht `20,00` im Feld.
   - Aufteilung „gleich“ auf dich, WT-Anna und WT-Ben; bezahlt hast du.
3. Speichern.

Erwartet: zurück in der Gruppe, oberstes `[data-testid="expense-item"]` enthält „WT-Einkauf“. Prüfe dabei auch, ob der Knopf „±×“ die Tastatur zwischen Zahlen und Text umschaltet.

**T5 Rundung (Rest-Cent geht an den Zahler)**
- Neue Ausgabe `WT-Rundung`, 10,00 €, gleich auf drei, bezahlt von dir. Detailseite öffnen.
- Erwartet: dein Anteil 3,34 €, WT-Anna und WT-Ben je 3,33 €, Summe 10,00 €.

**T6 Ausgabe bearbeiten**
- `WT-Einkauf` öffnen (`/groups/<id>/expenses/<eid>`), Betrag auf `21,00` ändern, speichern.
- Erwartet: In der Liste steht der neue Betrag. Auf der Detailseite zeigt `[data-testid="history"]` einen Eintrag „geändert“.

**T7 Löschen, Papierkorb, Wiederherstellen**
1. Auf der Detailseite von `WT-Rundung` löschen. Es erscheint ein Bestätigungsfenster **in der Seite** (`[data-testid="confirm-dialog"]`), kein Android-Dialog. `[data-testid="confirm-yes"]` tippen.
2. In der Gruppe `[data-testid="trash"]` aufklappen → ein `[data-testid="trash-item"]` → `[data-testid="restore"]`.

Erwartet: Die Ausgabe ist wieder in der Liste.

**T8 Salden**
- `?tab=balances`.
- Erwartet: `[data-testid="transfers-EUR"]` zeigt, wer wem wie viel schuldet. Rechne mit den Beträgen aus T4 bis T6 nach.
- Gegenprobe: `await (await fetch('/api/groups/<id>/balances')).json()`.

**T9 Begleichen mit Datum**
- Im Salden-Reiter beim Vorschlag „Begleichen“ → Pfad `/groups/<id>/settle`.
- Das Feld „Datum“ (`#pay-date`) ist mit heute vorbelegt. Antippen öffnet den nativen Datumswähler; Screenshot. Ein Datum von vor 3 Tagen wählen, „Zahlung speichern“ tippen.
- Erwartet: Weiterleitung zu `?tab=balances`. In der Ausgabenliste erscheint ein `[data-testid="payment-item"]` mit dem gewählten Datum.

**T10 Bezahlen per GiroCode/PayPal (nur mit zweitem Konto `wrapper-b`, sonst ÜBERSPRUNGEN)**
1. **Manueller Schritt:** Der Nutzer lädt `wrapper-b` in die Testgruppe ein. Im Mitglieder-Reiter Einladungslink erzeugen und den Link im Konto `wrapper-b` annehmen; das macht der Nutzer selbst. Danach legt `wrapper-b` eine Ausgabe an, die er bezahlt hat und an der du beteiligt bist.
2. Zurück in deinem Konto, Salden-Reiter.
   - Erwartet: `[data-testid="pay-box"]` mit GiroCode-Bild, `[data-testid="pay-iban"]` und `[data-testid="pay-paypal"]`.
3. Kopieren-Knopf neben der IBAN tippen, dann den Inhalt der Zwischenablage prüfen (z. B. in ein Textfeld einfügen). Dokumentiere, ob wirklich etwas kopiert wurde. Siehe Hinweis bei T16.
4. `[data-testid="pay-paypal"]` tippen.
   - Erwartet: Übergabe an PayPal-App oder Browser, **nicht** im Wrapper. Abbrechen, nichts bezahlen, in den Wrapper zurück.

**T11 Belegfoto anhängen und ansehen**
1. Auf der Detailseite von `WT-Einkauf` im Bereich `[data-testid="attachments"]` „Foto hinzufügen“ tippen. Das Eingabefeld (`[data-testid="attach-input"]`) hat `accept="image/*"` und `capture="environment"`.
2. Dokumentiere, was der Wrapper öffnet: direkt die Kamera oder eine Auswahl (Kamera/Galerie). Ein beliebiges Foto aufnehmen und bestätigen.
   - Erwartet: Nach dem Hochladen erscheint ein `[data-testid="attachment"]` mit Vorschaubild. Netzwerk-Tab: POST auf `/api/groups/<id>/expenses/<eid>/attachments` mit Status 200.
3. Vorschaubild antippen. Der Link hat `target="_blank"` und führt auf `/api/groups/<id>/expenses/<eid>/attachments/<aid>` (Bild, `Content-Disposition: inline`). Dokumentiere, ob das Bild in der WebView, in einem neuen Fenster oder gar nicht öffnet, und ob die Zurück-Taste danach in die App zurückführt.
4. Anhang über „Löschen“ entfernen (Bestätigung in der Seite).

**T12 Export-Downloads**
- Gruppen-CSV: Mitglieder-Reiter → `[data-testid="export-csv"]` (Link auf `/api/groups/<id>/export`, `attachment`).
  - Erwartet: Android-Speichern-Dialog, Datei landet in Downloads. Per adb prüfen: Datei vorhanden, erste Zeile ist eine Kopfzeile, Ausgaben „WT-…“ enthalten.
- Konto-Export: `/settings` → `[data-testid="export-account"]` (JSON).
  - Erwartet: Speichern-Dialog, Datei ist gültiges JSON und enthält keine Passwörter.

**T13 CSV-Import mit Dateiauswahl**
1. Mitglieder-Reiter → „Ausgaben importieren (CSV)“ → Pfad `/groups/<id>/import`.
2. Im Dateifeld (`#import-file`) über den Android-Dateiauswähler `Download/wrapper-test.csv` wählen.
   - Erwartet: `[data-testid="import-preview"]` meldet „einfaches Format“, 3 Ausgaben, 0 Fehler. WT-Anna und WT-Ben werden den vorhandenen Gästen zugeordnet (Namen gleich).
3. Importieren.
   - Erwartet: `[data-testid="import-result"]` meldet „3 Ausgaben“. In der Liste stehen die drei `WT-Import …`.
4. Gleiche Datei erneut importieren.
   - Erwartet: Hinweis „schon importiert“, keine Doppelungen.

#### Weitere Abläufe

**T14 Statistik und Blättern**
- `?tab=stats`: `[data-testid="stats-total"]` zeigt die Summe aller Ausgaben der Gruppe.
- Zurück zur Liste. Hat sie mehr als 50 Einträge, gibt es `[data-testid="pager"]`. In der Testgruppe sind es weniger, dann ist kein Pager da: OK.

**T15 Kommentar mit Tastatur**
- Auf der Detailseite einer Ausgabe in `[data-testid="comments"]` einen Kommentar „WT-Kommentar“ schreiben und absenden.
- Erwartet: `[data-testid="comment"]` erscheint. Die Tastatur verdeckt das Eingabefeld nicht. Nach dem Absenden zeigt die Seite nicht falsch verschoben an.

**T16 Einladungslink und Zwischenablage**
1. Mitglieder-Reiter → „Mitglied einladen“.
   - Erwartet: `[data-testid="invite-link"]` mit `http://192.168.77.27:3000/join/…` und darunter ein QR-Code. **Den Link an niemanden schicken.**
2. „Kopieren“ tippen. Die Seite zeigt kurz „Kopiert“.
3. Prüfe, ob die Zwischenablage wirklich den Link enthält: in ein Textfeld der App einfügen, oder per adb.
4. Dokumentiere `typeof navigator.clipboard` aus T0.

Wenn „Kopiert“ erscheint, die Zwischenablage aber leer bleibt: als **Bug in der Web-App** melden. Die Seite meldet dann Erfolg, obwohl über HTTP nichts kopiert wurde. Das Feld selbst ist markierbar, manuelles Kopieren per langem Druck ist der Umweg; prüfe, ob das geht.

**T17 Sprache**
- `/settings` → Sprachauswahl `#lang` auf English.
  - Erwartet: Navigation „Overview / Friends / Account“. Gruppenseite auf Englisch, keine rohen Schlüssel wie `group.tab.stats`.
- Zurück auf Deutsch.

**T18 Zurück-Taste und Pull-to-Refresh**
1. Übersicht → Gruppe → Ausgabe → Zurück → Zurück.
   - Erwartet: jeweils die vorige Seite, am Ende `/`. Ein weiteres Zurück: dokumentiere das Verhalten (App schließen oder in den Hintergrund).
2. Ganz oben nach unten ziehen.
   - Erwartet: Seite lädt neu.
3. Mitten in einer gescrollten Liste nach unten ziehen.
   - Erwartet: **kein** Neuladen, nur Scrollen.
4. Ist ein Bestätigungsfenster offen (Löschen-Rückfrage)? Zurück-Taste drücken und dokumentieren, ob das Fenster schließt oder die Seite verlassen wird.

#### Randfälle

**T19 Formular und Hintergrund**
1. Neue Ausgabe beginnen (Titel und Betrag eingetragen, nicht speichern). App 30 Sekunden in den Hintergrund, zurückholen.
   - Erwartet: Eingaben noch da.
2. Das Gleiche mit 10 Minuten Hintergrund. Dokumentiere, ob die Eingaben noch da sind, der Tunnel sich wieder verbindet (logcat) und Speichern dann funktioniert.

**T20 Tunnel weg / offline**
1. Auf der Gruppenseite das Netz trennen (WLAN und Mobilfunk aus, oder per adb `svc wifi disable` und `svc data disable`).
   - Dokumentiere: `navigator.onLine`, ob die Web-App oben „Du bist offline …“ zeigt, und was logcat zum Tunnel meldet.
2. Offline eine Ausgabe speichern.
   - Erwartet: Fehlermeldung in der Seite (Offline/Netzwerkfehler), **keine** halb gespeicherte Ausgabe.
3. Offline zu einer noch nicht besuchten Seite navigieren.
   - Dokumentiere, was erscheint: Fehlerseite des Wrappers, Chromium-Fehlerseite oder `offline.html` der Web-App. Ohne Service Worker erscheint `offline.html` nicht.
4. Netz wieder an.
   - Erwartet: Tunnel verbindet sich wieder, Neuladen funktioniert. Die Ausgabe aus Schritt 2 erneut speichern: genau einmal in der Liste.

**T21 App-Neustart und Prozessende**
1. `adb shell am force-stop de.finantsen.fritzwrapper.debug`, App neu starten.
   - Erwartet: zuletzt besuchte Seite, weiterhin angemeldet (`/api/auth/me` 200).
2. Dasselbe nach `adb shell am kill …`, während die App im Hintergrund ist.

**T22 Externe und fremde Ziele**
- In DevTools ausführen:
  - `location.href = 'https://example.com'`
  - `window.open('https://example.com')`
- Erwartet: blockiert (Toast), WebView bleibt auf Finantsen.
- `await fetch('https://example.com').catch(e => String(e))`: Dokumentiere das Ergebnis.

**T23 Darstellung**
- Hochformat und Querformat, große Systemschrift (Einstellungen → Anzeige → Schriftgröße), Dunkelmodus.
- Erwartet: kein waagerechtes Scrollen (`document.documentElement.scrollWidth <= innerWidth`), Knöpfe tippbar, Texte lesbar.

**T24 Abmelden (manueller Schritt am Ende)**
1. `/settings` → `[data-testid="logout"]`.
   - Erwartet: Weiterleitung auf `/login`, `/api/auth/me` liefert 401.
2. Zurück-Taste.
   - Erwartet: keine geschützte Seite mit alten Daten.
3. **Wieder anmelden macht der Nutzer.** Danach weiter mit Aufräumen.

### 4. Aufräumen
1. In der Testgruppe, Reiter Mitglieder → „Gruppe löschen“ → Bestätigung in der Seite.
   - Erwartet: zurück auf `/`, die Gruppe `WRAPPER-TEST …` ist weg. Gäste, Ausgaben, Anhänge und Zahlungen werden mitgelöscht.
2. Gibt es `wrapper-b` (T10), sagt der Nutzer, ob er das Konto behalten will. Du löschst keine Konten.
3. Per adb löschen:
   - `/sdcard/Download/wrapper-test.csv`
   - die heruntergeladenen Export-Dateien aus T12
   - eigene Testfotos aus T11, falls in der Galerie gespeichert

### 5. Bericht
Schreibe `wrapper-test-report-<Datum>.md` (Deutsch) mit:
1. **Umgebung:** Werte aus T0 (UserAgent, `isSecureContext`, Service Worker, `navigator.clipboard`, Tunnel-Status) und App-Stand (Datumsfeld vorhanden?).
2. **Ergebnistabelle:** `| Testfall | OK/FEHLER/ÜBERSPRUNGEN | Beleg |`. Beleg: Screenshot-Datei, DOM-/API-Ergebnis oder logcat-Zeile.
3. **Bugs in der Web-App:** nummeriert, je mit Schritten zur Reproduktion, Erwartet, Tatsächlich, Beleg. Web-App heißt: tritt im Browser genauso auf bzw. liegt am HTML/JS/Server.
4. **Bugs im Wrapper:** genauso aufgebaut. Wrapper heißt: liegt an WebView-Einstellungen, Dateiauswahl, Downloads, Tunnel, Navigation, Zurück-Taste, Fenster/`target=_blank`.
5. **Unklar, wem es gehört**, mit deiner Einschätzung.
6. **Bekanntes Verhalten**, das wie beschrieben auftrat (kurz, damit es nicht als Fehler gezählt wird).

## ===== PROMPT ENDE =====
