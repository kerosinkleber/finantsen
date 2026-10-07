# Fragebogen 9: Release und Betrieb bei dir zu Hause

So füllst du ihn aus: Kreuze mit `[x]` an oder schreibe unter **Antwort**. Mit "(Empfehlung)" markiere ich, was ich nehmen würde. Diesmal richte ich erst nach deinen Antworten ein, weil es um deinen Rechner, dein Netz und deine Konten geht.

---

## Schon entschieden (nur zur Kontrolle, bitte nicht ausfüllen)

* Der Server läuft **bei dir zu Hause**, von außen höchstens per **VPN**. Es gibt keine öffentliche Webseite.
* Höchstens etwa **20 Nutzer**, möglichst **keine laufenden Kosten**.
* Ersteinrichtung `/setup` ohne Schutzcode: Wer die Seite zuerst aufruft, wird Admin. Du richtest deinen Admin also direkt nach dem ersten Start ein.
* Belegscan mit weiteren Anbietern ist verschoben.
* **Zwei-Faktor** kann der Admin schon heute **für alle gleichzeitig** verlangen (*Konto → Nutzer verwalten → Einstellungen → „Zwei-Faktor für alle verpflichtend“*) **und einzeln je Nutzer** (*Nutzer verwalten → beim Konto „Zwei-Faktor verlangen“*). Das ist fertig und getestet, hier ist nichts zu tun.
* Testfunktionen sind im Produktiv-Stack aus (Dev-Admin, Testnutzer, Test-Postfach). Für den Release nimmst du eine **frische Datenbank**, nicht die Testdaten.

---

## Frage 0: Auf welchem Rechner läuft der Server?

Davon hängen Installation, automatischer Start und Backups ab.

* [ ] Windows-PC mit Docker Desktop
* [ ] Linux-Rechner / Mini-PC / Raspberry Pi (64 Bit) mit Docker
* [x] NAS mit Docker (z. B. Synology, QNAP, Unraid): welches? Ugreen NASync DXP2800
* [ ] Weiß ich noch nicht, bitte beraten

Läuft der Rechner dauerhaft (24/7)?

* [x] ja
* [ ] nein, nur manchmal (dann gibt es auch die App nur manchmal; wiederkehrende Ausgaben werden beim nächsten Start nachgebucht)

Antwort / Anmerkung:

## Frage 1: Wie bekommt die App HTTPS ohne öffentliche Webseite?

**Warum überhaupt HTTPS, wenn alles lokal ist?** Browser erlauben viele Funktionen nur über eine sichere Verbindung: **Kamera** (QR-Scanner), **Passkeys**, **App installieren** (Startbildschirm), **Offline-Modus** und **Push-Nachrichten**. Über `http://192.168.x.x` fehlt das alles, und Passwörter gingen unverschlüsselt durchs WLAN.

* [ ] **Kostenlose Subdomain bei DuckDNS + Zertifikat per DNS-Prüfung** (Empfehlung). Du bekommst einen Namen wie `meinname.duckdns.org`, der auf die **interne** Adresse deines Servers zeigt (z. B. `192.168.178.20`). Let's Encrypt stellt ein echtes Zertifikat aus, ohne dass dein Server aus dem Internet erreichbar sein muss. Auf allen Geräten gilt es sofort, ohne Einrichtung. Kosten: keine. Du brauchst nur ein DuckDNS-Konto (Anmeldung mit Google oder GitHub) und kopierst einen Token in die `.env`. Ich baue Caddy dafür mit dem passenden Zusatzmodul. Abhängigkeit: Der kostenlose Dienst DuckDNS muss erreichbar sein, wenn das Zertifikat erneuert wird (alle ~60 Tage).
* [ ] **Eigene Domain** (ca. 5–15 € pro Jahr), DNS z. B. kostenlos bei Cloudflare. Gleiche Technik wie oben, aber unabhängig von DuckDNS und mit einem schöneren Namen.
* [ ] **Internes Zertifikat** (Caddy erzeugt es selbst). Keine fremden Dienste, aber auf **jedem** Handy und PC muss einmal das Stammzertifikat installiert und als vertrauenswürdig markiert werden. Bei 20 Nutzern mühsam, beim iPhone sind es mehrere Schritte.
* [x] **Ohne HTTPS** (`http://IP-Adresse`). Nicht empfohlen: Kamera-Scanner, Passkeys, App-Installation, Offline und Push funktionieren dann nicht.

