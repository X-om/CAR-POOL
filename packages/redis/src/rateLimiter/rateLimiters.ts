import Redis from 'ioredis';
import { createRateLimiter } from './createRateLimiter';

export function createGatewayRateLimiters(redis: Redis) {
  const globalRateLimiter = createRateLimiter(redis, 100, 60, 'rate_limit_global');
  const authRateLimiter = createRateLimiter(redis, 20, 60, 'rate_limit_auth');
  const otpRateLimiter = createRateLimiter(redis, 5, 60, 'rate_limit_otp');

  return { globalRateLimiter, authRateLimiter, otpRateLimiter }
}