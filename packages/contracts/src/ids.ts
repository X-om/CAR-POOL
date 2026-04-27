import { z } from "zod";

export const UuidSchema = z.uuid();

export const UserIdSchema = UuidSchema;
export type UserId = z.infer<typeof UserIdSchema>;

export const RideIdSchema = UuidSchema;
export type RideId = z.infer<typeof RideIdSchema>;

export const BookingIdSchema = UuidSchema;
export type BookingId = z.infer<typeof BookingIdSchema>;

export const TripIdSchema = UuidSchema;
export type TripId = z.infer<typeof TripIdSchema>;
