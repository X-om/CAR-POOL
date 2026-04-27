import { apiGet, apiPut } from "@/lib/api/apiClient";
import type { UserProfile } from "@/types/api";

export async function getUserProfile(userId: string) {
  return apiGet<UserProfile>(`/users/${userId}/profile`, { auth: true });
}

export async function updateUserProfile(
  userId: string,
  payload: {
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
    bio?: string;
    city?: string;
  }
) {
  return apiPut<{ success: boolean }>(`/users/${userId}/profile`, payload, { auth: true });
}
