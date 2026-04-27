import type { Producer } from "kafkajs";
import type { Pool } from "pg";
import { publishOutboxBatch } from "./outboxPublisher";

export type OutboxPublisherLoopOptions = {
  pool: Pool;
  producer: Producer;
  schema: string;
  intervalMs?: number;
  batchSize?: number;
  onPublished?: (count: number) => void;
  onError?: (err: unknown) => void;
};

export function startOutboxPublisherLoop(opts: OutboxPublisherLoopOptions): { stop: () => void } {
  const intervalMs = opts.intervalMs ?? 1000;

  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped) return;

    try {
      const count = await publishOutboxBatch(opts.pool, opts.producer, {
        schema: opts.schema,
        batchSize: opts.batchSize,
      });
      if (count > 0) opts.onPublished?.(count);
    } catch (err) {
      opts.onError?.(err);
    }
  };

  timer = setInterval(() => {
    void tick();
  }, intervalMs);

  // Fire immediately so first publish doesn't wait an interval.
  void tick();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
