import { db } from '@repo/database';

type DbNotificationRow = {
  id: string;
  user_id: string;
  notification_type: string | null;
  title: string | null;
  message: string;
  metadata: unknown | null;
  is_read: boolean;
  created_at: Date;
};

export const notificationRepository = {
  async listUserNotifications(userId: string): Promise<DbNotificationRow[]> {
    const res = await db.query<DbNotificationRow>(
      `
      SELECT id, user_id, notification_type, title, message, metadata, is_read, created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [userId],
    );
    return res.rows;
  },

  async markRead(input: { notificationId: string; userId: string }): Promise<boolean> {
    const res = await db.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1 AND user_id = $2
      `,
      [input.notificationId, input.userId],
    );
    return res.rowCount === 1;
  },
};
