import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb } from "./db";

/** Führt ausstehende Migrationen aus (wird beim Start der App aufgerufen). Wartet kurz auf die DB. */
export async function runMigrations(retries = 20) {
  const folder = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");
  for (let i = 0; ; i++) {
    try {
      await migrate(getDb(), { migrationsFolder: folder });
      console.log("[finantsen] migrations applied");
      return;
    } catch (err) {
      if (i >= retries) throw err;
      console.warn(`[finantsen] database not ready (${(err as Error).message}); retrying…`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
