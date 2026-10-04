# Roadmap und Prioritäten

Stand: laufend gepflegt. Reihenfolge von oben nach unten; der Auftraggeber legt Prioritäten fest.

## Fertig
- **Admin-Testfunktionen**: Testnutzer (kein Passwort, nie anmeldbar), eine Bearbeitungsseite für Profil, Gruppen, Rollen und Freundschaften, „Handeln als“ mit Banner und Nachvollziehbarkeit, geschütztes Löschen, Schalter (lokal an, produktiv aus), Release-Checkliste.
- **Phase 0 und 1**: Grundgerüst, Gruppen und Freunde, Ausgaben mit allen Aufteilungsarten, Salden, Schuldenvereinfachung, Zahlungen, Soft Delete mit Verlauf.
- **Phase 2**: Kommentare, Suche und Filter, Standard-Aufteilung, Benachrichtigungen und Web Push, Auswertungen.
- **Phase 3**: Währungsumrechnung, Belegscan, Einzelposten.
- **Konten Etappe B**: TOTP (RFC 6238, ohne Fremdbibliothek), Zwang global und je Konto, Wiederherstellungscodes (Standard 1, einstellbar 0 bis 20), Admin-Reset, `APP_SECRET` Pflicht.
- **Konten Etappe A**: Einrichtung des ersten Admins, Anmeldung mit Nutzername oder E-Mail, Admin legt Konten an (Einmal-Link oder Passwort), Selbstregistrierung optional mit Freigabe, Passwortrichtlinie, Admin-Nutzerverwaltung.

## Aktuelle Priorität
- Nächster Schritt laut Plan: **Konten Etappe C (QR für Einladungen)**, siehe unten. Etappe B (TOTP) wartet auf den Test durch den Auftraggeber.

## Danach (Reihenfolge wie vereinbart)
1. **Konten Etappe C**: QR-Code für Gruppeneinladungen (Anzeige zuerst, Scanner in der App später).
2. **Passkeys**: niedrigste Priorität, kein Zwang durch den Admin, Passwort bleibt Pflicht.

## Ideen ohne Termin
Mitglieder ohne Konto, Wiederherstellen gelöschter Ausgaben, wiederkehrende Ausgaben, weitere Belegscan-Anbieter, SMTP (E-Mail-Versand, nachrüstbar über `linkUrl` in `services/accounts.ts`).
