import { db } from '@repo/database';
import { createKafkaClient, createAndConnectProducer, ensureTopics, startOutboxPublisherLoop } from '@repo/kafka';
import { BOOKING_EVENTS_TOPIC, DOMAIN_EVENTS_DLQ_TOPIC, RIDE_EVENTS_TOPIC, TRIP_EVENTS_TOPIC } from '@repo/contracts';
import {
  KAFKA_BROKERS,
  KAFKA_CLIENT_ID,
  OUTBOX_BATCH_SIZE,
  OUTBOX_INTERVAL_MS,
  OUTBOX_SCHEMAS,
} from './env';

async function main(): Promise<void> {
  const kafka = createKafkaClient({
    clientId: KAFKA_CLIENT_ID,
    brokers: KAFKA_BROKERS.split(',').map((b) => b.trim()).filter(Boolean),
  });
  await ensureTopics(kafka, [
    { topic: BOOKING_EVENTS_TOPIC },
    { topic: RIDE_EVENTS_TOPIC },
    { topic: TRIP_EVENTS_TOPIC },
    { topic: DOMAIN_EVENTS_DLQ_TOPIC },
  ]);
  const producer = await createAndConnectProducer({ kafka });

  const schemas = OUTBOX_SCHEMAS.split(',').map((s) => s.trim()).filter(Boolean);

  const loops = schemas.map((schema) =>
    startOutboxPublisherLoop({
      pool: db,
      producer,
      schema,
      intervalMs: OUTBOX_INTERVAL_MS,
      batchSize: OUTBOX_BATCH_SIZE,
      onPublished: (count) => {
        // eslint-disable-next-line no-console
        console.log(`[outbox-publisher] schema=${schema} published=${count}`);
      },
      onError: (err) => {
        // eslint-disable-next-line no-console
        console.error(`[outbox-publisher] schema=${schema} error`, err);
      },
    }),
  );

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[outbox-publisher] shutting down (${signal})`);
    for (const l of loops) l.stop();
    await producer.disconnect().catch(() => undefined);
    await db.end().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
