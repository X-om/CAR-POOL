"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { useRegisterMutation } from "@/features/auth/hooks/useAuthMutations";
import { RegisterSchema, type RegisterValues } from "@/features/auth/schemas/authSchemas";

const COUNTRY_CODE = "+91";

export function RegisterScreen() {
  const router = useRouter();
  const registerMutation = useRegisterMutation();
  const [localPhone, setLocalPhone] = React.useState("");

  const form = useForm<RegisterValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      phoneNumber: COUNTRY_CODE,
      email: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await registerMutation.mutateAsync(values);
      toast.success("OTP sent to email");
      const params = new URLSearchParams({ phoneNumber: values.phoneNumber });
      router.push(`/auth/verify-otp?${params.toString()}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to send OTP";
      toast.error(message);
    }
  });

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Enter your phone number and email. We’ll send a 6-digit OTP.
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <Button type="submit" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Sending…" : "Send OTP"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          OTP is emailed to the address you enter.
        </CardFooter>
      </Card>
    </div>
  );
}
