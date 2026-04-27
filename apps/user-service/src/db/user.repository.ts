import crypto from "node:crypto";
import { db } from "@repo/database";
import { v4 as uuidv4 } from "uuid";
import { OTP_EXPIRY_MINUTES } from "../env";

type DbUserRow = {
  id: string;
  phone_number: string;
  email: string | null;
  is_driver: boolean;
  is_verified: boolean;
  is_phone_verified: boolean;
  is_email_verified: boolean;
};

type DbUserProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  city: string | null;
};

type DbUserRatingSummaryRow = {
  user_id: string;
  average_rating: number;
  total_reviews: number;
  total_rides: number;
};

function generateOtp(): string {
  // 6-digit OTP (000000-999999)
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export const userRepository = {
  async createOrRefreshOtp(input: { phoneNumber: string; email: string }): Promise<{ userId: string; otp: string }> {
    const client = await db.connect();
    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    try {
      await client.query("BEGIN");

      // OTP is delivered via email. Ensure the provided phone + email pair always refers to
      // a single account to prevent account takeovers via mismatched identifiers.
      const byEmail = await client.query<DbUserRow>(
        `
        SELECT id, phone_number, email, is_driver, is_verified, is_phone_verified, is_email_verified
        FROM users
        WHERE email = $1
        LIMIT 1
        `,
        [input.email],
      );

      const byPhone = await client.query<DbUserRow>(
        `
        SELECT id, phone_number, email, is_driver, is_verified, is_phone_verified, is_email_verified
        FROM users
        WHERE phone_number = $1
        LIMIT 1
        `,
        [input.phoneNumber],
      );

      const emailRow = byEmail.rows[0];
      const phoneRow = byPhone.rows[0];

      if (emailRow && phoneRow && emailRow.id !== phoneRow.id) {
        throw new Error("EMAIL_OR_PHONE_ALREADY_IN_USE");
      }

      let userId: string;
      if (emailRow) {
        if (emailRow.phone_number !== input.phoneNumber) throw new Error("PHONE_NUMBER_MISMATCH");
        userId = emailRow.id;
      } else if (phoneRow) {
        // Do not allow claiming an existing phone-only account via emailed OTP.
        if (!phoneRow.email) throw new Error("EMAIL_NOT_SET");
        if (phoneRow.email !== input.email) throw new Error("EMAIL_MISMATCH");
        userId = phoneRow.id;
      } else {
        userId = uuidv4();
        await client.query(
          `
          INSERT INTO users (id, phone_number, email, is_driver, is_verified, is_phone_verified, is_email_verified)
          VALUES ($1, $2, $3, false, false, false, false)
          `,
          [userId, input.phoneNumber, input.email],
        );

        await client.query(
          `
          INSERT INTO user_profiles (user_id, first_name, last_name, profile_picture_url, bio, city)
          VALUES ($1, NULL, NULL, NULL, NULL, NULL)
          ON CONFLICT (user_id) DO NOTHING
          `,
          [userId],
        );

        await client.query(
          `
          INSERT INTO user_rating_summary (user_id, average_rating, total_reviews, total_rides)
          VALUES ($1, 0, 0, 0)
          ON CONFLICT (user_id) DO NOTHING
          `,
          [userId],
        );
      }

      await client.query(
        `
        INSERT INTO user_auth (user_id, otp_code, otp_expiry, last_login)
        VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, NULL)
        ON CONFLICT (user_id)
        DO UPDATE SET otp_code = EXCLUDED.otp_code, otp_expiry = EXCLUDED.otp_expiry
        `,
        [userId, otpHash, OTP_EXPIRY_MINUTES],
      );

      await client.query("COMMIT");
      return { userId, otp };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async requestEmailOtpForUser(input: { userId: string; email: string }): Promise<{ otp: string }> {
    const client = await db.connect();
    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    try {
      await client.query("BEGIN");

      const userRes = await client.query<DbUserRow>(
        `
        SELECT id, phone_number, email, is_driver, is_verified, is_phone_verified, is_email_verified
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [input.userId],
      );

      const row = userRes.rows[0];
      if (!row) throw new Error("USER_NOT_FOUND");

      const emailRes = await client.query<{ id: string }>(
        `
        SELECT id
        FROM users
        WHERE email = $1
        LIMIT 1
        `,
        [input.email],
      );

      const emailRow = emailRes.rows[0];
      if (emailRow && emailRow.id !== input.userId) {
        throw new Error("EMAIL_ALREADY_IN_USE");
      }

      if (row.email && row.email !== input.email) {
        if (row.is_email_verified) throw new Error("EMAIL_ALREADY_VERIFIED");
        await client.query(
          `
          UPDATE users
          SET
            email = $2,
            is_email_verified = false,
            is_verified = false,
            updated_at = NOW()
          WHERE id = $1
          `,
          [input.userId, input.email],
        );
      }

      if (!row.email) {
        await client.query(
          `
          UPDATE users
          SET
            email = $2,
            is_email_verified = false,
            is_verified = false,
            updated_at = NOW()
          WHERE id = $1
          `,
          [input.userId, input.email],
        );
      }

      await client.query(
        `
        INSERT INTO user_auth (user_id, otp_code, otp_expiry, last_login)
        VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, NULL)
        ON CONFLICT (user_id)
        DO UPDATE SET otp_code = EXCLUDED.otp_code, otp_expiry = EXCLUDED.otp_expiry
        `,
        [input.userId, otpHash, OTP_EXPIRY_MINUTES],
      );

      await client.query("COMMIT");
      return { otp };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async verifyOtpByPhone(input: { phoneNumber: string; otp: string }): Promise<{
    userId: string;
    phoneNumber: string;
    email: string | null;
  }> {
    const otpHash = hashOtp(input.otp);

    const res = await db.query<DbUserRow & { otp_code: string | null; otp_expiry: Date | null; otp_expired: boolean }>(
      `
      SELECT
        u.id,
        u.phone_number,
        u.email,
        u.is_driver,
        u.is_verified,
        u.is_phone_verified,
        u.is_email_verified,
        a.otp_code,
        a.otp_expiry,
        (a.otp_expiry IS NOT NULL AND a.otp_expiry < NOW()) AS otp_expired
      FROM users u
      JOIN user_auth a ON a.user_id = u.id
      WHERE u.phone_number = $1
      LIMIT 1
      `,
      [input.phoneNumber],
    );

    const row = res.rows[0];
    if (!row) throw new Error("USER_NOT_FOUND");
    if (!row.otp_code || !row.otp_expiry) throw new Error("OTP_NOT_REQUESTED");
    if (row.otp_expired) throw new Error("OTP_EXPIRED");
    if (row.otp_code !== otpHash) throw new Error("OTP_INVALID");

    await db.query(
      `
      UPDATE users
      SET
        is_email_verified = true,
        is_verified = is_phone_verified,
        updated_at = NOW()
      WHERE id = $1
      `,
      [row.id],
    );

    await db.query(
      `
      UPDATE user_auth
      SET last_login = NOW(), otp_code = NULL, otp_expiry = NULL
      WHERE user_id = $1
      `,
      [row.id],
    );

    return { userId: row.id, phoneNumber: row.phone_number, email: row.email };
  },

  async upsertVerifiedUserByPhone(input: {
    phoneNumber: string;
    email?: string | null;
  }): Promise<{ userId: string; phoneNumber: string; email: string | null }> {
    const client = await db.connect();
    const normalizedEmail = (input.email ?? null) && String(input.email).trim().length
      ? String(input.email).trim()
      : null;

    try {
      await client.query('BEGIN');

      const existing = await client.query<DbUserRow>(
        `
        SELECT id, phone_number, email, is_driver, is_verified, is_phone_verified, is_email_verified
        FROM users
        WHERE phone_number = $1
        LIMIT 1
        `,
        [input.phoneNumber],
      );

      let userId: string;
      let email: string | null = normalizedEmail;

      if (existing.rowCount && existing.rows[0]) {
        const row = existing.rows[0];
        userId = row.id;
        email = row.email ?? normalizedEmail;

        // Mark phone verified and optionally attach email.
        if (normalizedEmail && !row.email) {
          await client.query(
            `
            UPDATE users
            SET
              email = $2,
              is_phone_verified = true,
              is_verified = is_email_verified,
              updated_at = NOW()
            WHERE id = $1
            `,
            [userId, normalizedEmail],
          );
        } else {
          await client.query(
            `
            UPDATE users
            SET
              is_phone_verified = true,
              is_verified = is_email_verified,
              updated_at = NOW()
            WHERE id = $1
            `,
            [userId],
          );
        }
      } else {
        userId = uuidv4();
        await client.query(
          `
          INSERT INTO users (id, phone_number, email, is_driver, is_verified, is_phone_verified, is_email_verified)
          VALUES ($1, $2, $3, false, false, true, false)
          `,
          [userId, input.phoneNumber, normalizedEmail],
        );

        await client.query(
          `
          INSERT INTO user_profiles (user_id, first_name, last_name, profile_picture_url, bio, city)
          VALUES ($1, NULL, NULL, NULL, NULL, NULL)
          ON CONFLICT (user_id) DO NOTHING
          `,
          [userId],
        );

        await client.query(
          `
          INSERT INTO user_rating_summary (user_id, average_rating, total_reviews, total_rides)
          VALUES ($1, 0, 0, 0)
          ON CONFLICT (user_id) DO NOTHING
          `,
          [userId],
        );
      }

      await client.query('COMMIT');
      return { userId, phoneNumber: input.phoneNumber, email };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getUserById(userId: string): Promise<DbUserRow> {
    const res = await db.query<DbUserRow>(
      `
      SELECT id, phone_number, email, is_driver, is_verified, is_phone_verified, is_email_verified
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId],
    );
    const row = res.rows[0];
    if (!row) throw new Error("USER_NOT_FOUND");
    return row;
  },

  async getUserProfile(userId: string): Promise<DbUserProfileRow> {
    const res = await db.query<DbUserProfileRow>(
      `
      SELECT user_id, first_name, last_name, profile_picture_url, bio, city
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );
    const row = res.rows[0];
    if (!row) throw new Error("USER_PROFILE_NOT_FOUND");
    return row;
  },

  async upsertUserProfile(input: {
    userId: string;
    firstName: string;
    lastName: string;
    profilePictureUrl: string;
    bio: string;
    city: string;
  }): Promise<void> {
    await db.query(
      `
      INSERT INTO user_profiles (user_id, first_name, last_name, profile_picture_url, bio, city)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        profile_picture_url = EXCLUDED.profile_picture_url,
        bio = EXCLUDED.bio,
        city = EXCLUDED.city
      `,
      [
        input.userId,
        input.firstName || null,
        input.lastName || null,
        input.profilePictureUrl || null,
        input.bio || null,
        input.city || null,
      ],
    );
  },

  async getUserRatingSummary(userId: string): Promise<DbUserRatingSummaryRow> {
    const res = await db.query<DbUserRatingSummaryRow>(
      `
      SELECT user_id, average_rating, total_reviews, total_rides
      FROM user_rating_summary
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );
    const row = res.rows[0];
    if (!row) throw new Error("USER_RATING_SUMMARY_NOT_FOUND");
    return row;
  },

  async incrementRideCount(userId: string): Promise<number> {
    const res = await db.query<{ total_rides: number }>(
      `
      UPDATE user_rating_summary
      SET total_rides = total_rides + 1
      WHERE user_id = $1
      RETURNING total_rides
      `,
      [userId],
    );
    const row = res.rows[0];
    if (!row) throw new Error("USER_RATING_SUMMARY_NOT_FOUND");
    return row.total_rides;
  },

  async updateRatingAggregate(input: { userId: string; newRating: number }): Promise<void> {
    // Simple running average update; production systems often compute from immutable reviews.
    await db.query(
      `
      UPDATE user_rating_summary
      SET
        total_reviews = total_reviews + 1,
        average_rating = ((average_rating * total_reviews) + $2) / (total_reviews + 1)
      WHERE user_id = $1
      `,
      [input.userId, input.newRating],
    );
  },
};