-- 011_user_verification_split.sql
-- Split verification into phone + email. A user is fully verified only when both are true.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing rows: historically, is_verified implied "fully verified".
UPDATE users
SET
  is_phone_verified = is_verified,
  is_email_verified = is_verified
WHERE is_verified = TRUE;
