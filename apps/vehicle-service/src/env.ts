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
  INTERNAL_JWT_SECRET: z.string().min(16).default('dev-internal-jwt-secret-change-me'),
  VEHICLE_SERVICE_GRPC_PORT: z.coerce.number().int().positive().default(50052),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const VEHICLE_SERVICE_GRPC_PORT = parsed.data.VEHICLE_SERVICE_GRPC_PORT;
export const INTERNAL_JWT_SECRET = parsed.data.INTERNAL_JWT_SECRET;
