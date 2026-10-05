export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Startsperre: Dev-Admin (Anmeldung ohne Passwort) nie in einer erreichbaren Installation
    const { devAdminStartError, env } = await import("./server/env");
    const devError = devAdminStartError(process.env.DEV_ADMIN, env.appUrl);
    if (devError) {
      console.error(`[finantsen] START ABGEBROCHEN: ${devError}`);
      process.exit(1);
    }
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SKIP_MIGRATIONS !== "1") {
    const { runMigrations } = await import("./server/migrate");
    await runMigrations();
    if (process.env.DEV_ADMIN === "true") {
      const { ensureDevAdmin } = await import("./server/services/accounts");
      await ensureDevAdmin();
    }
    // Wiederkehrende Ausgaben: beim Start nachholen und danach alle 15 Minuten prüfen (SCHEDULER=off schaltet ab)
    const { startRecurringScheduler } = await import("./server/services/recurring");
    startRecurringScheduler();
    // Wöchentliche Zusammenfassung per E-Mail (nur mit Mailversand; Montag ab 06:00 UTC)
    const { startDigestScheduler } = await import("./server/services/digest");
    startDigestScheduler();
  }
}
