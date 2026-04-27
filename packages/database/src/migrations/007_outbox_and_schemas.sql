-- 007_outbox_and_schemas.sql
-- Create schema-per-service namespaces and the minimal outbox + idempotency tables.

DO $$
BEGIN
  CREATE SCHEMA IF NOT EXISTS user_service;
  CREATE SCHEMA IF NOT EXISTS vehicle_service;
  CREATE SCHEMA IF NOT EXISTS ride_service;
  CREATE SCHEMA IF NOT EXISTS search_service;
  CREATE SCHEMA IF NOT EXISTS booking_service;
  CREATE SCHEMA IF NOT EXISTS trip_service;
  CREATE SCHEMA IF NOT EXISTS notification_service;
END $$;

-- Helper tables (repeat per schema for clean ownership boundaries)

CREATE TABLE IF NOT EXISTS user_service.outbox_events (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  kafka_topic TEXT NOT NULL,
  kafka_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  recipients JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  publish_attempts INT NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS user_service_outbox_unpublished_idx
  ON user_service.outbox_events (created_at)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS user_service.processed_events (
  event_id UUID PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_service.outbox_events (LIKE user_service.outbox_events INCLUDING ALL);
CREATE INDEX IF NOT EXISTS vehicle_service_outbox_unpublished_idx
  ON vehicle_service.outbox_events (created_at)
  WHERE published_at IS NULL;
CREATE TABLE IF NOT EXISTS vehicle_service.processed_events (LIKE user_service.processed_events INCLUDING ALL);

CREATE TABLE IF NOT EXISTS ride_service.outbox_events (LIKE user_service.outbox_events INCLUDING ALL);
CREATE INDEX IF NOT EXISTS ride_service_outbox_unpublished_idx
  ON ride_service.outbox_events (created_at)
  WHERE published_at IS NULL;
CREATE TABLE IF NOT EXISTS ride_service.processed_events (LIKE user_service.processed_events INCLUDING ALL);

CREATE TABLE IF NOT EXISTS search_service.outbox_events (LIKE user_service.outbox_events INCLUDING ALL);
CREATE INDEX IF NOT EXISTS search_service_outbox_unpublished_idx
  ON search_service.outbox_events (created_at)
  WHERE published_at IS NULL;
CREATE TABLE IF NOT EXISTS search_service.processed_events (LIKE user_service.processed_events INCLUDING ALL);

CREATE TABLE IF NOT EXISTS booking_service.outbox_events (LIKE user_service.outbox_events INCLUDING ALL);
CREATE INDEX IF NOT EXISTS booking_service_outbox_unpublished_idx
  ON booking_service.outbox_events (created_at)
  WHERE published_at IS NULL;
CREATE TABLE IF NOT EXISTS booking_service.processed_events (LIKE user_service.processed_events INCLUDING ALL);

CREATE TABLE IF NOT EXISTS trip_service.outbox_events (LIKE user_service.outbox_events INCLUDING ALL);
CREATE INDEX IF NOT EXISTS trip_service_outbox_unpublished_idx
  ON trip_service.outbox_events (created_at)
  WHERE published_at IS NULL;
CREATE TABLE IF NOT EXISTS trip_service.processed_events (LIKE user_service.processed_events INCLUDING ALL);

CREATE TABLE IF NOT EXISTS notification_service.outbox_events (LIKE user_service.outbox_events INCLUDING ALL);
CREATE INDEX IF NOT EXISTS notification_service_outbox_unpublished_idx
  ON notification_service.outbox_events (created_at)
  WHERE published_at IS NULL;
CREATE TABLE IF NOT EXISTS notification_service.processed_events (LIKE user_service.processed_events INCLUDING ALL);
