// Erzeugt ein VAPID-Schlüsselpaar für Web Push und gibt die .env-Zeilen aus.
import webpush from "web-push";

const k = webpush.generateVAPIDKeys();
console.log("# In .env eintragen und die App neu starten:");
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${k.privateKey}`);
console.log("VAPID_SUBJECT=mailto:du@example.com");
