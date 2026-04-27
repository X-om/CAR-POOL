import { user } from "@repo/grpc";
import { signAccessToken } from "@repo/auth";
import { sendMail } from "@repo/mailer";
import { APP_NAME, FIREBASE_AUTH_ENABLED, JWT_SECRET, MAIL_FROM, OTP_EXPIRY_MINUTES } from "../env";
import { userRepository } from "../db/user.repository";
import { verifyFirebaseIdToken } from "../utils/firebase";

export const userService = {
  async registerUser(data: user.RegisterUserRequest): Promise<user.RegisterUserResponse> {
    const { userId, otp } = await userRepository.createOrRefreshOtp({
      phoneNumber: data.phoneNumber,
      email: data.email,
    });

    try {
      await sendMail({
        from: MAIL_FROM,
        to: data.email,
        templateId: "auth-otp",
        templateVariables: {
          appName: APP_NAME,
          email: data.email,
          otp,
          expiryMinutes: OTP_EXPIRY_MINUTES,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[user-service] failed to enqueue OTP email", err);
      // For local dev, fall back to logs.
      // eslint-disable-next-line no-console
      console.log(`[user-service] OTP for ${data.email}: ${otp}`);
    }

    return {
      userId,
      otpSend: "OTP_SENT",
    };
  },

  async verifyOtp(data: user.VerifyOTPRequest): Promise<user.VerifyOTPResponse> {
    const verified = await userRepository.verifyOtpByPhone({
      phoneNumber: data.phoneNumber,
      otp: data.otp,
    });

    const claims: { sub: string; phoneNumber: string; email?: string } = {
      sub: verified.userId,
      phoneNumber: verified.phoneNumber,
    };
    if (verified.email) claims.email = verified.email;
    const token = signAccessToken(claims, JWT_SECRET);

    if (verified.email) {
      try {
        await sendMail({
          from: MAIL_FROM,
          to: verified.email,
          templateId: 'security-new-login',
          templateVariables: {
            appName: APP_NAME,
            email: verified.email,
            time: new Date().toISOString(),
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[user-service] failed to enqueue security-new-login email', err);
      }
    }

    return {
      userId: verified.userId,
      token,
    };
  },

  async requestEmailOtp(data: user.RequestEmailOTPRequest): Promise<user.RequestEmailOTPResponse> {
    const email = data.email.trim();
    if (!email) throw new Error("EMAIL_REQUIRED");

    const { otp } = await userRepository.requestEmailOtpForUser({
      userId: data.userId,
      email,
    });

    try {
      await sendMail({
        from: MAIL_FROM,
        to: email,
        templateId: "auth-otp",
        templateVariables: {
          appName: APP_NAME,
          email,
          otp,
          expiryMinutes: OTP_EXPIRY_MINUTES,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[user-service] failed to enqueue OTP email", err);
      // For local dev, fall back to logs.
      // eslint-disable-next-line no-console
      console.log(`[user-service] OTP for ${email}: ${otp}`);
    }

    return {
      userId: data.userId,
      otpSend: "OTP_SENT",
    };
  },

  async exchangeFirebaseIdToken(
    data: user.ExchangeFirebaseIdTokenRequest,
  ): Promise<user.ExchangeFirebaseIdTokenResponse> {
    if (!FIREBASE_AUTH_ENABLED) throw new Error('FIREBASE_AUTH_DISABLED');

    let decoded: Awaited<ReturnType<typeof verifyFirebaseIdToken>>;
    try {
      decoded = await verifyFirebaseIdToken(data.idToken);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[user-service] firebase idToken verification failed', err);
      throw new Error('FIREBASE_ID_TOKEN_INVALID');
    }

    const phoneNumber = typeof decoded.phone_number === 'string' ? decoded.phone_number.trim() : '';
    if (!phoneNumber) throw new Error('PHONE_NUMBER_REQUIRED');

    const email = typeof decoded.email === 'string' ? decoded.email.trim() : null;

    const u = await userRepository.upsertVerifiedUserByPhone({ phoneNumber, email });

    const claims: { sub: string; phoneNumber: string; email?: string } = {
      sub: u.userId,
      phoneNumber: u.phoneNumber,
    };
    if (u.email) claims.email = u.email;
    const token = signAccessToken(claims, JWT_SECRET);

    return { userId: u.userId, token };
  },

  async getUser(data: user.GetUserRequest): Promise<user.GetUserResponse> {
    const u = await userRepository.getUserById(data.userId);
    return {
      userId: u.id,
      phoneNumber: u.phone_number,
      email: u.email ?? "",
      isVerified: u.is_verified,
      isDriver: u.is_driver,
      isPhoneVerified: u.is_phone_verified,
      isEmailVerified: u.is_email_verified,
    };
  },

  async getUserProfile(data: user.GetUserProfileRequest): Promise<user.GetUserProfileResponse> {
    const profile = await userRepository.getUserProfile(data.userId);
    return {
      userId: profile.user_id,
      name: [profile.first_name, profile.last_name].filter(Boolean).join(" "),
      profilePictureUrl: profile.profile_picture_url ?? "",
      bio: profile.bio ?? "",
      city: profile.city ?? "",
    };
  },

  async updateUserProfile(data: user.UpdateUserProfileRequest): Promise<user.UpdateUserProfileResponse> {
    await userRepository.upsertUserProfile({
      userId: data.userId,
      firstName: data.firstName,
      lastName: data.lastName,
      profilePictureUrl: data.profilePictureUrl,
      bio: data.bio,
      city: data.city,
    });
    return { success: true };
  },

  async getUserRating(data: user.GetUserRatingRequest): Promise<user.GetUserRatingResponse> {
    const rating = await userRepository.getUserRatingSummary(data.userId);
    return {
      averageRating: rating.average_rating,
      totalRatings: rating.total_reviews,
    };
  },

  async incrementUserRideCount(
    data: user.IncrementUserRideCountRequest,
  ): Promise<user.IncrementUserRideCountResponse> {
    const totalRides = await userRepository.incrementRideCount(data.userId);
    return { totalRides };
  },

  async updateUserRating(data: user.UpdateUserRatingRequest): Promise<user.UpdateUserRatingResponse> {
    await userRepository.updateRatingAggregate({ userId: data.userId, newRating: data.newRating });
    return { success: true };
  },
};