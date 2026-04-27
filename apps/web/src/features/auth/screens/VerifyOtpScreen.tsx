"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setSession } from "@/lib/auth/tokenStore";
import { useVerifyOtpMutation } from "@/features/auth/hooks/useAuthMutations";
import { VerifyOtpSchema, type VerifyOtpValues } from "@/features/auth/schemas/authSchemas";
import { getUserProfile } from "@/features/profile/api/profileApi";

const COUNTRY_CODE = "+91";

export function VerifyOtpScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifyMutation = useVerifyOtpMutation();

  const defaultPhoneNumber = searchParams.get("phoneNumber") || "";
  const defaultLocalPhone = React.useMemo(() => {
    const raw = defaultPhoneNumber.trim();
    if (raw.startsWith(COUNTRY_CODE)) return raw.slice(COUNTRY_CODE.length).replace(/\D/g, "");
    return raw.replace(/\D/g, "");
  }, [defaultPhoneNumber]);

  const [localPhone, setLocalPhone] = React.useState(defaultLocalPhone);

  const form = useForm<VerifyOtpValues>({
    resolver: zodResolver(VerifyOtpSchema),
    defaultValues: {
      phoneNumber: defaultPhoneNumber || COUNTRY_CODE,
      otp: "",
    },
  });

  React.useEffect(() => {
    // Keep form state aligned to the country code + local digits.
    const digits = (defaultLocalPhone || "").replace(/\D/g, "").slice(0, 10);
    setLocalPhone(digits);
    form.setValue("phoneNumber", `${COUNTRY_CODE}${digits}`, { shouldValidate: true });
  }, [defaultLocalPhone, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await verifyMutation.mutateAsync(values);
      setSession({ token: res.token, userId: res.userId });
      toast.success("Signed in");

      try {
        const profile = await getUserProfile(res.userId);
        if (!profile.name.trim()) {
          const qs = new URLSearchParams({ next: "/passenger/search" });
          router.push(`/profile?${qs.toString()}`);
          return;
        }
      } catch {
        // If profile fetch fails, fall back to the app and let ProfileGate handle it.
      }

      router.push("/passenger/search");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid OTP";
      toast.error(message);
    }
  });

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Verify OTP</CardTitle>
          <CardDescription>
            Enter the 6-digit OTP we emailed you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="phoneNumber">Phone number</Label>
              <div className="flex">
                <div className="flex h-8 items-center rounded-l-lg border border-input bg-muted px-2 text-sm text-muted-foreground">
                  {COUNTRY_CODE}
                </div>
                <Input
                  id="phoneNumber"
                  className="rounded-l-none"
                  inputMode="numeric"
                  placeholder="9876543210"
                  value={localPhone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setLocalPhone(digits);
                    form.setValue("phoneNumber", `${COUNTRY_CODE}${digits}`, {
                      shouldValidate: true,
                    });
                  }}
                />
              </div>
              {form.formState.errors.phoneNumber ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.phoneNumber.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="otp">OTP</Label>
              <Input
                id="otp"
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                {...form.register("otp")}
              />
              {form.formState.errors.otp ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.otp.message}
                </p>
              ) : null}
            </div>

            <Button type="submit" disabled={verifyMutation.isPending}>
              {verifyMutation.isPending ? "Verifying…" : "Verify"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          If you didn’t receive it, go back and resend.
        </CardFooter>
      </Card>
    </div>
  );
}
