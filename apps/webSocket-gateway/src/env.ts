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
  JWT_SECRET: z.string().min(16),
  REDIS_URL: z.string().url(),
  WS_PORT: z.coerce.number().int().positive().default(3001),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const JWT_SECRET = parsed.data.JWT_SECRET;
export const REDIS_URL = parsed.data.REDIS_URL;
export const WS_PORT = parsed.data.WS_PORT;
