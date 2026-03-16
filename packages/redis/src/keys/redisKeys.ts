export const RedisRateLimiterKeys = {
  rateLimitGlobal: (ip: string) => `rate_limit:global:${ip}`,
  rateLimitAuth: (ip: string) => `rate_limit:auth:${ip}`,
  rateLimitOTP: (ip: string) => `rate_limit:otp:${ip}`
}