Antwort / Anmerkung: https sollte in der app beibehalten werden damit ein online Hosting möglich ist. für home Hosting sollte ein http betrieb allerdings möglich sein, auch wenn dann die aufgelisteten Features nicht funktionieren. wenn die app mit http läuft sollten nicht funktionierende Funktionen für den admin und user dementsprechend ausgegraut und mit hinweis versehen werden.

## Frage 2: Wie kommen Nutzer von unterwegs per VPN dran?

* [ ] **Über deinen Router**, z. B. FRITZ!Box (WireGuard ist eingebaut, je Person ein QR-Code für die WireGuard-App) (Empfehlung, wenn dein Router das kann). Welcher Router? Fritzbox7490
* [ ] **WireGuard im Docker** auf dem Server (wg-easy, mit Weboberfläche). Dafür muss am Router ein UDP-Port freigegeben werden.
* [ ] **Tailscale** (sehr einfach, aber kostenlos nur für bis zu 3 Nutzer)
* [ ] **Gar nicht**, nur im Heimnetz
* [ ] Habe schon ein VPN: ______

Hinweis: Mit DuckDNS bzw. eigener Domain (Frage 1) funktioniert derselbe Name im Heimnetz **und** über VPN, weil er auf die interne Adresse zeigt.

Antwort / Anmerkung: Über UGREEN Link

## Frage 3: Mailversand ohne Kosten (Einmal-Links, „Passwort vergessen“, Benachrichtigungen)

**Kurz erklärt:** SPF und DKIM sind Einträge, mit denen ein Mailanbieter beweist, dass er im Namen einer Adresse senden darf. Fehlen sie, landen Mails im Spam. **Wenn du über ein normales Mailkonto sendest (z. B. Gmail oder GMX), erledigt das der Anbieter für dich**, du musst nichts einrichten. Nur wer von einer **eigenen Domain** sendet, muss die Einträge selbst setzen.

* [ ] **Ein eigenes, neues kostenloses Mailkonto nur für die App**, z. B. bei **GMX** oder **web.de** (in den Einstellungen „Zugriff per POP3/IMAP/SMTP erlauben“ einschalten) oder **Gmail** (Bestätigung in zwei Schritten einschalten und ein „App-Passwort“ erzeugen) (Empfehlung). Kostenlos, gute Zustellung, Grenzen von einigen Hundert Mails pro Tag, mehr als genug für 20 Nutzer. Ich schreibe dir eine Schritt-für-Schritt-Anleitung für den Anbieter deiner Wahl. Welcher? ______
* [ ] **Brevo** (kostenlos bis 300 Mails/Tag, eher für eigene Domain gedacht, Registrierung mit Firmenangaben)
* [x] **Vorerst kein Mailversand**: Einmal-Links gibst du selbst weiter, „Passwort vergessen“ gibt es dann nicht.

Antwort / Anmerkung:

## Frage 4: Automatischer Schutz gegen vergessene Testfunktionen

**Was ist das Problem?** Im lokalen Test-Stack sind zwei Dinge an, die produktiv gefährlich wären:

1. Der **Dev-Admin**: ein Admin-Konto ohne Passwort, Anmeldung per Knopf. Wäre das produktiv an, könnte sich **jeder im Netz als Admin anmelden**.
2. Die **Testfunktionen**: Testnutzer und „Handeln als“. Harmlos für Fremde, aber Testnutzer würden in echten Gruppen auftauchen.

Heute schützt dich davor nur, dass der Produktiv-Stack beides nicht setzt, und die Release-Checkliste. Ein automatischer Schutz würde zusätzlich Folgendes tun:

**a) Startsperre für den Dev-Admin.** Ist `DEV_ADMIN=true` gesetzt und die App-Adresse (`APP_URL`) **nicht** `localhost`, **startet die App nicht**. Im Log steht dann klar, warum („DEV_ADMIN ist nur für lokale Tests erlaubt, bitte aus der .env entfernen“). Für dich ändert sich im Normalbetrieb nichts. Lokale Tests mit `http://localhost` funktionieren weiter. Die Sperre greift nur, wenn jemand den Test-Schalter versehentlich in die echte Installation übernimmt.

