# Finantsen auf dem NAS ausprobieren

Diese Anleitung bringt Finantsen auf einen NAS (oder einen anderen Rechner mit Docker) im Heimnetz. Es wird **nichts gebaut**: Der NAS lädt das fertige Image von GitHub. Zeitbedarf: etwa 20 Minuten.

**Wichtig vorab:** Diese Variante läuft über `http://` (ohne Verschlüsselung) und ist zum **Ausprobieren im Heimnetz** gedacht. Browser erlauben über `http://` einige Funktionen nicht: Kamera-Scanner, Passkeys, App-Installation, Offline-Modus und Push-Nachrichten fehlen dann. Alles andere (Gruppen, Ausgaben, Salden, Statistik, Import, E-Mail …) funktioniert. Für den Dauerbetrieb mit Freunden kommt HTTPS dazu (siehe Fragebogen 9).

---

## 0. Passt mein NAS?

- Der NAS muss **Docker** können:
  - Synology: Paket „Container Manager“ (früher „Docker“)
  - QNAP: „Container Station“
  - UGREEN, Asustor, TerraMaster: „Docker“-App
  - Unraid: eingebaut
- Prozessor: **Intel/AMD (x86-64)** oder **ARM 64 Bit**. Ganz alte 32-Bit-ARM-Modelle gehen nicht.
  - Synology: Welches Modell welchen Prozessor hat, steht in der Synology-Liste „What kind of CPU does my NAS have“. „x86_64“, „armv8“ und „aarch64“ passen.
- Arbeitsspeicher: mindestens **1 GB frei**. Die App braucht im Betrieb etwa 300–600 MB.

## 1. Einmalig auf GitHub: Das Image öffentlich machen

GitHub baut das Image automatisch bei jedem neuen Stand. Neue Pakete sind bei GitHub zuerst **privat**, auch wenn das Repo öffentlich ist. Damit der NAS es ohne Anmeldung laden kann, schaltest du es einmal auf öffentlich:

1. Auf github.com anmelden und oben rechts auf dein Profilbild → **Your profile** → Reiter **Packages**.
2. Paket **finantsen** öffnen → rechts **Package settings**.
3. Ganz unten bei **Danger Zone**: **Change visibility** → **Public** → mit dem Paketnamen bestätigen.

Das ist nur einmal nötig. (Falls das Paket noch nicht da ist: Der erste Bau dauert nach dem Push etwa 10–15 Minuten. Unter *Actions → Image* im Repo siehst du den Fortschritt.)

## 2. Ordner und Dateien auf dem NAS anlegen

1. Auf dem NAS einen Ordner anlegen, z. B. `docker/finantsen` (bei Synology in der File Station unter dem Freigabeordner `docker`).
2. Aus dem Repo zwei Dateien hineinlegen (auf github.com Datei öffnen → Knopf **Download raw file**):
   - `docker-compose.nas.yml`: auf dem NAS umbenennen in **`docker-compose.yml`**. Die NAS-Oberflächen erwarten diesen Namen.
   - `.env.nas.example`: auf dem NAS umbenennen in **`.env`** (mit Punkt am Anfang).
3. Die IP-Adresse des NAS herausfinden: Router-Oberfläche (z. B. fritz.box → Heimnetz) oder NAS-Systeminfo. Beispiel: `192.168.178.20`.

## 3. Die Datei `.env` ausfüllen

Mit einem Texteditor öffnen. Synology: Paket „Text Editor“, oder die Datei auf dem PC bearbeiten und wieder hochladen.

| Eintrag | Was eintragen |
|---|---|
| `APP_URL` | `http://<IP-des-NAS>:3000`, z. B. `http://192.168.178.20:3000` |
| `APP_PORT` | `3000`. Ist der Port schon belegt, eine andere Zahl (z. B. `3080`) und dann auch in `APP_URL` ändern. |
| `POSTGRES_PASSWORD` | Eine lange Zufallsfolge aus Buchstaben und Ziffern (z. B. 32 Zeichen aus deinem Passwortmanager). Keine Sonderzeichen wie `@ : / #`. |
| `APP_SECRET` | Eine zweite, andere Zufallsfolge, 64 Zeichen. **Gut aufbewahren und nie ändern.** |
| `FINANTSEN_TAG` | `latest`. Solange der Entwicklungszweig noch nicht in `main` übernommen ist: `claude-magical-feynman-h8qjkz` |

