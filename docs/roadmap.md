# Roadmap und Prioritäten

Stand: laufend gepflegt. Reihenfolge von oben nach unten; der Auftraggeber legt Prioritäten fest.

## Fertig
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
- QR-Codes in der App scannen (Anzeige gibt es; die Handy-Kamera öffnet Links ohnehin).
- E-Mail-Versand (SMTP) für Einmal-Links und Benachrichtigungen, nachrüstbar über `linkUrl` in `services/accounts.ts` (bewusst nicht gebaut).
- Weitere Belegscan-Anbieter.
- Next.js-Hauptversions-Update (behebt die PostCSS-Warnung von `npm audit`, betrifft nur den Build).
