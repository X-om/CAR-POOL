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
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  INTERNAL_JWT_SECRET: z.string().min(16).default("dev-internal-jwt-secret-change-me"),
  BACKEND_PORT: z.coerce.number().int().positive().default(3000),
  USER_SERVICE_GRPC_ADDR: z.string().min(1).default("127.0.0.1:50051"),
  VEHICLE_SERVICE_GRPC_ADDR: z.string().min(1).default("127.0.0.1:50052"),
  RIDE_SERVICE_GRPC_ADDR: z.string().min(1).default("127.0.0.1:50053"),
  SEARCH_SERVICE_GRPC_ADDR: z.string().min(1).default("127.0.0.1:50054"),
  BOOKING_SERVICE_GRPC_ADDR: z.string().min(1).default("127.0.0.1:50055"),
  TRIP_SERVICE_GRPC_ADDR: z.string().min(1).default("127.0.0.1:50056"),
  NOTIFICATION_SERVICE_GRPC_ADDR: z.string().min(1).default("127.0.0.1:50057"),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const REDIS_URL = parsed.data.REDIS_URL;
export const JWT_SECRET = parsed.data.JWT_SECRET;
export const INTERNAL_JWT_SECRET = parsed.data.INTERNAL_JWT_SECRET;
export const BACKEND_PORT = parsed.data.BACKEND_PORT;
export const USER_SERVICE_GRPC_ADDR = parsed.data.USER_SERVICE_GRPC_ADDR;
export const VEHICLE_SERVICE_GRPC_ADDR = parsed.data.VEHICLE_SERVICE_GRPC_ADDR;
export const RIDE_SERVICE_GRPC_ADDR = parsed.data.RIDE_SERVICE_GRPC_ADDR;
export const SEARCH_SERVICE_GRPC_ADDR = parsed.data.SEARCH_SERVICE_GRPC_ADDR;
export const BOOKING_SERVICE_GRPC_ADDR = parsed.data.BOOKING_SERVICE_GRPC_ADDR;
export const TRIP_SERVICE_GRPC_ADDR = parsed.data.TRIP_SERVICE_GRPC_ADDR;
export const NOTIFICATION_SERVICE_GRPC_ADDR = parsed.data.NOTIFICATION_SERVICE_GRPC_ADDR;