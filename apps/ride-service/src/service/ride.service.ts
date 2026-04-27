import { ride } from '@repo/grpc';
import { sendMail } from '@repo/mailer';
import { db, insertOutboxEvent } from '@repo/database';
import { eventTopicForType, makeEnvelope } from '@repo/contracts';
import { rideRepository } from '../db/ride.repository';
import { getUserEmail } from '../clients/user.client';
import { APP_NAME, MAIL_FROM } from '../env';
import { randomUUID } from 'node:crypto';

function approvalModeFromDb(mode: string | null): ride.BookingApprovalMode {
  return mode === 'MANUAL'
    ? ride.BookingApprovalMode.BOOKING_APPROVAL_MODE_MANUAL
    : ride.BookingApprovalMode.BOOKING_APPROVAL_MODE_AUTO;
}

export const rideService = {
  async createRide(req: ride.CreateRideRequest): Promise<ride.CreateRideResponse> {
    const rideId = await rideRepository.createRide({
      driverId: req.driverId,
      vehicleId: req.vehicleId,
      sourceCity: req.sourceCity,
      destinationCity: req.destinationCity,
      departureTime: req.departureTime,
      pricePerSeat: req.pricePerSeat,
      stops: req.stops,
      approvalMode: req.approvalMode,
    });

    // Outbox: ride.created
    try {
      const outboxId = randomUUID();
      const occurredAt = new Date();
      const envelope = makeEnvelope({
        eventId: outboxId,
        eventType: 'ride.created',
        aggregateId: rideId,
        occurredAt: occurredAt.toISOString(),
        recipients: [req.driverId],
        payload: {
          rideId,
          driverId: req.driverId,
          occurredAt: occurredAt.toISOString(),
        },
        version: 1,
      });
      await insertOutboxEvent(db, {
        schema: 'ride_service',
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
      console.error('[ride-service] failed to insert outbox event ride.created', err);
    }

    try {
      const driverEmail = await getUserEmail(req.driverId);
      if (driverEmail) {
        await sendMail({
          from: MAIL_FROM,
          to: driverEmail,
          templateId: 'ride-created',
          templateVariables: {
            appName: APP_NAME,
            driverEmail,
            rideId,
            sourceCity: req.sourceCity || undefined,
            destinationCity: req.destinationCity || undefined,
            departureTime: req.departureTime ? new Date(Number(req.departureTime)).toISOString() : undefined,
          },
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ride-service] failed to enqueue ride-created email', err);
    }

    return { rideId };
  },

  async updateRide(req: ride.UpdateRideRequest): Promise<ride.UpdateRideResponse> {
    const success = await rideRepository.updateRide({
      rideId: req.rideId,
      driverId: req.driverId,
      vehicleId: req.vehicleId,
      sourceCity: req.sourceCity,
      destinationCity: req.destinationCity,
      departureTime: req.departureTime,
      pricePerSeat: req.pricePerSeat,
      stops: req.stops,
      approvalMode: req.approvalMode,
    });

    if (success) {
      try {
        const passengerIds = await rideRepository.listRideBookingPassengerIds(req.rideId);

        // Outbox: ride.updated
        try {
          const outboxId = randomUUID();
          const occurredAt = new Date();
          const envelope = makeEnvelope({
            eventId: outboxId,
            eventType: 'ride.updated',
            aggregateId: req.rideId,
            occurredAt: occurredAt.toISOString(),
            recipients: passengerIds,
            payload: {
              rideId: req.rideId,
              driverId: req.driverId,
              occurredAt: occurredAt.toISOString(),
              changeSummary: 'Ride details updated',
            },
            version: 1,
          });
          await insertOutboxEvent(db, {
            schema: 'ride_service',
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
          console.error('[ride-service] failed to insert outbox event ride.updated', err);
        }

        await Promise.allSettled(
          passengerIds.map(async (passengerId) => {
            const passengerEmail = await getUserEmail(passengerId);
            if (!passengerEmail) return;
            await sendMail({
              from: MAIL_FROM,
              to: passengerEmail,
              templateId: 'ride-updated',
              templateVariables: {
                appName: APP_NAME,
                passengerEmail,
                rideId: req.rideId,
                sourceCity: req.sourceCity || undefined,
                destinationCity: req.destinationCity || undefined,
                departureTime: req.departureTime ? new Date(Number(req.departureTime)).toISOString() : undefined,
                changeSummary: 'Ride details updated',
              },
            });
          }),
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ride-service] failed to enqueue ride-updated emails', err);
      }
    }

    return { success };
  },

  async cancelRide(req: ride.CancelRideRequest): Promise<ride.CancelRideResponse> {
    const success = await rideRepository.cancelRide({ rideId: req.rideId, driverId: req.driverId });

    if (success) {
      try {
        const passengerIds = await rideRepository.listRideBookingPassengerIds(req.rideId);

        // Outbox: ride.cancelled
        try {
          const outboxId = randomUUID();
          const occurredAt = new Date();
          const envelope = makeEnvelope({
            eventId: outboxId,
            eventType: 'ride.cancelled',
            aggregateId: req.rideId,
            occurredAt: occurredAt.toISOString(),
            recipients: passengerIds,
            payload: {
              rideId: req.rideId,
              driverId: req.driverId,
              occurredAt: occurredAt.toISOString(),
            },
            version: 1,
          });
          await insertOutboxEvent(db, {
            schema: 'ride_service',
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
          console.error('[ride-service] failed to insert outbox event ride.cancelled', err);
        }

        await Promise.allSettled(
          passengerIds.map(async (passengerId) => {
            const passengerEmail = await getUserEmail(passengerId);
            if (!passengerEmail) return;
            await sendMail({
              from: MAIL_FROM,
              to: passengerEmail,
              templateId: 'ride-cancelled',
              templateVariables: {
                appName: APP_NAME,
                passengerEmail,
                rideId: req.rideId,
              },
            });
          }),
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ride-service] failed to enqueue ride-cancelled emails', err);
      }
    }

    return { success };
  },

  async getRide(req: ride.GetRideRequest): Promise<ride.GetRideResponse> {
    const r = await rideRepository.getRide(req.rideId);
    const stops = await rideRepository.listStops(req.rideId);
    return {
      rideId: r.id,
      driverId: r.driver_id,
      vehicleId: r.vehicle_id,
      sourceCity: r.source_city,
      destinationCity: r.destination_city,
      departureTime: r.departure_time.getTime(),
      pricePerSeat: Number(r.price_per_seat),
      stops: stops.map((s) => ({
        stopOrder: s.stop_order,
        cityName: s.city_name,
        latitude: s.latitude,
        longitude: s.longitude,
      })),
      approvalMode: approvalModeFromDb(r.approval_mode),
      rideStatus: r.ride_status ?? 'ACTIVE',
    };
  },

  async listDriverRides(req: ride.ListDriverRidesRequest): Promise<ride.ListDriverRidesResponse> {
    const rides = await rideRepository.listDriverRides(req.driverId);
    const ridesWithStops = await Promise.all(
      rides.map(async (r) => {
        const stops = await rideRepository.listStops(r.id);
        return {
          rideId: r.id,
          driverId: r.driver_id,
          vehicleId: r.vehicle_id,
          sourceCity: r.source_city,
          destinationCity: r.destination_city,
          departureTime: r.departure_time.getTime(),
          pricePerSeat: Number(r.price_per_seat),
          stops: stops.map((s) => ({
            stopOrder: s.stop_order,
            cityName: s.city_name,
            latitude: s.latitude,
            longitude: s.longitude,
          })),
          approvalMode: approvalModeFromDb(r.approval_mode),
          rideStatus: r.ride_status ?? 'ACTIVE',
        };
      }),
    );
    return { rides: ridesWithStops };
  },

  async checkSeatAvailability(req: ride.CheckSeatAvailabilityRequest): Promise<ride.CheckSeatAvailabilityResponse> {
    if (req.pickupStopOrder != null && req.dropoffStopOrder != null) {
      const { availableSeats, isAvailable } = await rideRepository.getLegAvailableSeats({
        rideId: req.rideId,
        requestedSeats: req.requestedSeats,
        pickupStopOrder: req.pickupStopOrder,
        dropoffStopOrder: req.dropoffStopOrder,
      });
      return { availableSeats, isAvailable };
    }

    const availableSeats = await rideRepository.getAvailableSeats(req.rideId);
    return { availableSeats, isAvailable: availableSeats >= req.requestedSeats };
  },

  async reserveSeats(req: ride.ReserveSeatsRequest): Promise<ride.ReserveSeatsResponse> {
    const success = await rideRepository.reserveSeats({
      rideId: req.rideId,
      seatCount: req.seatCount,
      pickupStopOrder: req.pickupStopOrder ?? undefined,
      dropoffStopOrder: req.dropoffStopOrder ?? undefined,
    });
    return { success };
  },

  async releaseSeats(req: ride.ReleaseSeatsRequest): Promise<ride.ReleaseSeatsResponse> {
    const success = await rideRepository.releaseSeats({
      rideId: req.rideId,
      seatCount: req.seatCount,
      pickupStopOrder: req.pickupStopOrder ?? undefined,
      dropoffStopOrder: req.dropoffStopOrder ?? undefined,
    });
    return { success };
  },
};
