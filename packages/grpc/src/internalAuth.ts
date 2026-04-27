import { Metadata, status } from '@grpc/grpc-js';
import { signInternalServiceToken, verifyInternalServiceToken } from '@repo/auth';

export type InternalAuthContext = {
  callerService: string;
  requestId?: string;
};

function firstStringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'string') return first;
    if (Buffer.isBuffer(first)) return first.toString('utf8');
  }
  return undefined;
}

export function getMetadataValue(metadata: Metadata, key: string): string | undefined {
  // grpc-js stores keys lowercase
  const values = metadata.get(key.toLowerCase());
  return firstStringValue(values);
}

export function requireInternalAuth(metadata: Metadata, internalJwtSecret: string): InternalAuthContext {
  const token = getMetadataValue(metadata, 'x-internal-token');
  if (!token) {
    const err = new Error('Missing internal auth token');
    // @ts-expect-error grpc status code
    err.code = status.UNAUTHENTICATED;
    throw err;
  }

  const verified = verifyInternalServiceToken(token, internalJwtSecret);
  const requestId = getMetadataValue(metadata, 'x-request-id');

  return {
    callerService: verified.claims.svc,
    requestId,
  };
}

export function createInternalAuthMetadata(params: {
  internalJwtSecret: string;
  callerService: string;
  requestId?: string;
}): Metadata {
  const md = new Metadata();
  const token = signInternalServiceToken({ svc: params.callerService }, params.internalJwtSecret);
  md.set('x-internal-token', token);
  if (params.requestId) md.set('x-request-id', params.requestId);
  return md;
}