**b) Warnhinweis im Admin-Bereich.** Solange die Testfunktionen eingeschaltet sind **oder** noch Testnutzer existieren, zeigt *Nutzer verwalten* oben einen gelben Hinweis mit Knöpfen zum Ausschalten bzw. zum Löschen der Testnutzer. Nichts wird automatisch gelöscht.

* [x] **Beides, a) und b)** (Empfehlung)
* [ ] Nur a)
* [ ] Nur b)
* [ ] Nichts davon, die Checkliste reicht

Antwort / Anmerkung:

## Frage 5: Import aus Tricount

Meine Recherche hat ergeben: **Tricount hat die eingebaute Export-Funktion entfernt** (es gibt sie nur noch über den Support oder über fremde Web-Tools, denen man den Teilen-Link der Gruppe gibt). Einen echten Export kann ich selbst nicht erzeugen, ich habe kein Tricount-Konto mit deinen Daten.

* [x] **Brauche ich nicht**, wir nutzen kein Tricount (Empfehlung, falls das zutrifft). Der Import bleibt wie er ist, ungetestet gekennzeichnet.
* [ ] **Ich habe Tricount-Gruppen und will sie übernehmen.** Dann schreibe ich dir eine ausführliche Anleitung (Export anfordern beim Tricount-Support oder per Export-Tool, Datei prüfen, in Finantsen importieren) und passe den Import an deine echte Datei an.
* [ ] Ich nutze **Splitwise** und will von dort umziehen (der Splitwise-Import ist gebaut, aber auch dort hätte ich gern eine echte Datei zum Prüfen).

Antwort / Anmerkung:

## Frage 6: Push-Nachrichten aufs Handy

* [x] **Ja** (Empfehlung). Kostenlos, ich erzeuge die Schlüssel beim Einrichten (`npm run vapid`). Braucht HTTPS (Frage 1). Auf dem iPhone geht Push nur, wenn die App zum Home-Bildschirm hinzugefügt wurde.
* [ ] Nein, Benachrichtigungen in der App (und per E-Mail) reichen

Antwort / Anmerkung:

## Frage 7: Backups

* [ ] **Täglich automatisch auf ein zweites Laufwerk oder NAS**, 14 Tage aufbewahrt, dazu `APP_SECRET` einmal getrennt notieren (Empfehlung). Wohin? ______
* [x] Ich mache Backups selbst

Antwort / Anmerkung:

---

## Meine Annahmen (gelten, wenn du nichts anderes schreibst)

1. Nach deinen Antworten schreibe ich eine **Schritt-für-Schritt-Anleitung „Inbetriebnahme bei mir zu Hause“** passend zu deinem Rechner, Router und Mailanbieter und passe die Konfiguration an (z. B. Caddy für DuckDNS). Die Anleitung ist so geschrieben, dass du sie ohne Programmierkenntnisse abarbeiten kannst. 
2. Die Datenbank des lokalen Tests wird **nicht** weiterverwendet. Der Release startet leer, du legst deinen Admin über `/setup` an.
3. Updates spielst du später mit zwei Befehlen ein (Code holen, neu starten). Die Datenbank wird dabei automatisch angepasst.
4. Ohne Antwort zu Frage 4 baue ich nichts davon ein.

---

## Umsetzung (meine Auslegung deiner Antworten)

**Frage 0 – UGREEN NASync DXP2800, 24/7.** Die DXP2800 hat einen Intel-Prozessor (x86-64) und läuft ab Werk mit **UGOS Pro**, dem Betriebssystem der DXP-Serie. Die Docker-App ist bei dir schon installiert. Anleitung: `docs/anleitung-ugreen.md` (mit Abschnitt für deine DXP2800 und Fernzugriff).

**Frage 1 – Ohne HTTPS, aber HTTPS bleibt möglich.** Gebaut:
- Die App funktioniert über `http://IP:Port` (war schon so) **und** weiterhin über HTTPS (Caddy im Server-Stack, Online-Hosting). Nichts wurde entfernt.
- Läuft die App ohne HTTPS, erkennt der Browser das selbst (`window.isSecureContext`). Dann sind **ausgegraut mit Hinweis**: QR-Scan mit der Kamera (Einladungslink einfügen geht weiter), Passkey-Anmeldung und Passkey einrichten, Push einschalten. In den **Einstellungen** steht für alle Nutzer eine Übersicht, was fehlt (auch App installieren und Offline-Modus) und dass alles andere normal funktioniert. Im **Admin-Bereich** steht zusätzlich, wie man es ändert (HTTPS).
- Sobald die App über `https://` erreichbar ist, verschwinden die Hinweise von selbst, ohne Umstellung.
- `localhost` zählt bei Browsern als sicher. Beim Ausprobieren direkt am NAS-Rechner siehst du die Hinweise also nicht, auf dem Handy im WLAN schon.

