import Redis from "ioredis";

export function createRedisClient(redisURL: string) {
  const client = new Redis(redisURL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });

  client.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[redis] client error", err);
  });

  return client;
}