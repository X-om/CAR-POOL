import fs from "fs"
import path from "path"
import { db } from "./client"

const migrationsDir = path.join(__dirname, "migrations")

async function ensureMigrationTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const res = await db.query(`SELECT version FROM schema_migrations`);
  return new Set(res.rows.map(r => r.version));
}

async function runMigrations() {
  await ensureMigrationTable();
  const executed = await getExecutedMigrations()

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort()
  for (const file of files) {
    if (executed.has(file)) {
      console.log(`Skipping already executed migration: ${file}`);
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, "utf8");
    console.log(`Running migration ${file}`)

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);

      await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [file]);
      await client.query("COMMIT");

      console.log(`✓ Migration ${file} applied`)

    } catch (error) {
      await client.query("ROLLBACK");

      console.error(`✗ Migration failed ${file}`);
      console.error(error);
      process.exit(1);

    } finally {
      client.release();
    }
  }
  console.log("All migrations completed")
}

runMigrations().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})