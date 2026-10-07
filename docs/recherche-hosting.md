# Recherche: Wo kann Finantsen günstig laufen?

Stand: 5. Oktober 2026. Alle Preise **inkl. 19 % MwSt.**, sofern nicht anders vermerkt (umgerechnet, wenn der Anbieter netto angibt). Mit **(unsicher)** markierte Angaben stammen nur aus Vergleichsseiten oder Foren. Die offiziellen Anbieterseiten (hetzner.com, netcup.com, docs.oracle.com) waren von der Recherche-Umgebung aus nicht abrufbar. Vor einer Bestellung bitte den Preis auf der Anbieterseite prüfen.

**Wichtiger Hinweis zu 2026:** Wegen der weltweiten Knappheit bei Arbeitsspeicher („RAMpocalypse“) haben fast alle Anbieter 2026 ihre Preise erhöht, manche zweimal. Ältere Testberichte mit „ab 1 €“ oder „Hetzner ab 3,79 €“ sind veraltet.

## Was die App braucht

- 3 Container (App, PostgreSQL, Caddy), etwa 1 GB RAM im Betrieb, 1 vCPU, 10–20 GB Speicher.
- **Muss rund um die Uhr laufen.** Der eingebaute Zeitplaner läuft alle 15 Minuten. Dienste, die sich bei Nichtnutzung schlafen legen, sind ungeeignet.
- HTTPS ist Pflicht. Caddy erledigt das automatisch, wenn der Server aus dem Internet erreichbar ist und eine Domain hat.
- **Achtung beim Bauen:** Das Docker-Image wird auf dem Server gebaut (`npm run build`). Ein Next.js-Build braucht erfahrungsgemäß deutlich mehr als 1 GB RAM. Auf Servern mit nur 1 GB RAM braucht man deshalb eine Auslagerungsdatei (Swap) oder muss das Image woanders bauen. Das ist für Laien eine zusätzliche Hürde.

## 1. Kostenlose Angebote

| Anbieter | Was gibt es gratis | Problem für Finantsen |
|---|---|---|
| **Oracle Cloud Always Free** | ARM-Server (Ampere A1), seit 15.06.2026 nur noch **2 Kerne / 12 GB RAM** (vorher 4/24), 200 GB Speicher, Standort z. B. Frankfurt | Oracle löscht oder stoppt „untätige“ Gratis-Server: wenn 7 Tage lang CPU, Netzwerk **und** RAM (bei A1) unter 20 % liegen (95. Perzentil). Finantsen nutzt etwa 1 von 12 GB, ist also **genau so ein Fall**. Die Kürzung 2026 kam ohne Ankündigung, und Server über dem neuen Limit wurden ab August beendet. Für die Anmeldung braucht man eine Kreditkarte (zur Prüfung). Die Oberfläche ist für Laien schwer zu bedienen. |
| **Google Cloud e2-micro** | 1 Server (2 geteilte vCPU, 1 GB RAM), 30 GB HDD | Nur in den **US-Regionen** Oregon, Iowa und South Carolina, also schlecht für die DSGVO. 1 GB RAM ist knapp, und die App lässt sich darauf nicht bauen. Kreditkarte nötig. Ob die öffentliche IPv4-Adresse gratis ist: (unsicher). |
| **Fly.io** | Kein Gratis-Angebot mehr für neue Konten (nur Test: 2 Std./7 Tage) | Bezahlt mit Datenbank realistisch 8–12 $/Monat |
| **Render** | Gratis-Webdienst | Schläft nach 15 Min. ohne Zugriff ein, die Gratis-Datenbank **verfällt nach 30 Tagen** |
| **Railway** | Gratis-Plan mit 1 $ Guthaben/Monat | Reicht nicht für einen Tag Dauerbetrieb. Hobby-Plan 5 $ plus Verbrauch, realistisch über 10 $/Monat (unsicher) |
| **Koyeb** | 512 MB, 0,1 vCPU, Frankfurt | Schläft nach 1 Std. ein, Datenbank nur 5 Std./Monat. Kreditkarte nötig (seit Feb. 2026) |

**Fazit:** Keiner dieser Dienste betreibt Docker Compose mit Datenbank zuverlässig, dauerhaft und kostenlos. Technisch ginge es nur bei Oracle, mit dem Risiko, dass der Server mit allen Finanzdaten verschwindet. Für die Daten von Freunden **nicht empfehlenswert** (höchstens mit Umstieg auf ein bezahltes Oracle-Konto, das nicht zurückgefordert wird, dann aber mit Kreditkarte und dem Risiko unerwarteter Kosten).

## 2. Günstige VPS in der EU

