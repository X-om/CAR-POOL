import { type Request, type Response, NextFunction } from "express";
import { createRedisClient, createGatewayRateLimiters } from "@repo/redis";
import { REDIS_URL } from "../env";

const redis = createRedisClient(REDIS_URL);
const { globalRateLimiter } = createGatewayRateLimiters(redis);

export async function globalRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (typeof req.ip !== "string" || typeof req.ip !== "number")
      return res.status(400).json({ error: "Invalid IP address" });

    await globalRateLimiter.consume(req.ip);
    next();
  } catch (err) {
    res.status(429).json({ error: "Too many requests" })
  }
}