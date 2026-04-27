import { z } from "zod";
import {
  BookingIdSchema,
  RideIdSchema,
  TripIdSchema,
  UserIdSchema,
  type BookingId,
  type RideId,
  type TripId,
  type UserId,
} from "./ids";
import { EventEnvelopeSchema, IsoDateTimeSchema, type EventEnvelope } from "./kafka";

// Topics (v1)
export const BOOKING_EVENTS_TOPIC = "booking.events.v1" as const;
export const RIDE_EVENTS_TOPIC = "ride.events.v1" as const;
export const TRIP_EVENTS_TOPIC = "trip.events.v1" as const;
export const DOMAIN_EVENTS_DLQ_TOPIC = "domain.events.dlq.v1" as const;

// Booking
export const BookingRequestedPayloadSchema = z.object({
  bookingId: BookingIdSchema,
  rideId: RideIdSchema,
  passengerId: UserIdSchema,
  driverId: UserIdSchema,
  seatCount: z.number().int().positive(),
});
export type BookingRequestedPayload = z.infer<typeof BookingRequestedPayloadSchema>;

export const BookingApprovedPayloadSchema = z.object({
  bookingId: BookingIdSchema,
  rideId: RideIdSchema,
  passengerId: UserIdSchema,
  driverId: UserIdSchema,
  seatCount: z.number().int().positive(),
});
export type BookingApprovedPayload = z.infer<typeof BookingApprovedPayloadSchema>;

export const BookingRejectedPayloadSchema = z.object({
  bookingId: BookingIdSchema,
  rideId: RideIdSchema,
  passengerId: UserIdSchema,
  driverId: UserIdSchema,
  seatCount: z.number().int().positive(),
  reason: z.string().min(1).optional(),
});
export type BookingRejectedPayload = z.infer<typeof BookingRejectedPayloadSchema>;

export const BookingCancelledPayloadSchema = z.object({
  bookingId: BookingIdSchema,
  rideId: RideIdSchema,
  passengerId: UserIdSchema,
  driverId: UserIdSchema,
  seatCount: z.number().int().positive(),
  cancelledByUserId: UserIdSchema,
});
export type BookingCancelledPayload = z.infer<typeof BookingCancelledPayloadSchema>;

// Ride
export const RideCreatedPayloadSchema = z.object({
  rideId: RideIdSchema,
  driverId: UserIdSchema,
  occurredAt: IsoDateTimeSchema,
});
export type RideCreatedPayload = z.infer<typeof RideCreatedPayloadSchema>;

export const RideUpdatedPayloadSchema = z.object({
  rideId: RideIdSchema,
  driverId: UserIdSchema,
  occurredAt: IsoDateTimeSchema,
  changeSummary: z.string().min(1).optional(),
});
export type RideUpdatedPayload = z.infer<typeof RideUpdatedPayloadSchema>;

export const RideCancelledPayloadSchema = z.object({
  rideId: RideIdSchema,
  driverId: UserIdSchema,
  occurredAt: IsoDateTimeSchema,
});
export type RideCancelledPayload = z.infer<typeof RideCancelledPayloadSchema>;

// Trip
export const TripStartedPayloadSchema = z.object({
  tripId: TripIdSchema,
  rideId: RideIdSchema,
  driverId: UserIdSchema,
  occurredAt: IsoDateTimeSchema,
});
export type TripStartedPayload = z.infer<typeof TripStartedPayloadSchema>;

export const TripCompletedPayloadSchema = z.object({
  tripId: TripIdSchema,
  rideId: RideIdSchema,
  driverId: UserIdSchema,
  occurredAt: IsoDateTimeSchema,
});
export type TripCompletedPayload = z.infer<typeof TripCompletedPayloadSchema>;

// Typed envelope helpers
export type DomainEventType =
  | "booking.requested"
  | "booking.approved"
  | "booking.rejected"
  | "booking.cancelled"
  | "ride.created"
  | "ride.updated"
  | "ride.cancelled"
  | "trip.started"
  | "trip.completed";

export type DomainEventEnvelope<TPayload> = Omit<EventEnvelope, "payload" | "eventType"> & {
  eventType: DomainEventType;
  payload: TPayload;
  recipients?: UserId[];
};

export const DomainEventEnvelopeSchema = EventEnvelopeSchema.extend({
  eventType: z.string().min(1),
});

export function makeEnvelope<TPayload>(input: {
  eventId: string;
  eventType: DomainEventType;
  aggregateId: string;
  correlationId?: string;
  occurredAt: string;
  payload: TPayload;
  recipients?: UserId[];
  version?: number;
}): DomainEventEnvelope<TPayload> {
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    aggregateId: input.aggregateId,
    correlationId: input.correlationId,
    occurredAt: input.occurredAt,
    payload: input.payload,
    recipients: input.recipients,
    version: input.version,
  };
}

export function eventTopicForType(eventType: DomainEventType): typeof BOOKING_EVENTS_TOPIC | typeof RIDE_EVENTS_TOPIC | typeof TRIP_EVENTS_TOPIC {
  if (eventType.startsWith("booking.")) return BOOKING_EVENTS_TOPIC;
  if (eventType.startsWith("ride.")) return RIDE_EVENTS_TOPIC;
  return TRIP_EVENTS_TOPIC;
}

export type BookingEvent =
  | DomainEventEnvelope<BookingRequestedPayload>
  | DomainEventEnvelope<BookingApprovedPayload>
  | DomainEventEnvelope<BookingRejectedPayload>
  | DomainEventEnvelope<BookingCancelledPayload>;

export type RideEvent =
  | DomainEventEnvelope<RideCreatedPayload>
  | DomainEventEnvelope<RideUpdatedPayload>
  | DomainEventEnvelope<RideCancelledPayload>;

export type TripEvent = DomainEventEnvelope<TripStartedPayload> | DomainEventEnvelope<TripCompletedPayload>;

export function parseDomainEventEnvelope(input: unknown): EventEnvelope {
  return DomainEventEnvelopeSchema.parse(input);
}

// Small helpers for IDs
export function asBookingId(v: string): BookingId {
  return BookingIdSchema.parse(v);
}
export function asRideId(v: string): RideId {
  return RideIdSchema.parse(v);
}
export function asTripId(v: string): TripId {
  return TripIdSchema.parse(v);
}
export function asUserId(v: string): UserId {
  return UserIdSchema.parse(v);
}
