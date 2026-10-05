# Fragebogen 9: Release und Betrieb bei dir zu Hause

So füllst du ihn aus: Kreuze mit `[x]` an oder schreibe unter **Antwort**. Mit "(Empfehlung)" markiere ich, was ich nehmen würde. Diesmal richte ich erst nach deinen Antworten ein, weil es um deinen Rechner, dein Netz und deine Konten geht.

---

## Schon entschieden (nur zur Kontrolle, bitte nicht ausfüllen)

- Der Server läuft **bei dir zu Hause**, von außen höchstens per **VPN**. Es gibt keine öffentliche Webseite.
- Höchstens etwa **20 Nutzer**, möglichst **keine laufenden Kosten**.
- Ersteinrichtung `/setup` ohne Schutzcode: Wer die Seite zuerst aufruft, wird Admin. Du richtest deinen Admin also direkt nach dem ersten Start ein.
- Belegscan mit weiteren Anbietern ist verschoben.
- **Zwei-Faktor** kann der Admin schon heute **für alle gleichzeitig** verlangen (*Konto → Nutzer verwalten → Einstellungen → „Zwei-Faktor für alle verpflichtend“*) **und einzeln je Nutzer** (*Nutzer verwalten → beim Konto „Zwei-Faktor verlangen“*). Das ist fertig und getestet, hier ist nichts zu tun.
- Testfunktionen sind im Produktiv-Stack aus (Dev-Admin, Testnutzer, Test-Postfach). Für den Release nimmst du eine **frische Datenbank**, nicht die Testdaten.

---

## Frage 0: Auf welchem Rechner läuft der Server?

Davon hängen Installation, automatischer Start und Backups ab.

- [ ] Windows-PC mit Docker Desktop
- [ ] Linux-Rechner / Mini-PC / Raspberry Pi (64 Bit) mit Docker
- [ ] NAS mit Docker (z. B. Synology, QNAP, Unraid): welches? ______
- [ ] Weiß ich noch nicht, bitte beraten

Läuft der Rechner dauerhaft (24/7)?
- [ ] ja
- [ ] nein, nur manchmal (dann gibt es auch die App nur manchmal; wiederkehrende Ausgaben werden beim nächsten Start nachgebucht)

Antwort / Anmerkung:

## Frage 1: Wie bekommt die App HTTPS ohne öffentliche Webseite?

**Warum überhaupt HTTPS, wenn alles lokal ist?** Browser erlauben viele Funktionen nur über eine sichere Verbindung: **Kamera** (QR-Scanner), **Passkeys**, **App installieren** (Startbildschirm), **Offline-Modus** und **Push-Nachrichten**. Über `http://192.168.x.x` fehlt das alles, und Passwörter gingen unverschlüsselt durchs WLAN.

- [ ] **Kostenlose Subdomain bei DuckDNS + Zertifikat per DNS-Prüfung** (Empfehlung). Du bekommst einen Namen wie `meinname.duckdns.org`, der auf die **interne** Adresse deines Servers zeigt (z. B. `192.168.178.20`). Let's Encrypt stellt ein echtes Zertifikat aus, ohne dass dein Server aus dem Internet erreichbar sein muss. Auf allen Geräten gilt es sofort, ohne Einrichtung. Kosten: keine. Du brauchst nur ein DuckDNS-Konto (Anmeldung mit Google oder GitHub) und kopierst einen Token in die `.env`. Ich baue Caddy dafür mit dem passenden Zusatzmodul. Abhängigkeit: Der kostenlose Dienst DuckDNS muss erreichbar sein, wenn das Zertifikat erneuert wird (alle ~60 Tage).
- [ ] **Eigene Domain** (ca. 5–15 € pro Jahr), DNS z. B. kostenlos bei Cloudflare. Gleiche Technik wie oben, aber unabhängig von DuckDNS und mit einem schöneren Namen.
- [ ] **Internes Zertifikat** (Caddy erzeugt es selbst). Keine fremden Dienste, aber auf **jedem** Handy und PC muss einmal das Stammzertifikat installiert und als vertrauenswürdig markiert werden. Bei 20 Nutzern mühsam, beim iPhone sind es mehrere Schritte.
- [ ] **Ohne HTTPS** (`http://IP-Adresse`). Nicht empfohlen: Kamera-Scanner, Passkeys, App-Installation, Offline und Push funktionieren dann nicht.

Antwort / Anmerkung:

## Frage 2: Wie kommen Nutzer von unterwegs per VPN dran?

- [ ] **Über deinen Router**, z. B. FRITZ!Box (WireGuard ist eingebaut, je Person ein QR-Code für die WireGuard-App) (Empfehlung, wenn dein Router das kann). Welcher Router? ______
- [ ] **WireGuard im Docker** auf dem Server (wg-easy, mit Weboberfläche). Dafür muss am Router ein UDP-Port freigegeben werden.
- [ ] **Tailscale** (sehr einfach, aber kostenlos nur für bis zu 3 Nutzer)
- [ ] **Gar nicht**, nur im Heimnetz
- [ ] Habe schon ein VPN: ______

Hinweis: Mit DuckDNS bzw. eigener Domain (Frage 1) funktioniert derselbe Name im Heimnetz **und** über VPN, weil er auf die interne Adresse zeigt.

Antwort / Anmerkung:

## Frage 3: Mailversand ohne Kosten (Einmal-Links, „Passwort vergessen“, Benachrichtigungen)

**Kurz erklärt:** SPF und DKIM sind Einträge, mit denen ein Mailanbieter beweist, dass er im Namen einer Adresse senden darf. Fehlen sie, landen Mails im Spam. **Wenn du über ein normales Mailkonto sendest (z. B. Gmail oder GMX), erledigt das der Anbieter für dich**, du musst nichts einrichten. Nur wer von einer **eigenen Domain** sendet, muss die Einträge selbst setzen.

