export async function register() {
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
  }
}
