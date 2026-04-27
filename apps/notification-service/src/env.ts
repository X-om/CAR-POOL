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
  NOTIFICATION_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50057),
  KAFKA_BROKERS: z.string().min(1).default('127.0.0.1:9092'),
  NOTIFICATION_KAFKA_GROUP_ID: z.string().min(1).default('notification-service.v1'),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  INTERNAL_JWT_SECRET: z.string().min(16).default('dev-internal-jwt-secret-change-me'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const NOTIFICATION_SERVICE_GRPC_PORT = parsed.data.NOTIFICATION_SERVICE_GRPC_PORT;
export const KAFKA_BROKERS = parsed.data.KAFKA_BROKERS;
export const NOTIFICATION_KAFKA_GROUP_ID = parsed.data.NOTIFICATION_KAFKA_GROUP_ID;
export const REDIS_URL = parsed.data.REDIS_URL;
export const INTERNAL_JWT_SECRET = parsed.data.INTERNAL_JWT_SECRET;

