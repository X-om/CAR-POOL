import type { Producer } from "kafkajs";
import type { Pool } from "pg";
import type { OutboxPublisherOptions, OutboxRow } from "./types";

export async function publishOutboxBatch(pool: Pool, producer: Producer, opts: OutboxPublisherOptions): Promise<number> {
  const batchSize = opts.batchSize ?? 100;

  const client = await pool.connect();
  let selectedIds: string[] = [];
  try {
    await client.query("BEGIN");

    const rows = await client.query<{
      id: string;
      kafka_topic: string;
      kafka_key: string;
      payload: unknown;
    }>(
      `
      SELECT
        id,
        kafka_topic,
        kafka_key,
        payload
      FROM ${opts.schema}.outbox_events
      WHERE published_at IS NULL
      ORDER BY created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
      `,
      [batchSize],
    );

    const outboxRows: OutboxRow[] = rows.rows.map((r: {
      id: string;
      kafka_topic: string;
      kafka_key: string;
      payload: unknown;
    }) => ({
      id: r.id,
      kafkaTopic: r.kafka_topic,
      kafkaKey: r.kafka_key,
      payload: r.payload,
    }));

    selectedIds = outboxRows.map((r) => r.id);

    if (outboxRows.length === 0) {
      await client.query("COMMIT");
      return 0;
    }

    const rowsByTopic = new Map<string, OutboxRow[]>();
    for (const row of outboxRows) {
      const existing = rowsByTopic.get(row.kafkaTopic);
      if (existing) existing.push(row);
      else rowsByTopic.set(row.kafkaTopic, [row]);
    }

    for (const [topic, topicRows] of rowsByTopic.entries()) {
      await producer.send({
        topic,
        messages: topicRows.map((r) => ({
          key: r.kafkaKey,
          value: JSON.stringify(r.payload),
          headers: (() => {
            const headers: Record<string, string> = { eventId: r.id };
            // best-effort correlation propagation (if payload includes correlationId)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cid = (r.payload as any)?.correlationId;
            if (typeof cid === 'string' && cid.length > 0) headers.correlationId = cid;
            return headers;
          })(),
        })),
      });
    }

    const ids = outboxRows.map((r) => r.id);
    await client.query(
      `
      UPDATE ${opts.schema}.outbox_events
      SET published_at = NOW(), publish_attempts = publish_attempts + 1, last_error = NULL
      WHERE id = ANY($1::uuid[])
      `,
      [ids],
    );

    await client.query("COMMIT");
    return outboxRows.length;
  } catch (err) {
    await client.query("ROLLBACK");

    if (selectedIds.length > 0) {
      try {
        const msg = err instanceof Error ? err.message : String(err);
        await pool.query(
          `
          UPDATE ${opts.schema}.outbox_events
          SET publish_attempts = publish_attempts + 1,
              last_error = $2
          WHERE id = ANY($1::uuid[])
            AND published_at IS NULL
          `,
          [selectedIds, msg.slice(0, 2000)],
        );
      } catch {
        // ignore secondary failures
      }
    }

    throw err;
  } finally {
    client.release();
  }
}
