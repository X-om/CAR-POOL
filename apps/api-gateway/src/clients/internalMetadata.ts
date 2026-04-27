import type { Request } from 'express';
import { createInternalAuthMetadata } from '@repo/grpc';
import { randomUUID } from 'node:crypto';
import { INTERNAL_JWT_SECRET } from '../env';

export function internalGrpcMetadata(req: Request) {
  const requestId = req.header('x-request-id') ?? randomUUID();
  return createInternalAuthMetadata({
    internalJwtSecret: INTERNAL_JWT_SECRET,
    callerService: 'api-gateway',
    requestId,
  });
}
