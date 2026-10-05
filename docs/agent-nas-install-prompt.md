# Prompt: Finantsen auf dem Test-NAS installieren (lokale Claude-Code-Sitzung)

Diesen Text komplett in eine **Claude-Code-Sitzung auf deinem PC im Heimnetz** einfügen (nicht in die Cloud-Sitzung, die kommt nicht an den NAS). Die Sitzung arbeitet ihn Schritt für Schritt ab und fragt dich, wo du etwas tun musst. Passwörter tippst nur du, nie in den Chat.

---

Du installierst die Web-App **Finantsen** (fertiges Docker-Image, nichts bauen) auf einem **Test-NAS** im Heimnetz. Ich bin der Besitzer. Das Gerät ist ein reines Entwicklungs-/Testgerät, eingerichtet für genau diesen Zweck. Arbeite die Schritte der Reihe nach ab und berichte am Ende kurz.

## Eckdaten
- NAS: **UGREEN NASync DXP2800**, System **UGOS Pro** (Debian-basiert), Intel x86-64, IP **192.168.77.27**. SSH ist an (Port 22), SMB auch.
- Den **UGOS-Nutzernamen** fragst du mich als Erstes. Mein Passwort fragst du **nie** ab und speicherst es nirgends. Wo ein Passwort nötig ist, tippe ich es selbst in ein Terminal.
- App-Image: `ghcr.io/kerosinkleber/finantsen:claude-magical-feynman-h8qjkz` (öffentlich, ohne Anmeldung ladbar).
- Dateien aus dem öffentlichen Repo, Zweig `claude/magical-feynman-h8qjkz`:
  - `https://raw.githubusercontent.com/kerosinkleber/finantsen/claude/magical-feynman-h8qjkz/docker-compose.nas.yml`
  - `https://raw.githubusercontent.com/kerosinkleber/finantsen/claude/magical-feynman-h8qjkz/.env.nas.example`
- Anleitung zum Nachlesen: `docs/anleitung-ugreen.md` im selben Repo.

## Grenzen (unbedingt einhalten)
- Arbeite auf dem NAS **nur** im Ordner `<volume>/docker/finantsen` und nur mit den Docker-Containern, -Volumes und -Netzwerken des Compose-Projekts **`finantsen`**.
- **Nicht** anfassen: andere Container und Images, `docker system prune` oder ähnliches Aufräumen, Systemeinstellungen, Firewall, Nutzer und Rechte (Ausnahme: Schritt 2 und `~/.ssh/authorized_keys` meines Nutzers), Neustarts des NAS, Paketinstallationen.
- **Geheimnisse** (Datenbankpasswort, `APP_SECRET`) erzeugst du zufällig und schreibst sie **nur** in die `.env` auf dem NAS. Gib sie **nicht** im Chat aus.
- Wenn etwas anders ist als hier beschrieben (anderer Pfad, Fehler, fehlende Rechte): **anhalten und mich fragen**, nicht improvisieren.

## Schritt 1: Verbindung und SSH-Schlüssel
1. Frag mich nach dem UGOS-Nutzernamen (im Folgenden `NUTZER`).
2. Prüfe, ob auf dem PC ein SSH-Schlüssel existiert (`~/.ssh/id_ed25519.pub`, unter Windows `%USERPROFILE%\.ssh\id_ed25519.pub`). Falls nicht, lege einen an: `ssh-keygen -t ed25519 -N "" -f <Pfad>` (ohne Passphrase ist hier in Ordnung, Testgerät).
3. Den öffentlichen Schlüssel auf den NAS bringen. Das braucht einmal mein Passwort. Gib mir den **fertigen Befehl** zum Ausführen in einem eigenen Terminal, z. B. unter Windows (PowerShell):
   `type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh NUTZER@192.168.77.27 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"`
   Unter Linux/macOS: `ssh-copy-id NUTZER@192.168.77.27`.
4. Danach testest du ohne Passwort: `ssh -o BatchMode=yes NUTZER@192.168.77.27 "uname -m; id; docker --version; docker compose version"`.
   - Erwartet: `x86_64`. Falls `docker compose` fehlt, aber `docker-compose` existiert, nimm das.

## Schritt 2: Docker ohne `sudo` (einmalig, ich tippe das Passwort)
- Prüfe mit `ssh -o BatchMode=yes NUTZER@192.168.77.27 "docker ps"`, ob Docker ohne `sudo` geht.
- Falls nicht („permission denied … docker.sock“): Prüfe, ob es die Gruppe `docker` gibt (`getent group docker`). Wenn ja, gib mir diesen Befehl für mein eigenes Terminal (fragt nach meinem Passwort):
  `ssh -t NUTZER@192.168.77.27 "sudo usermod -aG docker NUTZER"`
  Danach neu verbinden und `docker ps` erneut testen. (Hinweis an mich: Mitglieder der Gruppe `docker` haben praktisch Admin-Rechte; auf diesem Testgerät gewollt.)
