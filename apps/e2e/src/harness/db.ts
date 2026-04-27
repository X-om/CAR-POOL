import pg from 'pg';

export async function resetDatabase({ databaseUrl }: { databaseUrl: string }): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const schemasToDrop = [
    'notification_service',
    'trip_service',
    'booking_service',
    'search_service',
    'ride_service',
    'vehicle_service',
    'user_service',
    'public',
  ];

  try {
    await client.query('BEGIN');
    for (const schema of schemasToDrop) {
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`);
    }
    await client.query('CREATE SCHEMA public;');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}