Ein VPS ist ein gemieteter kleiner Server. Darauf läuft Docker Compose genau wie auf dem eigenen Rechner. Caddy holt das HTTPS-Zertifikat automatisch.

| Anbieter / Tarif | Preis/Monat inkl. MwSt. | Leistung | Standort | Laufzeit, Haken |
|---|---|---|---|---|
| **Hetzner CX23** | **ca. 7,13 €** (5,49 € + 0,50 € IPv4 netto) | 2 vCPU, 4 GB, 40 GB | DE (Nürnberg, Falkenstein), FI | Stündlich abgerechnet, jederzeit kündbar. Preis seit 15.06.2026 (+38 %). |
| Hetzner CAX11 (ARM) | ca. 7,72 € (5,99 € + 0,50 €) | 2 vCPU, 4 GB, 40 GB | DE, FI | Wie oben; ARM, aber mit Docker unproblematisch |
| **netcup VPS nano G11.5s** | ca. 3,69 € (3,10 € netto) (unsicher) | 2 vCPU, 2 GB, 60 GB | Nürnberg | 12 Monate Mindestlaufzeit. Preis seit Sept. 2026 erhöht. |
| netcup VPS pico G11.5s | ca. 2,21 € (1,85 € netto) (unsicher) | 1 vCPU, 1 GB, 30 GB | Nürnberg | 12 Monate; 1 GB ist knapp, Swap nötig |
| IONOS VPS Linux XS | 1 € + 10 € Einrichtung | 1 vCPU, 1 GB, **10 GB** | DE | Speicher zu klein für Belegfotos |
| Strato VC 1-1 | 1 € (unsicher, ob dauerhaft) | 1 vCPU, 1 GB, 30 GB | DE | Keine Backups enthalten, 1 GB knapp |
| Contabo Cloud VPS 10 | ca. 5–6 € (unsicher) | 3–4 vCPU, 8 GB, 75 GB | DE u. a. | Viel Leistung, aber gemischte Erfahrungsberichte zur Zuverlässigkeit; Einrichtungsgebühr je nach Laufzeit |
| OVHcloud VPS-1 | ca. 5,34 € (4,49 € netto) (unsicher) | 2 vCPU, 4 GB (laut Vergleichsseiten) | FR/DE | Neue Tarifreihe 2026, Angaben schwanken |
| Scaleway Stardust | ca. 0,50 € + ca. 3,60 € IPv4 netto (unsicher) | 1 vCPU, 1 GB | FR/NL | Oft ausverkauft |

**Datenschutz:** Alle genannten EU-Anbieter bieten einen Auftragsverarbeitungsvertrag (AV-Vertrag). Bei Hetzner schließt man ihn mit ein paar Klicks in der Konsole ab (Administration → Stammdaten → Auftragsverarbeitung), netcup und IONOS bieten ihn ebenfalls im Kundenbereich an. Für eine rein private App unter Freunden ist ein AV-Vertrag rechtlich nicht zwingend (Haushaltsausnahme, keine Rechtsberatung), schadet aber nicht.

**E-Mail:** Hetzner sperrt bei neuen Konten die Ports 25 und 465. **Port 587 ist offen**, damit funktioniert der Versand über einen Maildienst. Finantsen braucht also keine Freischaltung, solange 587 genutzt wird.

**Backups:** Hetzner bietet automatische Backups (7 Stände) für 20 % des Serverpreises, also ca. 1,31 €/Monat beim CX23. Snapshots kosten ca. 0,014 € netto je GB und Monat. Bei netcup sind Snapshots inklusive.

## 3. Zu Hause betreiben

**Stromkosten** bei 0,35 €/kWh und Dauerbetrieb:

| Gerät | Durchschnitt | kWh/Jahr | €/Jahr |
|---|---|---|---|
| Raspberry Pi 4 (4 GB) + SSD | ca. 4–5 W | 35–44 | **ca. 12–15 €** |
| Raspberry Pi 5 (4 GB) + NVMe | ca. 5–6 W | 44–53 | **ca. 15–18 €** |
| Alter Mini-PC (z. B. Intel NUC) | ca. 8–12 W | 70–105 | **ca. 25–37 €** |
| NAS (2 Festplatten), läuft ohnehin | ca. 15–25 W | – | Zusatzkosten fast 0 € |

Anschaffung: Ein Raspberry Pi 5 (4 GB) kostet wegen der Speicherkrise inzwischen 85 $ statt 60 $, dazu kommen Netzteil, Gehäuse und SSD (insgesamt ca. 130–160 €, unsicher). Ein vorhandener Mini-PC oder ein vorhandenes NAS mit Docker ist praktisch kostenlos.