- Gibt es keine Gruppe `docker` oder klappt es nicht: Bereite in Schritt 3 trotzdem alles vor und gib mir in Schritt 4 die `sudo`-Befehle zum Selbst-Ausführen.

## Schritt 3: Ordner und Dateien
1. Finde den Freigabeordner `docker`: `ssh … "ls -d /volume*/docker 2>/dev/null"`. Gibt es keinen, halt an: Ich lege ihn in UGOS an (Dateien → Freigabeordner `docker`) oder sage dir einen anderen Ort.
2. Lege `<volume>/docker/finantsen` an. Gibt es den Ordner schon mit Inhalt (z. B. eine `.env`), **nichts überschreiben**, sondern mich fragen.
3. Lade dort mit `curl -fsSL` (oder `wget`) die beiden Dateien: `docker-compose.nas.yml` → speichern als **`docker-compose.yml`**, `.env.nas.example` → speichern als **`.env`**. (Falls der NAS kein curl/wget hat: auf dem PC laden und per `scp` kopieren.)
4. Prüfe, ob Port 3000 auf dem NAS frei ist (`ss -ltn` oder `netstat -ltn`). Belegt? Dann 3080 nehmen (und unten überall statt 3000).
5. `.env` ausfüllen, ohne die Werte auszugeben (z. B. mit `sed -i` und Werten aus `openssl rand -hex …` direkt auf dem NAS, oder `head -c … /dev/urandom | od`/`tr`, falls kein openssl):
   - `APP_URL=http://192.168.77.27:3000`
   - `APP_PORT=3000`
   - `POSTGRES_PASSWORD=` 32 Zeichen hex (nur Buchstaben/Ziffern)
   - `APP_SECRET=` 64 Zeichen hex
   - `FINANTSEN_TAG=claude-magical-feynman-h8qjkz`
   - Rest unverändert lassen (kein Mail, kein Push).
   - Danach `chmod 600 .env`. Prüfe nur, **dass** die Felder gefüllt sind (z. B. Zeichenzahl ausgeben), nicht den Inhalt.

## Schritt 4: Starten
Im Ordner `<volume>/docker/finantsen`:
1. `docker compose pull` (lädt `postgres:16-alpine` und das Finantsen-Image)
2. `docker compose up -d`
3. Bis zu 2 Minuten warten, dann prüfen:
   - `docker compose ps`: beide Dienste laufen, `db` ist `healthy`.
   - `docker compose logs app --tail 50`: enthält `migrations applied` und `Ready`. Steht dort `START ABGEBROCHEN`, `APP_SECRET fehlt` oder ein anderer Fehler: anhalten, Log zeigen (ohne Geheimnisse).
   - Auf dem NAS: `curl -s http://127.0.0.1:3000/api/health` → `{"status":"ok","db":"ok"}`
   - Vom **PC** aus: `curl -s http://192.168.77.27:3000/api/health` → gleiche Antwort. Klappt es nur auf dem NAS, blockiert vermutlich die UGOS-Firewall: **nicht selbst ändern**, sondern mir sagen (*Systemsteuerung → Sicherheit → Firewall*, TCP 3000 fürs Heimnetz erlauben).
   - Vom PC: `curl -s -o /dev/null -w "%{http_code}" http://192.168.77.27:3000/setup` → 200.
4. **Nicht** `/setup` ausfüllen. Den ersten Admin lege ich selbst an.

## Schritt 5: Bericht an mich
Kurz und auf Deutsch:
- was gemacht wurde (Pfad auf dem NAS, Port, Image-Tag, ob Docker-Gruppe gesetzt wurde)
- Ergebnis der Prüfungen (health auf NAS und vom PC, Log-Zeilen)
- die Adresse zum Öffnen: `http://192.168.77.27:3000` → Einrichtung des Admins
- **Erinnerung:** `APP_SECRET` aus der `.env` (`<volume>/docker/finantsen/.env`) einmal in meinen Passwortmanager übernehmen; nie ändern
- Befehle für später: Update (`cd <Pfad> && docker compose pull && docker compose up -d`), Log (`docker compose logs -f app`), Stoppen (`docker compose down`, **ohne** `-v`, sonst sind die Daten weg), Backup (`docker compose exec -T db pg_dump -U finantsen -Fc finantsen > finantsen-$(date +%F).dump`)
- Hinweis: In der UGOS-Docker-App erscheinen die Container unter **Container** (`finantsen-app-1`, `finantsen-db-1`). Unter **Projekt** stehen sie evtl. nicht, weil sie per Kommandozeile angelegt wurden. Das ist normal.
