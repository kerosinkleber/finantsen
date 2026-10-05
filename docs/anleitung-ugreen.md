# Finantsen auf einem UGREEN-NAS (UGOS Pro)

Schritt für Schritt für UGREEN-NAS mit **UGOS Pro**. Allgemeine Hintergründe (warum `http://` manche Funktionen nicht erlaubt, Updates, Fehlerbehebung) stehen in `docs/anleitung-nas.md`. Diese Anleitung ersetzt dort die Schritte 2–4.

> Die Bezeichnungen in UGOS ändern sich zwischen Versionen leicht (z. B. „Projekt“ / „Project“, „Bereitstellen“ / „Deploy“). Wenn ein Knopf etwas anders heißt, ist meist der sinngemäß gleiche gemeint.

---

## 0. Passt mein UGREEN?

- **DXP-Serie** (DXP2800, DXP4800, DXP4800 Plus, DXP6800 Pro, DXP8800 Plus, DXP480T Plus): Intel-Prozessor, passt.
- **Neuere DH-Modelle mit UGOS Pro** (z. B. DH2300, DH4300 Plus): ARM 64 Bit, passt ebenfalls.
- **Ältere Modelle mit dem alten UGOS** (ohne „Pro“) haben meist keine Docker-App, dann geht es nicht.
- Arbeitsspeicher: Finantsen braucht im Betrieb etwa 200–400 MB (App und Datenbank zusammen). Jedes UGOS-Pro-Modell hat genug.

## 1. Einmalig auf GitHub: Image öffentlich machen

Wie in `docs/anleitung-nas.md`, Schritt 1 (Packages → finantsen → Package settings → Change visibility → Public).

## 2. Docker installieren

1. In UGOS Pro anmelden (im Browser die Adresse des NAS, z. B. `http://192.168.178.20:9999`).
2. **App Center** öffnen → **Docker** suchen → **Installieren**.
3. Bei der Installation fragt UGOS nach einem Speicherort. Den vorgeschlagenen Speicherpool nehmen. UGOS legt dabei einen Freigabeordner **`docker`** an.

## 3. Ordner und Dateien anlegen

1. **Dateien** (File Manager) öffnen → Freigabeordner **`docker`** → neuen Ordner **`finantsen`** anlegen.
2. Auf deinem PC aus dem Repo zwei Dateien herunterladen (auf github.com Datei öffnen → **Download raw file**):
   - `docker-compose.nas.yml`
   - `.env.nas.example`
3. Am PC die Datei `.env.nas.example` mit einem Texteditor öffnen und ausfüllen:

   | Eintrag | Was eintragen |
   |---|---|
   | `APP_URL` | `http://<IP-des-NAS>:3000`, z. B. `http://192.168.178.20:3000`. Die IP steht in UGOS unter **Systemsteuerung → Netzwerk** oder in deinem Router. |
   | `APP_PORT` | `3000` |
   | `POSTGRES_PASSWORD` | Lange Zufallsfolge, nur Buchstaben und Ziffern (z. B. 32 Zeichen aus dem Passwortmanager) |
   | `APP_SECRET` | Zweite, andere Zufallsfolge, 64 Zeichen. **Gut aufbewahren, nie ändern.** |
   | `FINANTSEN_TAG` | `latest`. Solange der Entwicklungszweig noch nicht in `main` übernommen ist: `claude-magical-feynman-h8qjkz` |

4. Beide Dateien per Drag & Drop in den Ordner `docker/finantsen` auf dem NAS hochladen und dort umbenennen (Rechtsklick → **Umbenennen**):
   - `docker-compose.nas.yml` → **`docker-compose.yml`**
   - `.env.nas.example` → **`.env`** (mit Punkt am Anfang)

   Tipp: Dateien mit Punkt am Anfang sind im File Manager evtl. ausgeblendet. Das ist normal, die Datei ist trotzdem da.

## 4. Projekt anlegen und starten

