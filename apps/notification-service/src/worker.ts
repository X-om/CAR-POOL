import { createRedisClient } from '@repo/redis';
import { db } from '@repo/database';
import {
  createKafkaClient,
  createAndConnectConsumer,
  createAndConnectProducer,
  ensureTopics,
  processEventOnce,
} from '@repo/kafka';
import {
  BOOKING_EVENTS_TOPIC,
  DOMAIN_EVENTS_DLQ_TOPIC,
  RIDE_EVENTS_TOPIC,
  TRIP_EVENTS_TOPIC,
  parseEventEnvelope,
} from '@repo/contracts';
import { randomUUID } from 'node:crypto';
import { KAFKA_BROKERS, NOTIFICATION_KAFKA_GROUP_ID, REDIS_URL } from './env';

function notificationForEvent(input: { eventType: string; payload: unknown }): { type: string; title: string; message: string } {
  switch (input.eventType) {
    case 'booking.requested':
      return { type: 'BOOKING', title: 'New booking request', message: 'You have a new booking request.' };
    case 'booking.approved':
      return { type: 'BOOKING', title: 'Booking approved', message: 'Your booking has been approved.' };
    case 'booking.rejected':
      return { type: 'BOOKING', title: 'Booking rejected', message: 'Your booking has been rejected.' };
    case 'booking.cancelled':
      return { type: 'BOOKING', title: 'Booking cancelled', message: 'A booking was cancelled.' };
    case 'ride.created':
      return { type: 'RIDE', title: 'Ride created', message: 'Your ride has been created.' };
    case 'ride.updated':
      return { type: 'RIDE', title: 'Ride updated', message: 'A ride you booked was updated.' };
    case 'ride.cancelled':
      return { type: 'RIDE', title: 'Ride cancelled', message: 'A ride you booked was cancelled.' };
    case 'trip.started':
      return { type: 'TRIP', title: 'Trip started', message: 'Your trip has started.' };
    case 'trip.completed':
      return { type: 'TRIP', title: 'Trip completed', message: 'Your trip has been completed.' };
    default:
      return { type: 'SYSTEM', title: 'Update', message: 'You have a new update.' };
  }
}

async function main(): Promise<void> {
  const kafka = createKafkaClient({
    clientId: 'notification-worker',
    brokers: KAFKA_BROKERS.split(',').map((b) => b.trim()).filter(Boolean),
  });
  await ensureTopics(kafka, [
    { topic: BOOKING_EVENTS_TOPIC },
    { topic: RIDE_EVENTS_TOPIC },
    { topic: TRIP_EVENTS_TOPIC },
    { topic: DOMAIN_EVENTS_DLQ_TOPIC },
  ]);
  const consumer = await createAndConnectConsumer({ kafka, groupId: NOTIFICATION_KAFKA_GROUP_ID });
  const producer = await createAndConnectProducer({ kafka });

  await consumer.subscribe({ topic: BOOKING_EVENTS_TOPIC, fromBeginning: false });
  await consumer.subscribe({ topic: RIDE_EVENTS_TOPIC, fromBeginning: false });
  await consumer.subscribe({ topic: TRIP_EVENTS_TOPIC, fromBeginning: false });

  const redisPub = createRedisClient(REDIS_URL);

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[notification-worker] shutting down (${signal})`);
    await consumer.disconnect().catch(() => undefined);
    await producer.disconnect().catch(() => undefined);
    redisPub.disconnect();
    await db.end().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ message, topic }) => {
      if (!message.value) return;

      const raw = message.value.toString('utf8');
      let env: ReturnType<typeof parseEventEnvelope>;
      try {
        env = parseEventEnvelope(JSON.parse(raw));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[notification-worker] invalid event envelope', { topic, err });

        await producer.send({
          topic: DOMAIN_EVENTS_DLQ_TOPIC,
          messages: [
            {
              key: message.key?.toString('utf8') ?? null,
              value: JSON.stringify({
                reason: 'INVALID_EVENT_ENVELOPE',
                sourceTopic: topic,
                receivedAt: new Date().toISOString(),
                error: err instanceof Error ? err.message : String(err),
                raw,
              }),
            },
          ],
        });
        return;
      }

      const headerEventId = message.headers?.eventId ? message.headers.eventId.toString('utf8') : null;
      const eventId = headerEventId || env.eventId || randomUUID();

      const recipients = (env.recipients ?? []).map((r) => String(r));
      if (recipients.length === 0) return;

      const notif = notificationForEvent({ eventType: env.eventType, payload: env.payload });
      const metadata = {
        topic,
        eventType: env.eventType,
        aggregateId: env.aggregateId,
        occurredAt: env.occurredAt,
        payload: env.payload,
      };

      const processed = await processEventOnce({
        pool: db,
        schema: 'notification_service',
        eventId,
        handler: async ({ client }) => {
          // Insert one notification row per recipient.
          for (const userId of recipients) {
            await client.query(
              `
              INSERT INTO notifications (id, user_id, notification_type, title, message, metadata)
              VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)
              `,
              [randomUUID(), userId, notif.type, notif.title, notif.message, JSON.stringify(metadata)],
            );
          }
        },
      });

      if (!processed.processed) return;

      await Promise.allSettled(
        recipients.map(async (userId) => {
          const channel = `notifications:user:${userId}`;
          const realtimePayload = {
            ...notif,
            ...metadata,
          };
          await redisPub.publish(channel, JSON.stringify(realtimePayload));
        }),
      );
    },
  });
}

void main();
