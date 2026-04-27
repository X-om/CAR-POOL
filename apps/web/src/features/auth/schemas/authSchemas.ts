import { z } from "zod";

export const RegisterSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  email: z.string().email("Enter a valid email"),
});

export type RegisterValues = z.infer<typeof RegisterSchema>;

export const VerifyOtpSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export type VerifyOtpValues = z.infer<typeof VerifyOtpSchema>;
