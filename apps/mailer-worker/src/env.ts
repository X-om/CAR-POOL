import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const dirnameBase = path.basename(__dirname);
const repoRoot =
  // When running via tsx: apps/mailer-worker/src
  dirnameBase === "src"
    ? path.resolve(__dirname, "..", "..", "..")
    // When running compiled output: apps/mailer-worker/dist
    : dirnameBase === "dist"
      ? path.resolve(__dirname, "..", "..", "..")
      : path.resolve(process.cwd());

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

const BoolSchema = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true") return true;
    if (t === "false") return false;
  }
  return v;
}, z.boolean());

const EnvSchema = z.object({
  KAFKA_BROKERS: z.string().min(1).default("127.0.0.1:9092"),
  MAILER_KAFKA_GROUP_ID: z.string().min(1).default("mailer-worker"),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: BoolSchema.default(false),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const KAFKA_BROKERS = parsed.data.KAFKA_BROKERS;
export const MAILER_KAFKA_GROUP_ID = parsed.data.MAILER_KAFKA_GROUP_ID;

export const SMTP_HOST = parsed.data.SMTP_HOST;
export const SMTP_PORT = parsed.data.SMTP_PORT;
export const SMTP_SECURE = parsed.data.SMTP_SECURE;
export const SMTP_USER = parsed.data.SMTP_USER;
export const SMTP_PASS = parsed.data.SMTP_PASS;
