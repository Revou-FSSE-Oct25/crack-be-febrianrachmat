import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const port = Number(process.env.EMBEDDED_PG_PORT ?? 5433);
const databaseDir = path.join(root, ".embedded-pg");

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
});

// Skip initdb when the cluster already exists (re-running `npm run db:embedded`).
const clusterReady = fs.existsSync(path.join(databaseDir, "PG_VERSION"));
if (!clusterReady) {
  await pg.initialise();
}
await pg.start();

try {
  await pg.createDatabase("physio_booking");
} catch {
  // database may already exist
}

console.log(`Embedded Postgres ready on port ${port}`);
console.log(
  `DATABASE_URL=postgresql://postgres:postgres@localhost:${port}/physio_booking?schema=public`,
);

process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});
