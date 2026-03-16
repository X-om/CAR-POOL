/** Types generated for queries found in "src/schema/notification.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** 'INotifications' parameters type */
export type IINotificationsParams = void;

/** 'INotifications' return type */
export interface IINotificationsResult {
  created_at: Date | null;
  id: string;
  is_read: boolean | null;
  message: string | null;
  metadata: Json | null;
  notification_type: string | null;
  title: string | null;
  user_id: string | null;
}

/** 'INotifications' query type */
export interface IINotificationsQuery {
  params: IINotificationsParams;
  result: IINotificationsResult;
}

const iNotificationsIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT\n  id,\n  user_id,\n  notification_type,\n  title,\n  message,\n  metadata,\n  is_read,\n  created_at\nFROM notifications\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   user_id,
 *   notification_type,
 *   title,
 *   message,
 *   metadata,
 *   is_read,
 *   created_at
 * FROM notifications
 * LIMIT 1
 * ```
 */
export const iNotifications = new PreparedQuery<IINotificationsParams,IINotificationsResult>(iNotificationsIR);


/** 'INotificationDeliveryLog' parameters type */
export type IINotificationDeliveryLogParams = void;

/** 'INotificationDeliveryLog' return type */
export interface IINotificationDeliveryLogResult {
  delivered_at: Date | null;
  delivery_channel: string | null;
  delivery_status: string | null;
  id: string;
  notification_id: string | null;
}

/** 'INotificationDeliveryLog' query type */
export interface IINotificationDeliveryLogQuery {
  params: IINotificationDeliveryLogParams;
  result: IINotificationDeliveryLogResult;
}

const iNotificationDeliveryLogIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT\n  id,\n  notification_id,\n  delivery_channel,\n  delivery_status,\n  delivered_at\nFROM notification_delivery_log\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   notification_id,
 *   delivery_channel,
 *   delivery_status,
 *   delivered_at
 * FROM notification_delivery_log
 * LIMIT 1
 * ```
 */
export const iNotificationDeliveryLog = new PreparedQuery<IINotificationDeliveryLogParams,IINotificationDeliveryLogResult>(iNotificationDeliveryLogIR);


