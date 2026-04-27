import { z } from "zod";
import { UuidSchema, UserIdSchema } from "./ids";

export const IsoDateTimeSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid ISO datetime");

export const EventEnvelopeSchema = z.object({
  eventId: UuidSchema,
  eventType: z.string().min(1),
  occurredAt: IsoDateTimeSchema,
  correlationId: z.string().min(1).optional(),
  aggregateId: z.string().min(1),
  payload: z.unknown(),
  recipients: z.array(UserIdSchema).optional(),
  version: z.number().int().positive().optional(),
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

export function parseEventEnvelope(input: unknown): EventEnvelope {
  return EventEnvelopeSchema.parse(input);
}
