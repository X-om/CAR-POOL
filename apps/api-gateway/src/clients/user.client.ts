import * as grpc from "@grpc/grpc-js";
import { user } from "@repo/grpc";
import { USER_SERVICE_GRPC_ADDR } from "../env";

export function createUserServiceClient(): user.UserServiceClient {
  return new user.UserServiceClient(USER_SERVICE_GRPC_ADDR, grpc.credentials.createInsecure());
}
