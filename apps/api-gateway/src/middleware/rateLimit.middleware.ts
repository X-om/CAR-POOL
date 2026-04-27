import type { NextFunction, Request, Response } from "express";
import { createRedisClient, createGatewayRateLimiters } from "@repo/redis";

import { REDIS_URL } from "../env";

const redis = createRedisClient(REDIS_URL);
const { globalRateLimiter } = createGatewayRateLimiters(redis);

export async function globalRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (typeof req.ip !== "string" || !req.ip) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "Invalid IP address",
        code: "INVALID_IP",
        requestId: req.requestId,
      });
    }

    await globalRateLimiter.consume(req.ip);
    return next();
  } catch {
    return res.status(429).json({
      success: false,
      data: null,
      error: "Too many requests",
      code: "RATE_LIMITED",
      requestId: req.requestId,
    });
  }
}
