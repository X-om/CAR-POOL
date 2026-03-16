CREATE TABLE users (
    id UUID PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    is_driver BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    profile_picture_url TEXT,
    bio TEXT,
    city TEXT
);

CREATE TABLE user_auth (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    otp_code TEXT,
    otp_expiry TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE user_rating_summary (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    average_rating FLOAT DEFAULT 0,
    total_reviews INT DEFAULT 0,
    total_rides INT DEFAULT 0
);

