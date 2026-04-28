import { trip } from '@repo/grpc';
import { sendMail } from '@repo/mailer';
import { db, insertOutboxEvent } from '@repo/database';
import { eventTopicForType, makeEnvelope } from '@repo/contracts';
import { tripRepository } from '../db/trip.repository';
import { getUserEmail, updateUserRating } from '../clients/user.client';
import { APP_NAME, MAIL_FROM } from '../env';
import { randomUUID } from 'node:crypto';

function statusFromDb(status: string): trip.TripStatus {
  switch (status) {
    case 'STARTED':
      return trip.TripStatus.STARTED;
    case 'IN_PROGRESS':
      return trip.TripStatus.IN_PROGRESS;
    case 'COMPLETED':
      return trip.TripStatus.COMPLETED;
    case 'CANCELLED':
      return trip.TripStatus.CANCELLED;
    default:
      return trip.TripStatus.SCHEDULED;
  }
}

export const tripService = {
  async startTrip(req: trip.StartTripRequest): Promise<trip.StartTripResponse> {
    const created = await tripRepository.startTrip({ rideId: req.rideId, driverId: req.driverId });

    try {
      const passengerIds = await tripRepository.listTripPassengerIds(created.tripId);
      const participantIds = [req.driverId, ...passengerIds];
      const startedAt = new Date().toISOString();

      // Outbox: trip.started
      try {
        const outboxId = randomUUID();
        const occurredAt = new Date();
        const envelope = makeEnvelope({
          eventId: outboxId,
          eventType: 'trip.started',
          aggregateId: created.tripId,
          occurredAt: occurredAt.toISOString(),
          recipients: participantIds,
          payload: {
            tripId: created.tripId,
            rideId: req.rideId,
            driverId: req.driverId,
            occurredAt: occurredAt.toISOString(),
          },
          version: 1,
        });
        await insertOutboxEvent(db, {
          schema: 'trip_service',
          event: {
            id: outboxId,
            eventType: envelope.eventType,
            aggregateId: envelope.aggregateId,
            occurredAt,
            kafkaTopic: eventTopicForType(envelope.eventType),
            kafkaKey: envelope.aggregateId,
            payload: envelope,
            recipients: envelope.recipients,
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[trip-service] failed to insert outbox event trip.started', err);
      }

      await Promise.allSettled(
        participantIds.map(async (uid) => {
          const toEmail = await getUserEmail(uid);
          if (!toEmail) return;
          await sendMail({
            from: MAIL_FROM,
            to: toEmail,
            templateId: 'trip-started',
            templateVariables: {
              appName: APP_NAME,
              toEmail,
              tripId: created.tripId,
              rideId: req.rideId,
              driverId: req.driverId,
              startedAt,
            },
          });
        }),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[trip-service] failed to enqueue trip-started emails', err);
    }

    return { tripId: created.tripId, status: statusFromDb(created.status) };
  },

  async pickupPassenger(req: trip.PickupPassengerRequest): Promise<trip.PickupPassengerResponse> {
    const success = await tripRepository.markPassengerPickedUp({ tripId: req.tripId, passengerId: req.passengerId });
    if (success) {
      try {
        const toEmail = await getUserEmail(req.passengerId);
        if (toEmail) {
          const pickedAt = new Date().toISOString();
          await sendMail({
            from: MAIL_FROM,
            to: toEmail,
            // template types are fine at runtime; cast to any to avoid cross-package build ordering issues
            templateId: 'trip-pickup' as any,
            templateVariables: {
              appName: APP_NAME,
              toEmail,
              tripId: req.tripId,
              passengerId: req.passengerId,
              pickedAt,
            } as any,
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[trip-service] failed to send pickup email', err);
      }
    }

    return { success };
  },

  async completeTrip(req: trip.CompleteTripRequest): Promise<trip.CompleteTripResponse> {
    const success = await tripRepository.completeTrip({ tripId: req.tripId, driverId: req.driverId });

    if (success) {
      try {
        const participants = await tripRepository.getTripParticipantIds(req.tripId);
        const completedAt = new Date().toISOString();
        const participantIds = [participants.driverId, ...participants.passengerIds];

        // Outbox: trip.completed
        try {
          const outboxId = randomUUID();
          const occurredAt = new Date();
          const envelope = makeEnvelope({
            eventId: outboxId,
            eventType: 'trip.completed',
            aggregateId: req.tripId,
            occurredAt: occurredAt.toISOString(),
            recipients: participantIds,
            payload: {
              tripId: req.tripId,
              rideId: participants.rideId,
              driverId: participants.driverId,
              occurredAt: occurredAt.toISOString(),
            },
            version: 1,
          });
          await insertOutboxEvent(db, {
            schema: 'trip_service',
            event: {
              id: outboxId,
              eventType: envelope.eventType,
              aggregateId: envelope.aggregateId,
              occurredAt,
              kafkaTopic: eventTopicForType(envelope.eventType),
              kafkaKey: envelope.aggregateId,
              payload: envelope,
              recipients: envelope.recipients,
            },
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[trip-service] failed to insert outbox event trip.completed', err);
        }

        await Promise.allSettled(
          participantIds.map(async (uid) => {
            const toEmail = await getUserEmail(uid);
            if (!toEmail) return;
            await sendMail({
              from: MAIL_FROM,
              to: toEmail,
              templateId: 'trip-completed',
              templateVariables: {
                appName: APP_NAME,
                toEmail,
                tripId: req.tripId,
                rideId: participants.rideId,
                driverId: participants.driverId,
                completedAt,
              },
            });
          }),
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[trip-service] failed to enqueue trip-completed emails', err);
      }
    }

    return { success };
  },

  async submitRating(req: any): Promise<any> {
    const { tripId, passengerId, rating } = req;
    // Validate passenger participated in trip
    const participants = await tripRepository.getTripParticipantIds(tripId);
    if (!participants.passengerIds.includes(passengerId)) throw new Error('NOT_A_PARTICIPANT');

    // Prevent duplicate ratings
    const already = await tripRepository.hasRating(tripId, passengerId);
    if (already) throw new Error('ALREADY_RATED');

    // Persist rating
    await tripRepository.insertRating({ tripId, passengerId, driverId: participants.driverId, rating });

    // Update driver's aggregate rating via user service
    try {
      await updateUserRating(participants.driverId, rating);
    } catch (err) {
      // log but don't fail the rating
      // eslint-disable-next-line no-console
      console.error('[trip-service] failed to update driver aggregate rating', err);
    }

    return { success: true };
  },

  async getPassengerTrip(req: any): Promise<any> {
    const res = await tripRepository.getPassengerTripForRide(req.rideId, req.passengerId);
    if (!res) return { tripId: '', status: trip.TripStatus.SCHEDULED, hasRated: false };

    const hasRated = await tripRepository.hasRating(res.tripId, req.passengerId);
    const status = res.status === 'COMPLETED' ? trip.TripStatus.COMPLETED : trip.TripStatus.SCHEDULED;
    return { tripId: res.tripId, status, hasRated };
  },

  async getTrip(req: trip.GetTripRequest): Promise<trip.GetTripResponse> {
    const t = await tripRepository.getTrip(req.tripId);
    const passengerIds = await tripRepository.listTripPassengerIds(req.tripId);
    return {
      tripId: t.id,
      rideId: t.ride_id,
      driverId: t.driver_id,
      passengerIds,
      status: statusFromDb(t.trip_status),
    };
  },

  async listDriverTrips(req: trip.ListDriverTripsRequest): Promise<trip.ListDriverTripsResponse> {
    const trips = await tripRepository.listDriverTrips(req.driverId);
    const mapped = await Promise.all(
      trips.map(async (t) => ({
        tripId: t.id,
        rideId: t.ride_id,
        driverId: t.driver_id,
        passengerIds: await tripRepository.listTripPassengerIds(t.id),
        status: statusFromDb(t.trip_status),
      })),
    );
    return { trips: mapped };
  },
};
