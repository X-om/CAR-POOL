import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { applyEnvFileFallbacks } from '@repo/config';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

const envCandidates = [
  path.join(repoRoot, 'env.local'),
  path.join(repoRoot, '.env.local'),
  path.join(repoRoot, '.env'),
  path.resolve(process.cwd(), 'env.local'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
  }
}

applyEnvFileFallbacks(['INTERNAL_JWT_SECRET']);

const EnvSchema = z.object({
  APP_NAME: z.string().min(1).default('RideLink'),
  MAIL_FROM: z.string().min(1).default('no-reply@ridelink.local'),
  USER_SERVICE_GRPC_ADDR: z.string().min(1).default('127.0.0.1:50051'),
  INTERNAL_JWT_SECRET: z.string().min(16).default('dev-internal-jwt-secret-change-me'),
  REMINDER_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  REMINDER_LEAD_MINUTES: z.coerce.number().int().positive().default(60),
  REMINDER_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const APP_NAME = parsed.data.APP_NAME;
export const MAIL_FROM = parsed.data.MAIL_FROM;
export const USER_SERVICE_GRPC_ADDR = parsed.data.USER_SERVICE_GRPC_ADDR;
export const INTERNAL_JWT_SECRET = parsed.data.INTERNAL_JWT_SECRET;
export const REMINDER_INTERVAL_MS = parsed.data.REMINDER_INTERVAL_MS;
export const REMINDER_LEAD_MINUTES = parsed.data.REMINDER_LEAD_MINUTES;
export const REMINDER_WINDOW_MINUTES = parsed.data.REMINDER_WINDOW_MINUTES;