1. **Docker**-App öffnen → links **Projekt** → **Erstellen**.
2. **Projektname:** `finantsen`
3. **Speicherpfad:** auf **Durchsuchen** klicken und den Ordner `docker/finantsen` wählen.
4. UGOS erkennt die vorhandene `docker-compose.yml` und zeigt ihren Inhalt im Editor an. Nichts ändern.
   - Zeigt UGOS stattdessen einen leeren Editor: den Inhalt der `docker-compose.yml` hineinkopieren.
5. **Sofort bereitstellen** (bzw. **Deploy**) anklicken.
6. UGOS lädt die Images (beim ersten Mal 1–3 Minuten) und startet zwei Container: `finantsen-db-1` und `finantsen-app-1`.

**Prüfen:** Docker → **Container** → `finantsen-app-1` → **Protokoll**. Dort sollten `migrations applied` und `Ready` stehen.

### Falls UGOS die `.env` nicht liest

Erkennbar an einer Meldung wie „APP_URL … setzen“ oder „required variable … is missing a value“. Dann die Werte direkt in den Editor schreiben:

1. Docker → **Projekt** → `finantsen` → **Bearbeiten** (bzw. Stift-Symbol).
2. Jeden Platzhalter durch den Wert ersetzen, z. B.
   - `${APP_URL:?…}` → `http://192.168.178.20:3000`
   - `${APP_SECRET:?…}` → dein 64-Zeichen-Wert
   - `${POSTGRES_PASSWORD:?…}` → dein Datenbank-Passwort (kommt **zweimal** vor: beim `db`-Dienst und in `DATABASE_URL`)
   - `${FINANTSEN_TAG:-latest}` → `latest` (bzw. den Zweig-Namen)
   - `${APP_PORT:-3000}` → `3000`
3. Speichern und neu bereitstellen.

## 5. Erste Anmeldung

1. Im Browser `http://<IP-des-NAS>:3000` öffnen.
2. Es erscheint die **Einrichtung**: Name, Nutzername und Passwort für dich als Admin. Gleich selbst erledigen, wer zuerst kommt, wird Admin.

Lädt die Seite nicht: In UGOS unter **Systemsteuerung → Sicherheit → Firewall** prüfen, ob eine Firewall aktiv ist, und den TCP-Port `3000` für das Heimnetz erlauben.

## 6. Aktualisieren

1. Docker → **Projekt** → `finantsen` → **Stoppen**.
2. Docker → **Image** → `ghcr.io/kerosinkleber/finantsen` → **Aktualisieren** bzw. neu ziehen (falls angeboten). Sonst per SSH, siehe unten.
3. Projekt wieder **Starten**.

Die Daten bleiben erhalten, die Datenbank wird beim Start automatisch angepasst.

### Per SSH (verlässlichster Weg für Updates und Backups)

1. UGOS: **Systemsteuerung → Terminal** → **SSH aktivieren**.
2. Am PC ein Terminal öffnen (Windows: „Eingabeaufforderung“ oder „PowerShell“):
   ```bash
   ssh <dein-UGOS-Nutzer>@192.168.178.20
   cd /volume1/docker/finantsen
   sudo docker compose pull && sudo docker compose up -d
   ```
   (Liegt der Ordner auf einem anderen Speicherpool, heißt der Pfad `/volume2/...`. `ls /volume*` zeigt die vorhandenen.)
3. SSH danach wieder ausschalten, wenn du es nicht brauchst.

## 7. Backup

Per SSH im Projektordner:
```bash
sudo docker compose exec -T db pg_dump -U finantsen -Fc finantsen > finantsen-$(date +%F).dump
```
Die Datei liegt dann in `docker/finantsen` und wird von einer UGOS-Sicherung (App **Sync & Backup**) mitgesichert, wenn du den Ordner `docker` dort einschließt. **`APP_SECRET` getrennt notieren.** Ein automatisches tägliches Backup richte ich ein, sobald Fragebogen 9 beantwortet ist.

Hinweis: Den Ordner `docker` **nicht** im laufenden Betrieb einfach als Dateien sichern und zurückspielen, die Datenbank-Dateien können dabei inkonsistent sein. Dafür ist der `pg_dump` da.
