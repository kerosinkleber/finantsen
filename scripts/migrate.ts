import { runMigrations } from "../src/server/migrate";
import { closeDb } from "../src/server/db";

runMigrations()
  .then(() => closeDb())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
