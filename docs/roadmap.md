# Roadmap und Prioritäten

Stand: laufend gepflegt. Reihenfolge von oben nach unten; der Auftraggeber legt Prioritäten fest.

## Fertig
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
- **Alle vereinbarten Funktionen sind gebaut.** Nächster Schritt: Test durch den Auftraggeber bzw. den Test-Agenten (`docs/tester-guide.md`), Funde abarbeiten, dann Release nach `docs/release-checkliste.md`.

## Ideen ohne Termin
- **Fragebogen 8** (`docs/fragen/08-weitere-funktionen.md`): Kandidaten aus der Recherche (Bezahlen per GiroCode/PayPal.me beim Begleichen, „gleich mit Anpassungen“, Import aus Splitwise/Tricount, Erinnern-Knopf, Rechner im Betragsfeld, Belegfoto speichern u. a.). Gebaut wird erst nach den Antworten.
- Weitere Belegscan-Anbieter (OpenAI, OpenAI-kompatibel/Ollama): **vor dem Bau gemeinsam planen** (Wunsch des Auftraggebers, Fragebogen 7).
