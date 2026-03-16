/* @name INotifications */
SELECT
  id,
  user_id,
  notification_type,
  title,
  message,
  metadata,
  is_read,
  created_at
FROM notifications
LIMIT 1;

/* @name INotificationDeliveryLog */
SELECT
  id,
  notification_id,
  delivery_channel,
  delivery_status,
  delivered_at
FROM notification_delivery_log
LIMIT 1;