"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import {
  listNotifications,
  markNotificationRead,
} from "@/features/notifications/api/notificationsApi";
import { formatDateTime } from "@/lib/format/date";
import { queryKeys } from "@/lib/query/keys";

export function NotificationsScreen() {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: listNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      toast.success("Marked as read");
    },
  });

  const items = notificationsQuery.data?.notifications ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Notifications"
        description="Realtime updates arrive here and as toasts."
      />

      {notificationsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load notifications</CardTitle>
            <CardDescription>
              {notificationsQuery.error instanceof Error
                ? notificationsQuery.error.message
                : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {items.length === 0 && !notificationsQuery.isPending && !notificationsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>No notifications</CardTitle>
            <CardDescription>
              You’ll see booking / trip updates here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {items.map((n) => (
          <Card key={n.notificationId}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <CardTitle className="text-base">
                    {n.title || n.type || "Notification"}
                  </CardTitle>
                  <CardDescription>
                    {formatDateTime(n.timestamp)}
                    {n.eventType ? ` • ${n.eventType}` : null}
                  </CardDescription>
                </div>
                <Badge variant={n.isRead ? "outline" : "secondary"}>
                  {n.isRead ? "Read" : "Unread"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm">{n.message}</CardContent>
            <CardFooter className="justify-end">
              {!n.isRead ? (
                <Button
                  variant="outline"
                  onClick={() => markReadMutation.mutate(n.notificationId)}
                  disabled={markReadMutation.isPending}
                >
                  Mark read
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
