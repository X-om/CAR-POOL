import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

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

const EnvSchema = z.object({
  KAFKA_BROKERS: z.string().min(1).default('127.0.0.1:9092'),
  KAFKA_CLIENT_ID: z.string().min(1).default('outbox-publisher'),
  OUTBOX_SCHEMAS: z
    .string()
    .min(1)
    .default(
      [
        'user_service',
        'vehicle_service',
        'ride_service',
        'search_service',
        'booking_service',
        'trip_service',
        'notification_service',
      ].join(','),
    ),
  OUTBOX_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(100),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const KAFKA_BROKERS = parsed.data.KAFKA_BROKERS;
export const KAFKA_CLIENT_ID = parsed.data.KAFKA_CLIENT_ID;
export const OUTBOX_SCHEMAS = parsed.data.OUTBOX_SCHEMAS;
export const OUTBOX_INTERVAL_MS = parsed.data.OUTBOX_INTERVAL_MS;
export const OUTBOX_BATCH_SIZE = parsed.data.OUTBOX_BATCH_SIZE;
