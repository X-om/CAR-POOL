import { useMutation } from "@tanstack/react-query";

import { register, verifyOtp } from "@/features/auth/api/authApi";

export function useRegisterMutation() {
  return useMutation({
    mutationFn: register,
  });
}

export function useVerifyOtpMutation() {
  return useMutation({
    mutationFn: verifyOtp,
  });
}
