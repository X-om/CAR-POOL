import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..", "..", "..");

const envCandidates = [
  path.join(repoRoot, "env.local"),
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, ".env"),
  path.resolve(process.cwd(), "env.local"),
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL. Define it in env.local at the repo root (or .env/.env.local)."
  );
}

export const DATABASE_URL = process.env.DATABASE_URL;