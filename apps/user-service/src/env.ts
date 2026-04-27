import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { applyEnvFileFallbacks } from "@repo/config";

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

applyEnvFileFallbacks(["JWT_SECRET", "INTERNAL_JWT_SECRET"]);

const EnvSchema = z.object({
  APP_NAME: z.string().min(1).default("RideLink"),
  MAIL_FROM: z.string().min(1).default("no-reply@ridelink.local"),
  JWT_SECRET: z.string().min(16),
  INTERNAL_JWT_SECRET: z.string().min(16).default("dev-internal-jwt-secret-change-me"),
  USER_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50051),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(10),

  // Firebase Phone Auth support (frontend obtains Firebase ID token; backend verifies and mints app JWT)
  FIREBASE_AUTH_ENABLED: z.coerce.boolean().default(false),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const JWT_SECRET = parsed.data.JWT_SECRET;
export const INTERNAL_JWT_SECRET = parsed.data.INTERNAL_JWT_SECRET;
export const USER_SERVICE_GRPC_PORT = parsed.data.USER_SERVICE_GRPC_PORT;
export const OTP_EXPIRY_MINUTES = parsed.data.OTP_EXPIRY_MINUTES;
export const APP_NAME = parsed.data.APP_NAME;
export const MAIL_FROM = parsed.data.MAIL_FROM;

export const FIREBASE_AUTH_ENABLED = parsed.data.FIREBASE_AUTH_ENABLED;
export const FIREBASE_SERVICE_ACCOUNT_JSON = parsed.data.FIREBASE_SERVICE_ACCOUNT_JSON;
