import type { NextFunction, Request, Response } from "express";

import { createUserServiceClient } from "../clients/user.client";
import { internalGrpcMetadata } from "../clients/internalMetadata";

function getAuthUserId(req: any): string {
  const u = req.user;
  if (u && typeof u === "object" && "sub" in u) return String((u as any).sub);
  throw new Error("UNAUTHORIZED");
}

export function requireVerifiedUser(req: Request, res: Response, next: NextFunction) {
  let userId: string;
  try {
    userId = getAuthUserId(req as any);
  } catch {
    return res.status(401).json({
      success: false,
      data: null,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      requestId: req.requestId,
    });
  }

  const client = createUserServiceClient();
  client.getUser({ userId }, internalGrpcMetadata(req), (err, response) => {
    if (err) return next(err);

    if (response?.isVerified) return next();

    const missing: string[] = [];
    if (!response?.isPhoneVerified) missing.push("phone");
    if (!response?.isEmailVerified) missing.push("email");

    return res.status(403).json({
      success: false,
      data: null,
      error: "Verification required",
      code: "VERIFICATION_REQUIRED",
      missing,
      requestId: req.requestId,
    });
  });
}
