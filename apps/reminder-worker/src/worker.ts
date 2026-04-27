import { randomUUID } from 'node:crypto';
import { db } from '@repo/database';
import { sendMail } from '@repo/mailer';
import { APP_NAME, MAIL_FROM, REMINDER_INTERVAL_MS, REMINDER_LEAD_MINUTES, REMINDER_WINDOW_MINUTES } from './env';
import { getUserEmail } from './clients/user.client';

type ReminderCandidateRow = {
  booking_id: string;
  ride_id: string;
  passenger_id: string;
  source_city: string | null;
  destination_city: string | null;
  departure_time: Date | null;
};

async function tick(): Promise<void> {
  const now = Date.now();
  const windowStart = new Date(now + REMINDER_LEAD_MINUTES * 60_000);
  const windowEnd = new Date(now + (REMINDER_LEAD_MINUTES + REMINDER_WINDOW_MINUTES) * 60_000);

  const res = await db.query<ReminderCandidateRow>(
    `
    SELECT
      b.id AS booking_id,
      b.ride_id,
      b.passenger_id,
      r.source_city,
      r.destination_city,
      r.departure_time
    FROM bookings b
    JOIN rides r ON r.id = b.ride_id
    LEFT JOIN booking_service.email_delivery_log l
      ON l.booking_id = b.id
     AND l.template_id = 'trip-reminder'
    WHERE b.booking_status = 'CONFIRMED'
      AND r.departure_time IS NOT NULL
      AND r.departure_time >= $1
      AND r.departure_time < $2
      AND l.id IS NULL
    ORDER BY r.departure_time ASC
    LIMIT 200
    `,
    [windowStart, windowEnd],
  );

  for (const row of res.rows) {
    const passengerEmail = await getUserEmail(row.passenger_id);
    if (!passengerEmail) continue;

    // Idempotency guard: insert log row first. If it conflicts, skip.
    const insert = await db.query(
      `
      INSERT INTO booking_service.email_delivery_log (id, booking_id, template_id, to_email)
      VALUES ($1::uuid, $2::uuid, $3, $4)
      ON CONFLICT (booking_id, template_id) DO NOTHING
      `,
      [randomUUID(), row.booking_id, 'trip-reminder', passengerEmail],
    );
    if (insert.rowCount !== 1) continue;

    try {
      await sendMail({
        from: MAIL_FROM,
        to: passengerEmail,
        templateId: 'trip-reminder',
        templateVariables: {
          appName: APP_NAME,
          toEmail: passengerEmail,
          rideId: row.ride_id,
          sourceCity: row.source_city ?? undefined,
          destinationCity: row.destination_city ?? undefined,
          departureTime: row.departure_time ? row.departure_time.toISOString() : undefined,
        },
      });

      // eslint-disable-next-line no-console
      console.log(`[reminder-worker] sent trip-reminder bookingId=${row.booking_id} to=${passengerEmail}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[reminder-worker] failed to enqueue trip-reminder', err);
    }
  }
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[reminder-worker] started intervalMs=${REMINDER_INTERVAL_MS}`);

  const interval = setInterval(() => {
    void tick().catch((err) => console.error('[reminder-worker] tick error', err));
  }, REMINDER_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[reminder-worker] shutting down (${signal})`);
    clearInterval(interval);
    await db.end().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await tick();
}

void main();
