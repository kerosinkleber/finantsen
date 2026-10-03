import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "./env";

const g = globalThis as unknown as { __sql?: postgres.Sql; __db?: PostgresJsDatabase<typeof schema> };

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!g.__db) {
    g.__sql = postgres(env.databaseUrl, { max: 10, onnotice: () => {} });
    g.__db = drizzle(g.__sql, { schema });
  }
  return g.__db;
}

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function closeDb() {
  await g.__sql?.end({ timeout: 2 });
  g.__sql = undefined;
  g.__db = undefined;
}
