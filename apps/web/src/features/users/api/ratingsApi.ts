import { apiPost } from "@/lib/api/apiClient";

export async function submitUserRating(userId: string, newRating: number) {
  return apiPost<{ success: boolean }>(
    `/users/${userId}/rating`,
    { newRating },
    { auth: true }
  );
}
