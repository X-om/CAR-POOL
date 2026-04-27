-- 008_user_auth_constraints.sql
-- Ensure user_auth is 1:1 with users so OTP upserts work correctly.

DO $$
BEGIN
  -- If duplicates exist, this would fail; in dev we assume clean DB.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_auth_user_id_unique'
  ) THEN
    ALTER TABLE user_auth
      ADD CONSTRAINT user_auth_user_id_unique UNIQUE (user_id);
  END IF;
END $$;
