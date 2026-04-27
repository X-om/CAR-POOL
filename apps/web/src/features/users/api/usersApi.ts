import { apiGet } from "@/lib/api/apiClient";
import type { User } from "@/types/api";

export async function getUser(userId: string) {
  return apiGet<User>(`/users/${userId}`, { auth: true });
}
