/* @name IUser */
SELECT 
  id,
  phone_number,
  email,
  is_driver,
  is_verified,
  created_at,
  updated_at
FROM users 
LIMIT 1;

/* @name IUserProfile */
SELECT  
  user_id,
  first_name,
  last_name,
  profile_picture_url,
  bio,
  city
FROM user_profiles
LIMIT 1;

/* @name IUserAuth */
SELECT
  user_id,
  otp_code,
  otp_expiry,
  last_login
FROM user_auth
LIMIT 1;

/* @name IUserRatingSummary */
SELECT
  user_id,
  average_rating,
  total_reviews,
  total_rides
FROM user_rating_summary
LIMIT 1;