**Frage 2 – Fernzugriff über UGREEN Link.** *Nachtrag: Laut UGREEN-Support erreicht UGREENlink Finantsen nicht. Es bleibt WireGuard über die FRITZ!Box (unten).* Hier war ich unsicher und habe es nicht prüfen können: UGREENlink ist für den Zugriff auf UGOS und UGREEN-Apps gedacht. Nach UGREENs eigener Beschreibung unterstützt es seit einem UGOS-Update den Fernzugriff auf **einige** Container-Apps. Ob das für Finantsen (eigener Container, Port 3000) gilt, weiß ich nicht. Zwei Dinge sind sicher:
- Einmal-Links und Einladungslinks enthalten die Adresse aus `APP_URL` (die Heimnetz-Adresse). Von unterwegs funktionieren diese Links nur mit VPN.
- Falls UGREENlink Finantsen nicht erreicht, ist der Plan B deine **FRITZ!Box 7490**: Sie kann WireGuard-VPN, wenn FRITZ!OS 7.50 oder neuer installiert ist. Dann funktioniert von unterwegs alles genau wie zu Hause, auch die Links. Die Schritte stehen in `docs/anleitung-ugreen.md`, Abschnitt „Von unterwegs“.

**Frage 3 – Vorerst kein Mailversand.** Nichts zu tun: Ohne Mailserver zeigt die App Einmal-Links im Admin-Bereich zum Weitergeben an, „Passwort vergessen“ ist ausgeblendet. Mail lässt sich später im Admin-Bereich einrichten, ohne Neustart.

**Frage 4 – Beides, a) und b).** Gebaut:
- a) **Startsperre**: Ist `DEV_ADMIN=true` gesetzt und `APP_URL` nicht `localhost`, bricht die App den Start ab. Im Log steht „START ABGEBROCHEN: DEV_ADMIN=true ist nur für lokale Tests erlaubt …“. Zusätzlich wirkt die Variable außerhalb von localhost auch dann nicht, wenn der Start irgendwie doch klappen sollte.
- b) **Warnhinweis** oben in *Nutzer verwalten*, solange die Testfunktionen an sind oder noch Testnutzer existieren. Knöpfe: „Testfunktionen ausschalten“ und „Alle Testnutzer löschen“ (mit Rückfrage; geht auch bei ausgeschalteten Testfunktionen). Testnutzer, die Daten in Gruppen mit echten Nutzern haben, werden nicht gelöscht, sondern mit diesen Gruppen genannt. Nichts passiert automatisch.

**Frage 5 – Kein Tricount.** Der Import bleibt, wie er ist (als „nach Beschreibung gebaut, nicht mit echter Datei geprüft“ gekennzeichnet).

**Frage 6 – Push ja.** Push braucht HTTPS (Browser-Regel, nicht meine), du hast dich aber für http entschieden. Deshalb: Push ist eingebaut und bleibt bereit. Ohne HTTPS ist der Knopf ausgegraut mit Hinweis, Benachrichtigungen gibt es weiter in der App. Sobald du HTTPS hast (oder online hostest), erzeuge ich die Schlüssel (`npm run vapid`) und du trägst sie in die `.env` ein.

**Frage 7 – Backups selbst.** Nichts eingerichtet. Der Befehl für eine Sicherungsdatei steht in `docs/anleitung-ugreen.md`, Abschnitt 7. Wichtig bleibt: `APP_SECRET` getrennt aufbewahren.

**Außerdem in dieser Runde (auf Zuruf im Chat):**
- Gruppenliste blättert seitenweise: **50 Einträge je Seite**, auf Wunsch **100** („100 Einträge pro Seite anzeigen“), dazu „← Neuere / Ältere →“ und „Seite x von y“. Vorher konnte „Ältere anzeigen“ bei 1000 Ausgaben bis zu 780 MB Speicher belegen.
- Speicher-Experiment auf dem eigenen Zweig `claude/experiment-ram` (Ergebnis folgt gesondert).
