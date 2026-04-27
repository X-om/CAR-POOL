import * as grpc from '@grpc/grpc-js';
import { createInternalAuthMetadata, user } from '@repo/grpc';
import { randomUUID } from 'node:crypto';
import { INTERNAL_JWT_SECRET, USER_SERVICE_GRPC_ADDR } from '../env';

export function createUserServiceClient(): user.UserServiceClient {
  return new user.UserServiceClient(USER_SERVICE_GRPC_ADDR, grpc.credentials.createInsecure());
}

export async function getUserRating(userId: string): Promise<number> {
  const client = createUserServiceClient();
  return await new Promise<number>((resolve) => {
    const md = createInternalAuthMetadata({
      internalJwtSecret: INTERNAL_JWT_SECRET,
      callerService: 'search-service',
      requestId: randomUUID(),
    });
    client.getUserRating({ userId }, md, (err, res) => {
      if (err || !res) return resolve(0);
      resolve(Number(res.averageRating ?? 0));
    });
  });
}