**Was „nur per VPN erreichbar“ bedeutet:**
- **FRITZ!Box mit WireGuard** (ab FRITZ!OS 7.50): Man legt je Person eine VPN-Verbindung an, die Person scannt einen QR-Code in die WireGuard-App, und die Box öffnet den Port selbst. Haken: (a) Jede Person bekommt damit Zugang zum **ganzen Heimnetz** (Drucker, NAS, …). (b) Bei DS-Lite-Anschlüssen (viele Kabelanschlüsse) gibt es keine erreichbare IPv4-Adresse, dann klappt der Zugang nur über IPv6. (c) Jeder Freund muss vor dem Öffnen der App das VPN einschalten, was im Alltag (Rechnung im Restaurant eintragen) lästig ist.
- **Tailscale (gratis)**: bis 6 Nutzer, beliebig viele Geräte. Bei mehr als 6 Personen wird es kostenpflichtig, oder man teilt den Server einzeln mit fremden Tailscale-Konten („Node sharing“, Details unsicher). Funktioniert auch bei DS-Lite, alle Freunde brauchen aber die App und ein Konto.
- **HTTPS trotz VPN:** Passkeys, Web-Push und die Installation als App (PWA) brauchen ein **gültiges Zertifikat**. Ohne offenen Port geht das nur über die **DNS-Challenge**. Dafür braucht man eine Domain bei einem Anbieter mit API (z. B. DuckDNS, deSEC, Cloudflare) und ein **eigenes Caddy-Image mit DNS-Plugin** (das Standard-Image `caddy:2-alpine` enthält keins). Das ist machbar, aber eine zusätzliche Bastelstelle.
- Weitere Haken: Strom- oder Internetausfall heißt App weg, Backups muss man selbst organisieren (z. B. auf USB-Platte oder in die Cloud), und Hardware kann kaputtgehen (SD-Karten besonders).

## 4. Domain

- **Auf einem VPS:** Eine Domain ist praktisch nötig, weil Caddy/Let's Encrypt einen Namen braucht. Eine **.de-Domain kostet ca. 5–12 €/Jahr** (z. B. do.de ca. 4,68 €/Jahr). Vorsicht bei Lockangeboten (IONOS „0,96 € im 1. Jahr“, danach ca. 15,60 €).
- **Gratis:** Subdomains bei **DuckDNS** (`name.duckdns.org`) oder **deSEC** (`name.dedyn.io`, Berlin, gemeinnützig). Beide funktionieren mit Caddy, auf dem VPS ohne Plugin, zu Hause über die DNS-Challenge mit Plugin (`caddy-dns/duckdns` bzw. `caddy-dns/desec`). Nachteil: Man hängt von einem kostenlosen Dienst ab, und der Name sieht weniger vertrauenswürdig aus.
- **MyFRITZ!**-Adressen eignen sich nur für das VPN selbst, nicht für die App-Zertifikate.

## Vor- und Nachteile kurz

- **Hetzner:** sehr zuverlässig, deutsch, einfache Oberfläche, monatlich kündbar, genug RAM zum Bauen. Nachteil: teurer als 2025.
- **netcup:** günstig, deutsch, Snapshots inklusive. Nachteil: 12 Monate Bindung, ältere Oberfläche, Preise 2026 zweimal erhöht.
- **Oracle gratis:** kostet nichts. Nachteil: Löschgefahr, Bedingungen ändern sich ohne Ankündigung, kompliziert.
- **Zu Hause:** billig im Betrieb, Daten im eigenen Haus. Nachteil: VPN für alle Freunde, Zertifikats-Bastelei, man ist selbst für Ausfälle und Backups verantwortlich.

## Empfehlung

**Platz 1: Hetzner Cloud CX23 (Nürnberg/Falkenstein)**: ca. 7,13 €/Monat, mit Backups ca. 8,44 €/Monat. **Pro Jahr ca. 86–101 € plus Domain (ca. 5–12 €)**, also rund **95–115 €/Jahr**.
Gründe: Standort Deutschland, AV-Vertrag per Klick, 4 GB RAM (das Image lässt sich ohne Tricks auf dem Server bauen), automatische Backups, monatlich kündbar, gute Dokumentation, Port 587 für E-Mail offen.

**Platz 2: netcup VPS nano G11.5s**: ca. 3,69 €/Monat (unsicher). **Pro Jahr ca. 44 € plus Domain**, also rund **50–55 €/Jahr**.
Gründe: halber Preis, Standort Nürnberg, AV-Vertrag, Snapshots inklusive, 60 GB Speicher. 2 GB RAM reichen für den Betrieb, beim Bauen sollte man aber Swap einrichten. Haken: 12 Monate Vertragsbindung.

