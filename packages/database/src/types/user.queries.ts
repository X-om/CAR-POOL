/** Types generated for queries found in "src/schema/user.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

/** 'IUser' parameters type */
export type IIUserParams = void;

/** 'IUser' return type */
export interface IIUserResult {
  created_at: Date | null;
  email: string | null;
  id: string;
  is_driver: boolean | null;
  is_verified: boolean | null;
  is_phone_verified: boolean | null;
  is_email_verified: boolean | null;
  phone_number: string;
  updated_at: Date | null;
}

/** 'IUser' query type */
export interface IIUserQuery {
  params: IIUserParams;
  result: IIUserResult;
}

const iUserIR: any = { "usedParamSet": {}, "params": [], "statement": "SELECT \n  id,\n  phone_number,\n  email,\n  is_driver,\n  is_verified,\n  is_phone_verified,\n  is_email_verified,\n  created_at,\n  updated_at\nFROM users \nLIMIT 1" };

/**
 * Query generated from SQL:
 * ```
 * SELECT 
 *   id,
 *   phone_number,
 *   email,
 *   is_driver,
 *   is_verified,
 *   is_phone_verified,
 *   is_email_verified,
 *   created_at,
 *   updated_at
 * FROM users 
 * LIMIT 1
 * ```
 */
export const iUser = new PreparedQuery<IIUserParams, IIUserResult>(iUserIR);


/** 'IUserProfile' parameters type */
export type IIUserProfileParams = void;

/** 'IUserProfile' return type */
export interface IIUserProfileResult {
  bio: string | null;
  city: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  user_id: string;
}

/** 'IUserProfile' query type */
export interface IIUserProfileQuery {
  params: IIUserProfileParams;
  result: IIUserProfileResult;
}

const iUserProfileIR: any = { "usedParamSet": {}, "params": [], "statement": "SELECT  \n  user_id,\n  first_name,\n  last_name,\n  profile_picture_url,\n  bio,\n  city\nFROM user_profiles\nLIMIT 1" };

/**
 * Query generated from SQL:
 * ```
 * SELECT  
 *   user_id,
 *   first_name,
 *   last_name,
 *   profile_picture_url,
 *   bio,
 *   city
 * FROM user_profiles
 * LIMIT 1
 * ```
 */
export const iUserProfile = new PreparedQuery<IIUserProfileParams, IIUserProfileResult>(iUserProfileIR);


/** 'IUserAuth' parameters type */
export type IIUserAuthParams = void;

/** 'IUserAuth' return type */
export interface IIUserAuthResult {
  last_login: Date | null;
  otp_code: string | null;
  otp_expiry: Date | null;
  user_id: string | null;
}

/** 'IUserAuth' query type */
export interface IIUserAuthQuery {
  params: IIUserAuthParams;
  result: IIUserAuthResult;
}

const iUserAuthIR: any = { "usedParamSet": {}, "params": [], "statement": "SELECT\n  user_id,\n  otp_code,\n  otp_expiry,\n  last_login\nFROM user_auth\nLIMIT 1" };

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   user_id,
 *   otp_code,
 *   otp_expiry,
 *   last_login
 * FROM user_auth
 * LIMIT 1
 * ```
 */
export const iUserAuth = new PreparedQuery<IIUserAuthParams, IIUserAuthResult>(iUserAuthIR);


/** 'IUserRatingSummary' parameters type */
export type IIUserRatingSummaryParams = void;

/** 'IUserRatingSummary' return type */
export interface IIUserRatingSummaryResult {
  average_rating: number | null;
  total_reviews: number | null;
  total_rides: number | null;
  user_id: string;
}

/** 'IUserRatingSummary' query type */
export interface IIUserRatingSummaryQuery {
  params: IIUserRatingSummaryParams;
  result: IIUserRatingSummaryResult;
}

const iUserRatingSummaryIR: any = { "usedParamSet": {}, "params": [], "statement": "SELECT\n  user_id,\n  average_rating,\n  total_reviews,\n  total_rides\nFROM user_rating_summary\nLIMIT 1" };

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   user_id,
 *   average_rating,
 *   total_reviews,
 *   total_rides
 * FROM user_rating_summary
 * LIMIT 1
 * ```
 */
export const iUserRatingSummary = new PreparedQuery<IIUserRatingSummaryParams, IIUserRatingSummaryResult>(iUserRatingSummaryIR);


