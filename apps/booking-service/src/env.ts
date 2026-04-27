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
  INTERNAL_JWT_SECRET: z.string().min(16).default('dev-internal-jwt-secret-change-me'),
  BOOKING_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50055),
  RIDE_SERVICE_GRPC_ADDR: z.string().min(1).default('127.0.0.1:50053'),
  USER_SERVICE_GRPC_ADDR: z.string().min(1).default('127.0.0.1:50051'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const BOOKING_SERVICE_GRPC_PORT = parsed.data.BOOKING_SERVICE_GRPC_PORT;
export const RIDE_SERVICE_GRPC_ADDR = parsed.data.RIDE_SERVICE_GRPC_ADDR;
export const USER_SERVICE_GRPC_ADDR = parsed.data.USER_SERVICE_GRPC_ADDR;
export const APP_NAME = parsed.data.APP_NAME;
export const MAIL_FROM = parsed.data.MAIL_FROM;
export const INTERNAL_JWT_SECRET = parsed.data.INTERNAL_JWT_SECRET;
