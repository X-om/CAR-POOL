import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { createUserServiceClient } from "../clients/user.client";
import { internalGrpcMetadata } from "../clients/internalMetadata";
import { authMiddleware } from "../middleware/auth.middleware";

function getAuthUserId(req: any): string {
  const u = req.user;
  if (u && typeof u === "object" && "sub" in u) return String((u as any).sub);
  throw new Error("UNAUTHORIZED");
}

const RegisterSchema = z.object({
  phoneNumber: z.string().min(5),
  email: z.string().email(),
});

const VerifyOtpSchema = z.object({
  phoneNumber: z.string().min(5),
  otp: z.string().min(4),
});

const FirebaseExchangeSchema = z.object({
  idToken: z.string().min(20),
});

const RequestEmailOtpSchema = z.object({
  email: z.string().email(),
});

export const authRouter: ExpressRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = RegisterSchema.parse(req.body);
    const client = createUserServiceClient();

    client.registerUser(body, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

authRouter.post("/verify-otp", async (req, res, next) => {
  try {
    const body = VerifyOtpSchema.parse(req.body);
    const client = createUserServiceClient();

    client.verifyOtp(body, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

authRouter.post("/request-email-otp", authMiddleware, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const body = RequestEmailOtpSchema.parse(req.body);
    const client = createUserServiceClient();

    client.requestEmailOtp({ userId, email: body.email }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

authRouter.post("/firebase/exchange", async (req, res, next) => {
  try {
    const body = FirebaseExchangeSchema.parse(req.body);
    const client = createUserServiceClient();

    client.exchangeFirebaseIdToken({ idToken: body.idToken }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});