**Platz 3: Zu Hause auf vorhandener Hardware (NAS/Mini-PC) oder einem Raspberry Pi 5**: ca. **15–37 €/Jahr Strom** plus Domain. Bei Neukauf eines Pi kommen einmalig ca. 130–160 € dazu.
Nur sinnvoll, wenn schon ein Gerät läuft und jemand gern bastelt. VPN für jeden Freund, Zertifikat per DNS-Challenge und eigene Backups machen es deutlich aufwendiger. Mit mehr als 6 Personen passt Tailscale gratis nicht mehr.

**Nicht empfohlen:** Oracle Always Free (Löschgefahr bei wenig Last, Bedingungen 2026 ohne Vorwarnung gekürzt), Render/Railway/Koyeb/Fly.io (schlafen ein, kein Gratis-Dauerbetrieb oder Datenbank verfällt), Google e2-micro (nur USA, 1 GB).

**Am einfachsten für dieses Setup (Docker Compose + Caddy):** ein normaler VPS mit eigener öffentlicher IPv4-Adresse, also Platz 1 oder 2. Domain auf die Server-IP zeigen lassen, `docker compose up -d`, und Caddy holt das Zertifikat ohne Plugin, ohne VPN und ohne Portfreigaben am Router. Hetzner ist dabei am bequemsten, weil der RAM zum Bauen reicht und Backups ein Häkchen sind.

## Quellen (abgerufen am 2026-10-05)

- Hetzner Preisanpassung 15.06.2026: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/ (Inhalt über Suchmaschine, Seite selbst nicht abrufbar)
- Hetzner Kosten inkl. IPv4/MwSt.: https://www.cloudhim.com/cloud-costs/hetzner-cx22-pricing-2026, https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/
- Hetzner Backups/Snapshots: https://docs.hetzner.com/cloud/billing/faq/, https://hetsnap.com/blog/hetzner-cloud-backup-vs-snapshot-pricing-comparison
- Hetzner AV-Vertrag: https://www.hetzner.com/AV/DPA_de.pdf, https://av-vertrag.org/dienst-anbieter/hetzner/
- Hetzner Mail-Ports: https://queensmtp.com/smtp-settings/hetzner
- netcup Preise 2026: https://netcupvoucher.com/blog/netcup-pricing-2026, https://lowendtalk.com/discussion/221336/netcup-price-increase-september-2026, https://forum.netcup.de/thread/21902-aktuell-neue-serverpreise-rampocalypse/
- IONOS: https://www.experte.com/server/ionos, https://www.hosttest.at/vergleich/ionos-vserver.html
- Strato: https://www.strato.de/server/vps/, https://www.whtop.com/plans/strato.de/135955
- Contabo: https://www.whtop.com/plans/contabo.com/133001, https://www.experte.com/server/contabo
- OVHcloud: https://www.ovhcloud.com/en/vps/cheap-vps/, https://github.com/robhunter/agentdeals/pull/2003
- Scaleway: https://www.scaleway.com/en/pricing/virtual-instances/, https://agentxcloud.com/news/scaleway-june-2026-pricing-update
- Oracle Always Free und Rückforderung: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm, https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/, https://terminalbytes.com/oracle-cloud-free-tier-changes-2026/
- Google Cloud Free Tier: https://docs.cloud.google.com/free/docs/free-cloud-features
- Fly.io: https://fly.io/docs/about/discontinued-plans/, https://www.saaspricepulse.com/blog/flyio-free-tier-2026
- Render: https://justinmckelvey.com/blog/is-render-free
- Railway: https://kuberns.com/blogs/railway-free-tier/
- Koyeb: https://www.srvrlss.io/provider/koyeb/, https://www.koyeb.com/docs/reference/instances
- Tailscale: https://costbench.com/software/business-vpn/tailscale/free-plan/
- Raspberry Pi Strom und Preis: https://raspberry.tips/en/raspberrypi-tutorials/raspberry-pi-power-consumption-update-2026-all-models-compared, https://www.raspberrypi.com/news/1gb-raspberry-pi-5-now-available-at-45-and-memory-driven-price-rises/
- FRITZ!Box WireGuard: https://www.pcwelt.de/article/1203483/fritz-os-7-50-vpn-endlich-einfach-mit-wireguard.html, https://rootops.de/fritzbox-wireguard-vpn/
- Domains: https://www.hosttest.de/vergleich/de-domain.html, https://www.webhosterwissen.de/domains/
- Caddy + DuckDNS: https://github.com/caddy-dns/duckdns
