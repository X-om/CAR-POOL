ALTER TABLE rides
ADD COLUMN IF NOT EXISTS approval_mode TEXT NOT NULL DEFAULT 'AUTO';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'rides_approval_mode_check'
  ) THEN
    ALTER TABLE rides
    ADD CONSTRAINT rides_approval_mode_check
    CHECK (approval_mode IN ('AUTO', 'MANUAL'));
  END IF;
END $$;
