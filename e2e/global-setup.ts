import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { rm } from "node:fs/promises";
import path from "node:path";

/** Setzt die Test-DB zurück, bevor der Server startet. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://finantsen:finantsen@localhost:5432/finantsen_test";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.unsafe("truncate users, groups, settings, exchange_rates, user_tokens cascade");
  await sql.end();
  await rm(path.resolve(import.meta.dirname, "..", ".e2e-mails"), { recursive: true, force: true });
}
