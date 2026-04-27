-- 008_booking_email_delivery_log.sql
-- Track outbound email deliveries for idempotency, starting with trip reminders.

CREATE TABLE IF NOT EXISTS booking_service.email_delivery_log (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL,
  template_id TEXT NOT NULL,
  to_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (booking_id, template_id)
);
