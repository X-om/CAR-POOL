"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/layout/PageHeader";
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
import { Textarea } from "@/components/ui/textarea";
import { getUserProfile, updateUserProfile } from "@/features/profile/api/profileApi";
import { getUserId } from "@/lib/auth/tokenStore";
import { queryKeys } from "@/lib/query/keys";

const ProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  profilePictureUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => v === undefined || v === "" || /^https?:\/\//.test(v), {
      message: "Must be a valid URL",
    }),
  bio: z.string().trim().optional(),
  city: z.string().trim().optional(),
});

type ProfileFormInput = z.input<typeof ProfileSchema>;
type ProfileValues = z.output<typeof ProfileSchema>;

function splitName(fullName: string): { firstName: string; lastName: string } {
  const name = fullName.trim();
  if (!name) return { firstName: "", lastName: "" };
  const parts = name.split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName: lastName || "" };
}

export function ProfileScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const userId = getUserId();

  const next = searchParams.get("next") || "/passenger/search";

  const profileQuery = useQuery({
    queryKey: userId ? queryKeys.userProfile(userId) : ["userProfile", "missing"],
    queryFn: async () => {
      if (!userId) throw new Error("Missing user session");
      return getUserProfile(userId);
    },
    enabled: Boolean(userId),
  });

  const form = useForm<ProfileFormInput>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      profilePictureUrl: "",
      bio: "",
      city: "",
    },
  });

  React.useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;

    const { firstName, lastName } = splitName(profile.name);

    form.reset({
      firstName,
      lastName,
      profilePictureUrl: profile.profilePictureUrl || "",
      bio: profile.bio || "",
      city: profile.city || "",
    });
  }, [profileQuery.data, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: ProfileValues) => {
      if (!userId) throw new Error("Missing user session");
      return updateUserProfile(userId, {
        firstName: values.firstName,
        lastName: values.lastName,
        profilePictureUrl: values.profilePictureUrl || undefined,
        bio: values.bio || undefined,
        city: values.city || undefined,
      });
    },
    onSuccess: async () => {
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) });
      }
      toast.success("Profile saved");
      router.push(next);
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = ProfileSchema.safeParse(values);
    if (!parsed.success) {
      toast.error("Fix profile inputs first");
      return;
    }

    try {
      await updateMutation.mutateAsync(parsed.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save profile";
      toast.error(message);
    }
  });

  const isIncomplete = Boolean(profileQuery.data && !profileQuery.data.name.trim());

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Profile"
        description={
          isIncomplete
            ? "Complete your profile to continue."
            : "Update your profile details."
        }
      />

      {!userId ? (
        <Card>
          <CardHeader>
            <CardTitle>Missing session</CardTitle>
            <CardDescription>Please sign in again.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/auth/sign-in")}>Sign in</Button>
          </CardFooter>
        </Card>
      ) : null}

      {profileQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load profile</CardTitle>
            <CardDescription>
              {profileQuery.error instanceof Error
                ? profileQuery.error.message
                : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{isIncomplete ? "Complete profile" : "Edit profile"}</CardTitle>
          <CardDescription>
            Your name is required. Other fields are optional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" {...form.register("firstName")} />
                {form.formState.errors.firstName ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" {...form.register("lastName")} />
                {form.formState.errors.lastName ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profilePictureUrl">Profile picture URL</Label>
              <Input id="profilePictureUrl" {...form.register("profilePictureUrl")} />
              {form.formState.errors.profilePictureUrl ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.profilePictureUrl.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...form.register("city")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={4} {...form.register("bio")} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save"}
              </Button>
              {!isIncomplete ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/passenger/search")}
                >
                  Back
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
