import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa, type ExecaChildProcess } from 'execa';
import { PORTS } from './ports';
import { waitForTcpPort } from './waitFor';
import { resetDatabase } from './db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');

const composeFile = path.join(repoRoot, 'infra', 'docker', 'docker-compose.yml');

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://carpool:carpool@127.0.0.1:5432/carpool';
const REDIS_URL = process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6379';
const KAFKA_BROKERS = process.env.E2E_KAFKA_BROKERS ?? '127.0.0.1:19092';

const JWT_SECRET = process.env.E2E_JWT_SECRET ?? 'dev-jwt-secret-32chars-minimum!!';
const INTERNAL_JWT_SECRET = process.env.E2E_INTERNAL_JWT_SECRET ?? 'dev-internal-jwt-secret-32chars!!';

const started: ExecaChildProcess[] = [];
let stackStarted = false;

function spawnPnpm(args: string[], env: Record<string, string>): ExecaChildProcess {
  const child = execa('pnpm', args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    reject: false,
  });
  // Avoid unhandled rejections if the process exits non-zero (e.g., SIGTERM during teardown).
  void child.catch(() => undefined);
  started.push(child);
  return child;
}

async function runPnpm(args: string[], env: Record<string, string>): Promise<void> {
  await execa('pnpm', args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
}

async function startDocker(): Promise<void> {
  await execa('docker', ['compose', '-f', composeFile, 'up', '-d'], { cwd: repoRoot, stdio: 'inherit' });
  await waitForTcpPort('127.0.0.1', PORTS.postgres, 60_000);
  await waitForTcpPort('127.0.0.1', PORTS.redis, 30_000);
  await waitForTcpPort('127.0.0.1', PORTS.kafka, 60_000);
}

export async function startStack(): Promise<void> {
  if (stackStarted) return;
  stackStarted = true;

  process.env.E2E_BASE_URL = `http://127.0.0.1:${PORTS.apiGateway}`;
  process.env.E2E_WS_URL = `ws://127.0.0.1:${PORTS.websocketGateway}`;
  process.env.E2E_DATABASE_URL = DATABASE_URL;
  process.env.E2E_REDIS_URL = REDIS_URL;
  process.env.E2E_KAFKA_BROKERS = KAFKA_BROKERS;

  await startDocker();

  await resetDatabase({ databaseUrl: DATABASE_URL });

  await runPnpm(['--filter', '@repo/database', 'migrate'], {
    DATABASE_URL,
  });

  // gRPC servers
  spawnPnpm(['--filter', 'user-service', 'exec', 'tsx', 'src/server.ts'], {
    DATABASE_URL,
    JWT_SECRET,
    INTERNAL_JWT_SECRET,
    USER_SERVICE_GRPC_PORT: String(PORTS.userGrpc),
  });
  await waitForTcpPort('127.0.0.1', PORTS.userGrpc, 30_000);

  spawnPnpm(['--filter', 'vehicle-service', 'exec', 'tsx', 'src/server.ts'], {
    DATABASE_URL,
    INTERNAL_JWT_SECRET,
    VEHICLE_SERVICE_GRPC_PORT: String(PORTS.vehicleGrpc),
  });
  await waitForTcpPort('127.0.0.1', PORTS.vehicleGrpc, 30_000);

  spawnPnpm(['--filter', 'ride-service', 'exec', 'tsx', 'src/server.ts'], {
    DATABASE_URL,
    INTERNAL_JWT_SECRET,
    RIDE_SERVICE_GRPC_PORT: String(PORTS.rideGrpc),
    USER_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.userGrpc}`,
  });
  await waitForTcpPort('127.0.0.1', PORTS.rideGrpc, 30_000);

  spawnPnpm(['--filter', 'search-service', 'exec', 'tsx', 'src/server.ts'], {
    DATABASE_URL,
    INTERNAL_JWT_SECRET,
    SEARCH_SERVICE_GRPC_PORT: String(PORTS.searchGrpc),
    USER_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.userGrpc}`,
  });
  await waitForTcpPort('127.0.0.1', PORTS.searchGrpc, 30_000);

  spawnPnpm(['--filter', 'booking-service', 'exec', 'tsx', 'src/server.ts'], {
    DATABASE_URL,
    INTERNAL_JWT_SECRET,
    BOOKING_SERVICE_GRPC_PORT: String(PORTS.bookingGrpc),
    USER_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.userGrpc}`,
    RIDE_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.rideGrpc}`,
  });
  await waitForTcpPort('127.0.0.1', PORTS.bookingGrpc, 30_000);

  spawnPnpm(['--filter', 'trip-service', 'exec', 'tsx', 'src/server.ts'], {
    DATABASE_URL,
    INTERNAL_JWT_SECRET,
    TRIP_SERVICE_GRPC_PORT: String(PORTS.tripGrpc),
    USER_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.userGrpc}`,
  });
  await waitForTcpPort('127.0.0.1', PORTS.tripGrpc, 30_000);

  spawnPnpm(['--filter', 'notification-service', 'exec', 'tsx', 'src/server.ts'], {
    DATABASE_URL,
    INTERNAL_JWT_SECRET,
    NOTIFICATION_SERVICE_GRPC_PORT: String(PORTS.notificationGrpc),
    KAFKA_BROKERS,
    REDIS_URL,
  });
  await waitForTcpPort('127.0.0.1', PORTS.notificationGrpc, 30_000);

  // workers
  spawnPnpm(['--filter', 'outbox-publisher', 'exec', 'tsx', 'src/worker.ts'], {
    DATABASE_URL,
    KAFKA_BROKERS,
  });

  spawnPnpm(['--filter', 'notification-service', 'exec', 'tsx', 'src/worker.ts'], {
    DATABASE_URL,
    INTERNAL_JWT_SECRET,
    KAFKA_BROKERS,
    REDIS_URL,
    NOTIFICATION_KAFKA_GROUP_ID: 'notification-service.e2e',
  });

  // websocket + http gateways
  spawnPnpm(['--filter', 'webSocket-gateway', 'exec', 'tsx', 'src/server.ts'], {
    JWT_SECRET,
    REDIS_URL,
    WS_PORT: String(PORTS.websocketGateway),
  });
  await waitForTcpPort('127.0.0.1', PORTS.websocketGateway, 30_000);

  spawnPnpm(['--filter', 'api-gateway', 'exec', 'tsx', 'src/server.ts'], {
    REDIS_URL,
    JWT_SECRET,
    INTERNAL_JWT_SECRET,
    BACKEND_PORT: String(PORTS.apiGateway),
    USER_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.userGrpc}`,
    VEHICLE_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.vehicleGrpc}`,
    RIDE_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.rideGrpc}`,
    SEARCH_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.searchGrpc}`,
    BOOKING_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.bookingGrpc}`,
    TRIP_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.tripGrpc}`,
    NOTIFICATION_SERVICE_GRPC_ADDR: `127.0.0.1:${PORTS.notificationGrpc}`,
  });
  await waitForTcpPort('127.0.0.1', PORTS.apiGateway, 30_000);

  // Give workers a brief moment to finish startup/admin calls.
  await new Promise((r) => setTimeout(r, 1500));
}

export async function stopStack(): Promise<void> {
  // Stop Node processes
  const procs: ExecaChildProcess[] = [...started];
  started.length = 0;

  await Promise.allSettled(
    procs.map(async (p: ExecaChildProcess) => {
      const waitForExit = async (timeoutMs: number) =>
        await Promise.race([
          p.catch(() => undefined),
          new Promise((r) => setTimeout(r, timeoutMs)),
        ]);

      try {
        p.kill('SIGTERM');
      } catch {
        // ignore
      }

      await waitForExit(4000);

      // Force kill if still running.
      if (p.exitCode === null && !p.killed) {
        try {
          p.kill('SIGKILL');
        } catch {
          // ignore
        }
        await waitForExit(2000);
      }
    }),
  );

  // Best-effort stop docker compose
  await execa('docker', ['compose', '-f', composeFile, 'down'], { cwd: repoRoot, stdio: 'inherit' }).catch(() => undefined);
}
