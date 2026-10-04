export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SKIP_MIGRATIONS !== "1") {
    const { runMigrations } = await import("./server/migrate");
    await runMigrations();
    if (process.env.DEV_ADMIN === "true") {
      const { ensureDevAdmin } = await import("./server/services/accounts");
      await ensureDevAdmin();
    }
  }
}
