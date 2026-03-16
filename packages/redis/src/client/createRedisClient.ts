import Redis from "ioredis";

export function createRedisClient(redisURL: string) {
  return new Redis(redisURL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });
}