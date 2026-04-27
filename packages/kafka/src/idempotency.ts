import type { Pool, PoolClient } from "pg";

export async function processEventOnce<T>(input: {
  pool: Pool;
  schema: string;
  eventId: string;
  handler: (ctx: { client: PoolClient }) => Promise<T>;
}): Promise<{ processed: boolean; result?: T }> {
  const client = await input.pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `
      INSERT INTO ${input.schema}.processed_events (event_id)
      VALUES ($1::uuid)
      ON CONFLICT (event_id) DO NOTHING
      `,
      [input.eventId],
    );

    if (inserted.rowCount !== 1) {
      await client.query("COMMIT");
      return { processed: false };
    }

    const result = await input.handler({ client });
    await client.query("COMMIT");
    return { processed: true, result };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
