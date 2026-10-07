# Fragebogen 3: Passkeys

So füllst du ihn aus: Kreuze mit `[x]` an (bei Einfachauswahl nur eins) oder schreibe unter **Antwort**. Mit "(Empfehlung)" markiere ich, was ich nehmen würde. Wenn du fertig bist, kopiere den ganzen Inhalt zurück in den Chat. Fragen ohne Antwort behandle ich wie empfohlen.

---

## Schon entschieden (nur zur Kontrolle, bitte nicht ausfüllen)

- Passkeys haben **niedrigste Priorität**.
- Der Admin kann Passkeys **nicht erzwingen**.
- Das **Passwort bleibt Pflicht** für jedes Konto.
- TOTP (Etappe B) ist fertig; der Admin kann TOTP erzwingen.
- Kein SMTP, kein E-Mail-Versand.

---

## Meine Hinweise (keine Antwort nötig)

1. **Technik:** Passkeys laufen über WebAuthn. Ich würde die MIT-lizenzierte Bibliothek `@simplewebauthn/server` und `@simplewebauthn/browser` nehmen (passt zur proprietären Lizenz, selbst schreiben wäre fehleranfällig).
2. **Domain-Bindung:** Ein Passkey gehört fest zur Domain (z. B. `splits.example.com`). Beim lokalen Test (`localhost`) funktioniert er, wird aber nicht auf die echte Domain übertragen. Wer die Domain später ändert, verliert seine Passkeys (Passwort + TOTP bleiben).
3. **HTTPS nötig:** Außer auf `localhost` verlangen Browser HTTPS. Der Caddy-Stack liefert das.
4. **Testbarkeit:** Playwright kann Passkeys über einen virtuellen Authenticator testen. Der Test-Agent im Browser vermutlich nicht.

---

## Frage 1: Welche Rolle soll ein Passkey beim Anmelden haben?

- [x] **A: Ersetzt Passwort und TOTP**: Wer einen Passkey eingerichtet hat, kann sich mit Fingerabdruck/Gesicht/PIN anmelden, ohne Passwort und ohne TOTP-Code (der Passkey ist selbst schon "Besitz + Biometrie"). Das Passwort bleibt als Rückfall und für Notfälle. (Empfehlung)
- [ ] **B: Ersetzt nur das Passwort**: Passkey statt Passwort, TOTP wird danach trotzdem abgefragt, wenn eingerichtet oder verlangt.
- [ ] **C: Nur als zweiter Faktor**: Passkey ersetzt den TOTP-Schritt, das Passwort wird weiterhin eingegeben.

Antwort / Anmerkung:

## Frage 2: Zählt ein Passkey für den TOTP-Zwang?

Gilt nur, wenn der Admin TOTP verlangt (global oder je Konto).

- [x] **Ja**: Wer einen Passkey hat, erfüllt die Anforderung "zweiter Faktor" und muss kein TOTP einrichten. (Empfehlung, passt zu Frage 1 A)
- [ ] **Nein**: TOTP bleibt Pflicht, der Passkey ist nur eine Bequemlichkeit.

Antwort / Anmerkung:

## Frage 3: Wie viele Passkeys pro Konto?

- [x] **Mehrere, mit Namen** (z. B. "Handy", "Laptop"), einzeln löschbar. (Empfehlung)
- [ ] **Genau einer**

Antwort / Anmerkung:

## Frage 4: Passwortlose Anmeldung ohne Nutzername?

- [x] **Nein, erst Nutzername/E-Mail eingeben, dann Passkey oder Passwort**: einfacher und vermeidet Konto-Auswahl bei doppelten E-Mails. (Empfehlung)
- [ ] **Ja, Knopf "Mit Passkey anmelden" ohne Eingabe** (sogenannte auffindbare Passkeys, bequemer, mehr Aufwand)

Antwort / Anmerkung:

## Frage 5: Einrichtung und Verlust

Kreuze an, was gelten soll:

- [x] **Einrichten nur im angemeldeten Zustand und nur nach erneuter Passworteingabe** (Empfehlung)
- [x] **Löschen eines Passkeys** braucht ebenfalls das Passwort (Empfehlung)
- [x] **Admin kann alle Passkeys eines Kontos zurücksetzen**, zusammen mit "TOTP zurücksetzen" (Empfehlung)
- [ ] Admin sieht nur die Anzahl, nicht die Namen der Passkeys
- [x] **Fehlversuche** zählen auf denselben Konto-Zähler wie Passwort (Empfehlung)

Antwort / Anmerkung:

---

## Meine Annahmen (gelten, wenn du nichts anderes schreibst)

1. Passkeys werden nur für echte Konten (`kind = user`) unterstützt, nie für Testnutzer und nie für den passwortlosen Dev-Admin.
2. Die öffentlichen Schlüssel liegen in einer neuen Tabelle `passkeys` (Name, Erstellt, Zuletzt benutzt, Zähler gegen Klone).
3. Der Dev-Login bleibt unverändert.
4. Gesperrte oder deaktivierte Konten können sich auch mit Passkey nicht anmelden.
5. Dies wird die letzte Etappe des Kontenplans; danach gibt es wieder freie Prioritäten (Roadmap-Ideen: Mitglieder ohne Konto, wiederkehrende Ausgaben, Wiederherstellen gelöschter Ausgaben).

---

## Umsetzung (von Claude ergänzt)

Alle Antworten entsprachen der Empfehlung und sind so umgesetzt. Auslegungen:

1. **Passkey und TOTP-Zwang:** Weil der Passkey den zweiten Faktor ersetzt, darf sich jemand mit Zwang, der einen Passkey, aber kein TOTP hat, **nicht** nur mit dem Passwort anmelden (sonst würde der Zwang umgangen). Er meldet sich mit dem Passkey an. Verliert er das Gerät, setzt der Admin zurück (löscht Passkeys und TOTP), danach muss er TOTP einrichten.
2. **Fehlversuche:** Ein fehlgeschlagener Passkey-Versuch zählt auf demselben Konto-Zähler wie falsche Passwörter. Ein erfolgreicher Passkey-Login setzt ihn zurück.
3. **Datenschutz:** Die Anmelde-Optionen verraten nicht, ob ein Konto existiert oder Passkeys hat.
4. **Admin-Reset:** Der Knopf „2FA zurücksetzen“ erscheint auch bei Konten, die nur Passkeys haben. Der Admin sieht die Anzahl, nicht die Namen.
