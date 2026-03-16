CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),

    notification_type TEXT,
    title TEXT,
    message TEXT,

    metadata JSONB,

    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notification_delivery_log (
    id UUID PRIMARY KEY,
    notification_id UUID REFERENCES notifications(id),

    delivery_channel TEXT,
    delivery_status TEXT,
    delivered_at TIMESTAMP
);