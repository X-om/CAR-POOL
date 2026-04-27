import type { handleUnaryCall } from '@grpc/grpc-js';
import { requireInternalAuth, search } from '@repo/grpc';
import { INTERNAL_JWT_SECRET } from '../env';
import { searchService } from '../service/search.service';

const unary = <Req, Res>(fn: (req: Req) => Promise<Res>): handleUnaryCall<Req, Res> => {
  return async (call, callback) => {
    try {
      requireInternalAuth(call.metadata, INTERNAL_JWT_SECRET);
      const res = await fn(call.request);
      callback(null, res);
    } catch (err) {
      callback(err as Error, null as unknown as Res);
    }
  };
};

export const searchHandler: search.SearchServiceServer = {
  searchRides: unary(searchService.searchRides),
  getRideSearchData: unary(searchService.getRideSearchData),
};
