export type DbQueryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rowCount: number }>;
};

export type OutboxInsertInput = {
  id: string;
  eventType: string;
  aggregateId: string;
  occurredAt: Date;
  kafkaTopic: string;
  kafkaKey: string;
  payload: unknown;
  recipients?: string[];
};

export async function insertOutboxEvent(db: DbQueryable, input: { schema: string; event: OutboxInsertInput }): Promise<void> {
  // Schema name is trusted internal input; do not pass untrusted data here.
  await db.query(
    `
    INSERT INTO ${input.schema}.outbox_events (
      id,
      event_type,
      aggregate_id,
      occurred_at,
      kafka_topic,
      kafka_key,
      payload,
      recipients
    ) VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7::jsonb,
      $8::jsonb
    )
    `,
    [
      input.event.id,
      input.event.eventType,
      input.event.aggregateId,
      input.event.occurredAt,
      input.event.kafkaTopic,
      input.event.kafkaKey,
      JSON.stringify(input.event.payload),
      input.event.recipients ? JSON.stringify(input.event.recipients) : null,
    ],
  );
}
