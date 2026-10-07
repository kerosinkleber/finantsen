# Roadmap und Prioritäten

Stand: laufend gepflegt. Reihenfolge von oben nach unten; der Auftraggeber legt Prioritäten fest.

## Fertig
- **Fertige Images über GitHub (amd64/arm64) und NAS-Betrieb** (`docker-compose.nas.yml`, `docs/anleitung-nas.md`): kein Bauen auf Server/NAS nötig.
- **Fragebogen 9 (Release und Betrieb)**: Betrieb ohne HTTPS mit ausgegrauten Funktionen und Hinweisen, Startsperre für `DEV_ADMIN` außerhalb von localhost, Warnhinweis bei Testfunktionen/Testnutzern mit Aufräum-Knöpfen, UGREEN-Anleitung (DXP2800, Fernzugriff über FRITZ!Box-WireGuard (UGREENlink geht laut Support nicht)).
- **Weniger Arbeitsspeicher**: Heap-Grenze 256 MB für Node, Spitzen ~40 % niedriger (397 → 226 MB bei 1000 Ausgaben, 723 → 414 MB bei 5000), ohne Geschwindigkeitsverlust.
- **Gruppenliste mit Seiten** (50 Einträge, auf Wunsch 100; „Neuere/Ältere“): ersetzt „Ältere anzeigen“, das bei 1000 Einträgen bis 780 MB Speicher brauchte.
- **Belegfotos an Ausgaben** (Fragebogen 8): bis 5 Fotos je Ausgabe, im Browser verkleinert, in der Datenbank (im Backup).
- **Gruppenbudget** (Fragebogen 8): je Monat oder insgesamt, Balken über der Ausgabenliste, einmalige Benachrichtigung bei Überschreitung.
- **Rückerstattung, Zahlungsart, mehr Statistik** (Fragebogen 8): Rückerstattungen wirken umgekehrt auf Salden und mindern die Statistik; Zahlungsart mit Filter; Durchschnitte, Zahlungsarten, größte Ausgaben.
- **Import** (Fragebogen 8): Splitwise, Tricount, eigener Finantsen-Export und einfaches CSV; Vorschau, Personen zuordnen (unbekannte → Gäste), kein Doppelimport.
- **Rechner im Betragsfeld und „Ausgabe kopieren“** (Fragebogen 8).
- **Erinnern-Knopf** (Fragebogen 8): Gläubiger erinnern Schuldner (In-App, Push, E-Mail), höchstens einmal pro Tag.
- **Gleich mit Anpassungen** (Fragebogen 8): z. B. „Anna +5 €, Rest gleich“, auch negative Anpassungen.
- **Bezahlen beim Begleichen** (Fragebogen 8): GiroCode und PayPal.me-Link mit Betrag, Bezahldaten im Konto.
- **Performance** (`docs/performance.md`): große Gruppen bis zu 35-mal schneller (Salden in SQL, lineare Zuordnung, Paging der Ausgabenliste).
- **E-Mail-Versand** (Fragebogen 7): Einmal-Links per Mail, „Passwort vergessen“, Benachrichtigungen und wöchentliche Zusammenfassung per Mail (je Person, Standard aus), Mailserver über `.env` oder Admin-Bereich, Test-Mail, Mailpit für den lokalen Test.
- **QR-Scanner in der App** (Fragebogen 7): Kamera auf der Übersicht, öffnet nur Einladungslinks dieser App.
- **Next.js 16**: Update von 15 (Turbopack-Build, neue ESLint-Konfiguration), `npm audit` ohne Befund, Docker geprüft.
- **Mitglieder ohne Konto (Gäste)**: anlegen, mitrechnen, per Link (mit QR) mit einem Konto verknüpfen; alle Daten wandern mit, Beträge werden zusammengeführt.
- **Gruppen archivieren** (je Mitglied) und **Export** (CSV je Gruppe, Konto-Export als JSON).
- **Release-Reife**: Sicherheits-Header, Backup- und Restore-Check-Skripte, Docker-Prüfung.
- **Admin-Testfunktionen**: Testnutzer (kein Passwort, nie anmeldbar), eine Bearbeitungsseite für Profil, Gruppen, Rollen und Freundschaften, „Handeln als“ mit Banner und Nachvollziehbarkeit, geschütztes Löschen, Schalter (lokal an, produktiv aus), Release-Checkliste.
- **Phase 0 und 1**: Grundgerüst, Gruppen und Freunde, Ausgaben mit allen Aufteilungsarten, Salden, Schuldenvereinfachung, Zahlungen, Soft Delete mit Verlauf.
- **Phase 2**: Kommentare, Suche und Filter, Standard-Aufteilung, Benachrichtigungen und Web Push, Auswertungen.
- **Phase 3**: Währungsumrechnung, Belegscan, Einzelposten.
- **Wiederkehrende Ausgaben**: Vorlagen mit Rhythmus (täglich bis jährlich, frei einstellbar), Enddatum, Pause, Nachbuchen verpasster Termine, Benachrichtigung „automatisch“, Verwaltung optional nur durch Gruppenbesitzer.
- **Papierkorb**: gelöschte Ausgaben lassen sich von jedem Gruppenmitglied wiederherstellen (Verlauf „Wiederhergestellt“, Benachrichtigung).
- **Passkeys**: mehrere benannte Passkeys, ersetzen Passwort und TOTP bei der Anmeldung, zählen für den TOTP-Zwang.
- **Konten Etappe C**: QR-Code zu Gruppen-/Freundschaftslinks und Aktivierungslinks (Anzeige; Scanner in der App bewusst später).
- **Konten Etappe B**: TOTP (RFC 6238, ohne Fremdbibliothek), Zwang global und je Konto, Wiederherstellungscodes (Standard 1, einstellbar 0 bis 20), Admin-Reset, `APP_SECRET` Pflicht.
- **Konten Etappe A**: Einrichtung des ersten Admins, Anmeldung mit Nutzername oder E-Mail, Admin legt Konten an (Einmal-Link oder Passwort), Selbstregistrierung optional mit Freigabe, Passwortrichtlinie, Admin-Nutzerverwaltung.

## Aktuelle Priorität
- **Alle vereinbarten Funktionen sind gebaut und laufen auf dem Test-NAS** (UGREEN DXP2800, `http://192.168.77.27:3000`). Nächster Schritt: Test durch den Auftraggeber bzw. den Test-Agenten (`docs/tester-guide.md`), Funde abarbeiten, Entwicklungszweig nach `main` übernehmen (dann Image-Tag `latest`), Release nach `docs/release-checkliste.md`.

## Ideen ohne Termin
- Weitere Belegscan-Anbieter (OpenAI, OpenAI-kompatibel/Ollama): Auftraggeber berät gesondert, **nichts bauen**.
- HTTPS im Heimnetz (DuckDNS/eigene Domain + Caddy) und danach Push-Schlüssel: erst wenn gewünscht (Fragebogen 9, Frage 1 und 6).
- 5 statt 10 Datenbankverbindungen (−17 MB in PostgreSQL), siehe `docs/performance.md`.
