import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/** Setzt die Test-DB zurück, bevor der Server startet. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://finantsen:finantsen@localhost:5432/finantsen_test";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.unsafe("truncate users, groups, settings cascade");
  await sql.end();
}