Den Rest leer lassen. Mail und Push kommen später.

## 4. Starten

### Synology (Container Manager)
1. **Container Manager** öffnen → **Projekt** → **Erstellen**.
2. Projektname `finantsen`, Pfad: den Ordner aus Schritt 2 wählen.
3. Container Manager erkennt die vorhandene `docker-compose.yml` → **Vorhandene docker-compose.yml verwenden**.
4. Weiter bis **Fertig**. Die Images werden heruntergeladen und gestartet (beim ersten Mal 1–3 Minuten).

### QNAP (Container Station)
1. **Container Station** → **Anwendungen** → **Erstellen**.
2. Namen `finantsen` eingeben und den Inhalt der `docker-compose.yml` einfügen.
3. Falls Container Station die `.env` nicht liest: In der eingefügten Datei die Platzhalter `${...}` direkt durch deine Werte ersetzen (z. B. `${APP_URL:?…}` → `http://192.168.178.20:3000`).
4. **Erstellen**.

### Portainer, Unraid (Compose-Plugin) und andere
Neuen **Stack** anlegen, die `docker-compose.yml` einfügen oder hochladen und die Werte aus der `.env` als Umgebungsvariablen eintragen.

### Per SSH (alle NAS, falls SSH eingeschaltet ist)
```bash
cd /volume1/docker/finantsen          # Pfad zu deinem Ordner
sudo docker compose pull
sudo docker compose up -d
sudo docker compose logs -f app        # Beenden mit Strg+C
```
Im Log sollten `migrations applied` und `Ready` erscheinen.

## 5. Erste Anmeldung

1. Im Browser `http://<IP-des-NAS>:3000` öffnen.
2. Es erscheint die **Einrichtung**: Name, Nutzername und Passwort für dich als Admin. Wer die Seite zuerst öffnet, wird Admin, also gleich selbst erledigen.
3. Fertig. Weitere Konten legst du unter *Konto → Nutzer verwalten* an.

## 6. Aktualisieren (neue Version)

- **Synology:**
  1. Container Manager → **Projekt** → `finantsen` → **Aktion** → **Stoppen**.
  2. Danach **Image** → `ghcr.io/kerosinkleber/finantsen` → **Aktualisieren** (falls angeboten) oder per SSH (siehe unten).
  3. Danach das Projekt wieder **Starten**.

  Die Bezeichnungen können je nach DSM-Version leicht abweichen.
- **Per SSH (überall gleich):**
  ```bash
  cd /volume1/docker/finantsen
  sudo docker compose pull && sudo docker compose up -d
  ```

Deine Daten bleiben dabei erhalten. Die Datenbank wird beim Start automatisch auf die neue Version angepasst.

## 7. Daten sichern

Die Daten liegen im Docker-Volume `finantsen_db-data`. Am einfachsten sicherst du die Datenbank per SSH in eine Datei:

```bash
cd /volume1/docker/finantsen
sudo docker compose exec -T db pg_dump -U finantsen -Fc finantsen > finantsen-$(date +%F).dump
```

Diese Datei auf ein anderes Laufwerk oder in dein NAS-Backup legen. **`APP_SECRET` getrennt notieren** (ohne ihn sind Zwei-Faktor-Einrichtungen nicht mehr lesbar). Eine automatische tägliche Sicherung richte ich ein, wenn wir den Dauerbetrieb planen (Fragebogen 9, Frage 7).

## 8. Wenn etwas nicht klappt

| Problem | Lösung |
|---|---|
| Fehler „APP_URL/APP_SECRET/POSTGRES_PASSWORD … setzen“ | Die `.env` liegt nicht im selben Ordner, heißt nicht genau `.env`, oder der Eintrag ist leer. |
| „denied“ / „unauthorized“ beim Laden des Images | Das Paket ist noch privat, siehe Schritt 1. |
| „no matching manifest for linux/arm/v7“ | 32-Bit-NAS, wird leider nicht unterstützt. |
| Seite lädt nicht | Port in `APP_URL` und `APP_PORT` gleich? Ist der Port vom NAS selbst belegt? Dann `APP_PORT` ändern. Firewall des NAS: Port freigeben. |
| Anmeldung klappt, aber „Ungültige Anfrage“ | Die App über genau die Adresse öffnen, die in `APP_URL` steht. |
| Log ansehen | Container Manager → Container `finantsen-app-1` → **Protokoll**, oder `sudo docker compose logs app` |
