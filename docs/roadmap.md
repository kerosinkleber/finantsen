# Roadmap und Prioritäten

Stand: laufend gepflegt. Reihenfolge von oben nach unten; der Auftraggeber legt Prioritäten fest.

## Fertig
- **Admin-Testfunktionen**: Testnutzer (kein Passwort, nie anmeldbar), eine Bearbeitungsseite für Profil, Gruppen, Rollen und Freundschaften, „Handeln als“ mit Banner und Nachvollziehbarkeit, geschütztes Löschen, Schalter (lokal an, produktiv aus), Release-Checkliste.
- **Phase 0 und 1**: Grundgerüst, Gruppen und Freunde, Ausgaben mit allen Aufteilungsarten, Salden, Schuldenvereinfachung, Zahlungen, Soft Delete mit Verlauf.
- **Phase 2**: Kommentare, Suche und Filter, Standard-Aufteilung, Benachrichtigungen und Web Push, Auswertungen.
- **Phase 3**: Währungsumrechnung, Belegscan, Einzelposten.
- **Passkeys**: mehrere benannte Passkeys, ersetzen Passwort und TOTP bei der Anmeldung, zählen für den TOTP-Zwang.
- **Konten Etappe C**: QR-Code zu Gruppen-/Freundschaftslinks und Aktivierungslinks (Anzeige; Scanner in der App bewusst später).
- **Konten Etappe B**: TOTP (RFC 6238, ohne Fremdbibliothek), Zwang global und je Konto, Wiederherstellungscodes (Standard 1, einstellbar 0 bis 20), Admin-Reset, `APP_SECRET` Pflicht.
- **Konten Etappe A**: Einrichtung des ersten Admins, Anmeldung mit Nutzername oder E-Mail, Admin legt Konten an (Einmal-Link oder Passwort), Selbstregistrierung optional mit Freigabe, Passwortrichtlinie, Admin-Nutzerverwaltung.

## Aktuelle Priorität
- Kontenplan abgeschlossen (Etappen A bis C und Passkeys). B, C und Passkeys warten auf den Test; danach freie Priorisierung der Ideen unten.

## Danach (Reihenfolge wie vereinbart)

## Ideen ohne Termin
Mitglieder ohne Konto, Wiederherstellen gelöschter Ausgaben, wiederkehrende Ausgaben, weitere Belegscan-Anbieter, SMTP (E-Mail-Versand, nachrüstbar über `linkUrl` in `services/accounts.ts`).
