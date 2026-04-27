import type { handleUnaryCall } from "@grpc/grpc-js";
import { requireInternalAuth, user } from "@repo/grpc";
import { INTERNAL_JWT_SECRET } from "../env";
import { userService } from "../service/user.service";

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

export const userHandler: user.UserServiceServer = {
  registerUser: unary<user.RegisterUserRequest, user.RegisterUserResponse>(userService.registerUser),
  verifyOtp: unary<user.VerifyOTPRequest, user.VerifyOTPResponse>(userService.verifyOtp),
  requestEmailOtp: unary<user.RequestEmailOTPRequest, user.RequestEmailOTPResponse>(userService.requestEmailOtp),
  exchangeFirebaseIdToken: unary<user.ExchangeFirebaseIdTokenRequest, user.ExchangeFirebaseIdTokenResponse>(
    userService.exchangeFirebaseIdToken,
  ),
  getUser: unary<user.GetUserRequest, user.GetUserResponse>(userService.getUser),
  getUserProfile: unary(userService.getUserProfile),
  updateUserProfile: unary(userService.updateUserProfile),
  getUserRating: unary(userService.getUserRating),
  incrementUserRideCount: unary(userService.incrementUserRideCount),
  updateUserRating: unary(userService.updateUserRating),
};