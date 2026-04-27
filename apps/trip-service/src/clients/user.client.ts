import * as grpc from '@grpc/grpc-js';
import { createInternalAuthMetadata, user } from '@repo/grpc';
import { randomUUID } from 'node:crypto';
import { INTERNAL_JWT_SECRET, USER_SERVICE_GRPC_ADDR } from '../env';

export function createUserServiceClient(): user.UserServiceClient {
  return new user.UserServiceClient(USER_SERVICE_GRPC_ADDR, grpc.credentials.createInsecure());
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const client = createUserServiceClient();
  return await new Promise<string | null>((resolve) => {
    const md = createInternalAuthMetadata({
      internalJwtSecret: INTERNAL_JWT_SECRET,
      callerService: 'trip-service',
      requestId: randomUUID(),
    });
    client.getUser({ userId }, md, (err, res) => {
      if (err || !res) return resolve(null);
      const email = String(res.email ?? '').trim();
      resolve(email.length ? email : null);
    });
  });
}
