import { Pool } from "pg";
import { DATABASE_URL } from "./env";

export const db = new Pool({ connectionString: DATABASE_URL });

// If no listener is attached, node-postgres will crash the process on pool 'error'.
// We log so the service can decide how to handle transient DB restarts.
db.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[database] pool error", err);
});