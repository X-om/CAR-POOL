import { apiGet, apiPost } from "@/lib/api/apiClient";
import type { NotificationItem } from "@/types/api";

export async function listNotifications() {
  return apiGet<{ notifications: NotificationItem[] }>("/notifications", { auth: true });
}

export async function markNotificationRead(notificationId: string) {
  return apiPost<{ success: true }>(
    `/notifications/${notificationId}/read`,
    undefined,
    { auth: true }
  );
}
