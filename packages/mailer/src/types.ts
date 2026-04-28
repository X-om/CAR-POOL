import { z } from "zod";

export const EmailTemplateIdSchema = z.enum([
  "auth-otp",
  "security-new-login",
  "booking-requested",
  "booking-approved",
  "booking-rejected",
  "booking-cancelled",
  "ride-created",
  "ride-updated",
  "ride-cancelled",
  "trip-reminder",
  "trip-pickup",
  "trip-started",
  "trip-completed",
]);

export type EmailTemplateId = z.infer<typeof EmailTemplateIdSchema>;

export type EmailTemplateVariables = {
  "auth-otp": {
    appName: string;
    email: string;
    otp: string;
    expiryMinutes: number;
  };
  "security-new-login": {
    appName: string;
    email: string;
    time: string;
    ip?: string;
    userAgent?: string;
  };
  "booking-requested": {
    appName: string;
    driverEmail: string;
    bookingId: string;
    rideId: string;
    passengerId: string;
    seatCount: number;
    sourceCity?: string;
    destinationCity?: string;
    departureTime?: string;
  };
  "booking-approved": {
    appName: string;
    passengerEmail: string;
    bookingId: string;
    rideId: string;
    driverId: string;
    seatCount: number;
    sourceCity?: string;
    destinationCity?: string;
    departureTime?: string;
  };
  "booking-rejected": {
    appName: string;
    passengerEmail: string;
    bookingId: string;
    rideId: string;
    driverId: string;
    seatCount: number;
    sourceCity?: string;
    destinationCity?: string;
    departureTime?: string;
  };
  "booking-cancelled": {
    appName: string;
    toEmail: string;
    bookingId: string;
    rideId: string;
    cancelledByUserId: string;
    seatCount: number;
    sourceCity?: string;
    destinationCity?: string;
    departureTime?: string;
  };
  "ride-created": {
    appName: string;
    driverEmail: string;
    rideId: string;
    sourceCity?: string;
    destinationCity?: string;
    departureTime?: string;
  };
  "ride-updated": {
    appName: string;
    passengerEmail: string;
    rideId: string;
    sourceCity?: string;
    destinationCity?: string;
    departureTime?: string;
    changeSummary?: string;
  };
  "ride-cancelled": {
    appName: string;
    passengerEmail: string;
    rideId: string;
    sourceCity?: string;
    destinationCity?: string;
    departureTime?: string;
  };
  "trip-reminder": {
    appName: string;
    toEmail: string;
    rideId: string;
    tripId?: string;
    sourceCity?: string;
    destinationCity?: string;
    departureTime?: string;
  };
  "trip-pickup": {
    appName: string;
    toEmail: string;
    tripId: string;
    passengerId: string;
    pickedAt: string;
  };
  "trip-started": {
    appName: string;
    toEmail: string;
    tripId: string;
    rideId: string;
    driverId: string;
    startedAt: string;
  };
  "trip-completed": {
    appName: string;
    toEmail: string;
    tripId: string;
    rideId: string;
    driverId: string;
    completedAt: string;
  };
};

export type EmailJob<TTemplateId extends EmailTemplateId = EmailTemplateId> = {
  jobId: string;
  createdAt: string;
  from: string;
  to: string;
  templateId: TTemplateId;
  templateVariables: EmailTemplateVariables[TTemplateId];
  attempt?: number;
  maxAttempts?: number;
  lastError?: string;
};

export const EmailJobSchema = z.object({
  jobId: z.string().min(1),
  createdAt: z.string().min(1),
  from: z.string().min(1),
  to: z.string().email(),
  templateId: EmailTemplateIdSchema,
  templateVariables: z.record(z.string(), z.unknown()),
  attempt: z.number().int().nonnegative().optional(),
  maxAttempts: z.number().int().positive().optional(),
  lastError: z.string().min(1).optional(),
});

export const EMAIL_JOBS_TOPIC = "email.jobs.v1" as const;
export const EMAIL_JOBS_DLQ_TOPIC = "email.jobs.dlq.v1" as const;
