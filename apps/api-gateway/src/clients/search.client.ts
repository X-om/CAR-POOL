import * as grpc from '@grpc/grpc-js';
import { search } from '@repo/grpc';
import { SEARCH_SERVICE_GRPC_ADDR } from '../env';

export function createSearchServiceClient(): search.SearchServiceClient {
  return new search.SearchServiceClient(SEARCH_SERVICE_GRPC_ADDR, grpc.credentials.createInsecure());
}