- [ ] **Ein eigenes, neues kostenloses Mailkonto nur für die App**, z. B. bei **GMX** oder **web.de** (in den Einstellungen „Zugriff per POP3/IMAP/SMTP erlauben“ einschalten) oder **Gmail** (Bestätigung in zwei Schritten einschalten und ein „App-Passwort“ erzeugen) (Empfehlung). Kostenlos, gute Zustellung, Grenzen von einigen Hundert Mails pro Tag, mehr als genug für 20 Nutzer. Ich schreibe dir eine Schritt-für-Schritt-Anleitung für den Anbieter deiner Wahl. Welcher? ______
- [ ] **Brevo** (kostenlos bis 300 Mails/Tag, eher für eigene Domain gedacht, Registrierung mit Firmenangaben)
- [ ] **Vorerst kein Mailversand**: Einmal-Links gibst du selbst weiter, „Passwort vergessen“ gibt es dann nicht.

Antwort / Anmerkung:

## Frage 4: Automatischer Schutz gegen vergessene Testfunktionen

**Was ist das Problem?** Im lokalen Test-Stack sind zwei Dinge an, die produktiv gefährlich wären:
1. Der **Dev-Admin**: ein Admin-Konto ohne Passwort, Anmeldung per Knopf. Wäre das produktiv an, könnte sich **jeder im Netz als Admin anmelden**.
2. Die **Testfunktionen**: Testnutzer und „Handeln als“. Harmlos für Fremde, aber Testnutzer würden in echten Gruppen auftauchen.

Heute schützt dich davor nur, dass der Produktiv-Stack beides nicht setzt, und die Release-Checkliste. Ein automatischer Schutz würde zusätzlich Folgendes tun:

**a) Startsperre für den Dev-Admin.** Ist `DEV_ADMIN=true` gesetzt und die App-Adresse (`APP_URL`) **nicht** `localhost`, **startet die App nicht**. Im Log steht dann klar, warum („DEV_ADMIN ist nur für lokale Tests erlaubt, bitte aus der .env entfernen“). Für dich ändert sich im Normalbetrieb nichts. Lokale Tests mit `http://localhost` funktionieren weiter. Die Sperre greift nur, wenn jemand den Test-Schalter versehentlich in die echte Installation übernimmt.

**b) Warnhinweis im Admin-Bereich.** Solange die Testfunktionen eingeschaltet sind **oder** noch Testnutzer existieren, zeigt *Nutzer verwalten* oben einen gelben Hinweis mit Knöpfen zum Ausschalten bzw. zum Löschen der Testnutzer. Nichts wird automatisch gelöscht.

- [ ] **Beides, a) und b)** (Empfehlung)
- [ ] Nur a)
- [ ] Nur b)
- [ ] Nichts davon, die Checkliste reicht

Antwort / Anmerkung:

## Frage 5: Import aus Tricount

Meine Recherche hat ergeben: **Tricount hat die eingebaute Export-Funktion entfernt** (es gibt sie nur noch über den Support oder über fremde Web-Tools, denen man den Teilen-Link der Gruppe gibt). Einen echten Export kann ich selbst nicht erzeugen, ich habe kein Tricount-Konto mit deinen Daten.

- [ ] **Brauche ich nicht**, wir nutzen kein Tricount (Empfehlung, falls das zutrifft). Der Import bleibt wie er ist, ungetestet gekennzeichnet.
- [ ] **Ich habe Tricount-Gruppen und will sie übernehmen.** Dann schreibe ich dir eine ausführliche Anleitung (Export anfordern beim Tricount-Support oder per Export-Tool, Datei prüfen, in Finantsen importieren) und passe den Import an deine echte Datei an.
- [ ] Ich nutze **Splitwise** und will von dort umziehen (der Splitwise-Import ist gebaut, aber auch dort hätte ich gern eine echte Datei zum Prüfen).

Antwort / Anmerkung:

## Frage 6: Push-Nachrichten aufs Handy

- [ ] **Ja** (Empfehlung). Kostenlos, ich erzeuge die Schlüssel beim Einrichten (`npm run vapid`). Braucht HTTPS (Frage 1). Auf dem iPhone geht Push nur, wenn die App zum Home-Bildschirm hinzugefügt wurde.
- [ ] Nein, Benachrichtigungen in der App (und per E-Mail) reichen

Antwort / Anmerkung:

## Frage 7: Backups

- [ ] **Täglich automatisch auf ein zweites Laufwerk oder NAS**, 14 Tage aufbewahrt, dazu `APP_SECRET` einmal getrennt notieren (Empfehlung). Wohin? ______
- [ ] Ich mache Backups selbst

Antwort / Anmerkung:

---

## Meine Annahmen (gelten, wenn du nichts anderes schreibst)

1. Nach deinen Antworten schreibe ich eine **Schritt-für-Schritt-Anleitung „Inbetriebnahme bei mir zu Hause“** passend zu deinem Rechner, Router und Mailanbieter und passe die Konfiguration an (z. B. Caddy für DuckDNS). Die Anleitung ist so geschrieben, dass du sie ohne Programmierkenntnisse abarbeiten kannst.
2. Die Datenbank des lokalen Tests wird **nicht** weiterverwendet. Der Release startet leer, du legst deinen Admin über `/setup` an.
3. Updates spielst du später mit zwei Befehlen ein (Code holen, neu starten). Die Datenbank wird dabei automatisch angepasst.
4. Ohne Antwort zu Frage 4 baue ich nichts davon ein.
