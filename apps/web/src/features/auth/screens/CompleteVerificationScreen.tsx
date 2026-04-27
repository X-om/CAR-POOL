"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  exchangeFirebaseIdToken,
  requestEmailOtp,
  verifyOtp,
} from "@/features/auth/api/authApi";
import { getUser } from "@/features/users/api/usersApi";
import { getUserId, setSession } from "@/lib/auth/tokenStore";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/firebaseClient";
import { queryKeys } from "@/lib/query/keys";

function sanitizeReturnTo(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export function CompleteVerificationScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  const userId = getUserId();

  const userQuery = useQuery({
    queryKey: userId ? queryKeys.user(userId) : ["user", "missing"],
    queryFn: async () => {
      if (!userId) throw new Error("Missing user session");
      return getUser(userId);
    },
    enabled: Boolean(userId),
  });

  const user = userQuery.data;

  const firebaseConfigured = isFirebaseConfigured();

  const recaptchaRef = React.useRef<RecaptchaVerifier | null>(null);
  const [confirmation, setConfirmation] = React.useState<ConfirmationResult | null>(null);
  const [smsCode, setSmsCode] = React.useState("");

  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");

  React.useEffect(() => {
    if (!user) return;
    if (!email && user.email) setEmail(user.email);
  }, [email, user]);

  React.useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const sendSmsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not loaded");
      if (!firebaseConfigured) throw new Error("Firebase is not configured");

      const auth = getFirebaseAuth();

      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }

      recaptchaRef.current = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );

      return signInWithPhoneNumber(auth, user.phoneNumber, recaptchaRef.current);
    },
    onSuccess: (res) => {
      setConfirmation(res);
      toast.success("SMS sent");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to send SMS");
    },
  });

  const confirmPhoneMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not loaded");
      if (!confirmation) throw new Error("SMS not sent yet");

      const code = smsCode.trim();
      if (!code) throw new Error("SMS code is required");

      const credential = await confirmation.confirm(code);
      const idToken = await credential.user.getIdToken();
      const res = await exchangeFirebaseIdToken({ idToken });

      if (res.userId !== user.userId) {
        throw new Error("Phone number does not match current account");
      }

      return res;
    },
    onSuccess: async (res) => {
      setSession({ token: res.token, userId: res.userId });
      setSmsCode("");
      setConfirmation(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.user(res.userId) });
      toast.success("Phone verified");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to verify phone");
    },
  });

  const requestOtpMutation = useMutation({
    mutationFn: async () => {
      const nextEmail = email.trim();
      if (!nextEmail) throw new Error("Email is required");
      return requestEmailOtp({ email: nextEmail });
    },
    onSuccess: () => {
      toast.success("OTP sent");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to send OTP");
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not loaded");
      const nextOtp = otp.trim();
      if (!nextOtp) throw new Error("OTP is required");
      return verifyOtp({ phoneNumber: user.phoneNumber, otp: nextOtp });
    },
    onSuccess: async (res) => {
      setSession({ token: res.token, userId: res.userId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.user(res.userId) });
      toast.success("Email verified");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to verify OTP");
    },
  });

  if (!userId) return null;

  const isPhoneVerified = user?.isPhoneVerified ?? false;
  const isEmailVerified = user?.isEmailVerified ?? false;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Complete verification"
        description="Verify phone and email. Your account is fully verified once both are verified."
      />

      {userQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load verification status</CardTitle>
            <CardDescription>
              {userQuery.error instanceof Error
                ? userQuery.error.message
                : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {userQuery.isPending ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
        </Card>
      ) : null}

      {user ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <CardTitle className="text-base">Phone</CardTitle>
                  <CardDescription>{user.phoneNumber}</CardDescription>
                </div>
                <Badge variant={isPhoneVerified ? "outline" : "secondary"}>
                  {isPhoneVerified ? "Verified" : "Not verified"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Phone verification uses SMS OTP via Firebase.
              </p>

              {!isPhoneVerified ? (
                firebaseConfigured ? (
                  <>
                    <div id="recaptcha-container" className="hidden" />

                    <div className="grid gap-2">
                      <Label htmlFor="smsCode">SMS code</Label>
                      <Input
                        id="smsCode"
                        inputMode="numeric"
                        placeholder="123456"
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value)}
                        disabled={!confirmation}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Set <span className="font-mono">NEXT_PUBLIC_FIREBASE_*</span> in
                    <span className="font-mono"> apps/web/.env.local</span> to enable
                    phone verification.
                  </p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Phone is verified.</p>
              )}
            </CardContent>

            {!isPhoneVerified ? (
              <CardFooter className="justify-end">
                {firebaseConfigured ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => sendSmsMutation.mutate()}
                      disabled={sendSmsMutation.isPending}
                    >
                      {sendSmsMutation.isPending
                        ? "Sending…"
                        : confirmation
                          ? "Resend SMS"
                          : "Send SMS"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => confirmPhoneMutation.mutate()}
                      disabled={!confirmation || !smsCode.trim() || confirmPhoneMutation.isPending}
                    >
                      {confirmPhoneMutation.isPending ? "Verifying…" : "Verify phone"}
                    </Button>
                  </div>
                ) : (
                  <Button type="button" disabled>
                    Verify phone (Firebase not configured)
                  </Button>
                )}
              </CardFooter>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <CardTitle className="text-base">Email</CardTitle>
                  <CardDescription>
                    {user.email ? user.email : "Add an email to verify"}
                  </CardDescription>
                </div>
                <Badge variant={isEmailVerified ? "outline" : "secondary"}>
                  {isEmailVerified ? "Verified" : "Not verified"}
                </Badge>
              </div>
            </CardHeader>

            {!isEmailVerified ? (
              <>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => requestOtpMutation.mutate()}
                      disabled={requestOtpMutation.isPending}
                    >
                      {requestOtpMutation.isPending ? "Sending…" : "Send OTP"}
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="otp">OTP</Label>
                    <Input
                      id="otp"
                      inputMode="numeric"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button
                    type="button"
                    onClick={() => verifyOtpMutation.mutate()}
                    disabled={verifyOtpMutation.isPending}
                  >
                    {verifyOtpMutation.isPending ? "Verifying…" : "Verify email"}
                  </Button>
                </CardFooter>
              </>
            ) : (
              <CardContent className="text-sm text-muted-foreground">
                Email is verified.
              </CardContent>
            )}
          </Card>
        </div>
      ) : null}

      {user && user.isVerified ? (
        <Card>
          <CardHeader>
            <CardTitle>All set</CardTitle>
            <CardDescription>Your phone and email are verified.</CardDescription>
          </CardHeader>
          {returnTo ? (
            <CardFooter className="justify-end">
              <Button type="button" onClick={() => router.push(returnTo)}>
                Continue
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
