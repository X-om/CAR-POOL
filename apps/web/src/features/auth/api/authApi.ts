import { apiPost } from "@/lib/api/apiClient";

export async function register(payload: {
  phoneNumber: string;
  email: string;
}) {
  return apiPost<{ userId: string; otpSend: string }>("/auth/register", payload);
}

export async function verifyOtp(payload: { phoneNumber: string; otp: string }) {
  return apiPost<{ userId: string; token: string }>("/auth/verify-otp", payload);
}

export async function requestEmailOtp(payload: { email: string }) {
  return apiPost<{ userId: string; otpSend: string }>(
    "/auth/request-email-otp",
    payload,
    { auth: true }
  );
}

export async function exchangeFirebaseIdToken(payload: { idToken: string }) {
  return apiPost<{ userId: string; token: string }>("/auth/firebase/exchange", payload);
}
