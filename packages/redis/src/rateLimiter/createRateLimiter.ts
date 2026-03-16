import { RateLimiterRedis } from "rate-limiter-flexible";
import Redis from 'ioredis';

export function createRateLimiter(redis: Redis, points: number, duration: number, keyPrefix: string) {
  return new RateLimiterRedis({
    storeClient: redis,
    points,
    duration,
    keyPrefix
  });
}