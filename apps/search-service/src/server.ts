import * as grpc from '@grpc/grpc-js';
import { search } from '@repo/grpc';
import { SEARCH_SERVICE_GRPC_PORT } from './env';
import { searchHandler } from './grpc/search.handler';

const server = new grpc.Server();
server.addService(search.SearchServiceService, searchHandler);

server.bindAsync(
  `0.0.0.0:${SEARCH_SERVICE_GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) return console.error('Server binding error:', err);
    // eslint-disable-next-line no-console
    console.log(`search-service gRPC listening on :${port}`);
    server.start();
  },
);
