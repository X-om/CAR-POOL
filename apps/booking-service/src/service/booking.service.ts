import { booking } from '@repo/grpc';
import { sendMail } from '@repo/mailer';
import { db, insertOutboxEvent } from '@repo/database';
import { eventTopicForType, makeEnvelope } from '@repo/contracts';
import { bookingRepository } from '../db/booking.repository';
import { releaseSeats, reserveSeats } from '../clients/ride.client';
import { getUserEmail } from '../clients/user.client';
import { APP_NAME, MAIL_FROM } from '../env';
import { randomUUID } from 'node:crypto';

function statusFromDb(status: string): booking.BookingStatus {
  switch (status) {
    case 'PENDING':
      return booking.BookingStatus.PENDING;
    case 'CONFIRMED':
      return booking.BookingStatus.CONFIRMED;
    case 'COMPLETED':
      return booking.BookingStatus.COMPLETED;
    default:
      return booking.BookingStatus.CANCELLED;
  }
}

export const bookingService = {
  async createBooking(req: booking.CreateBookingRequest): Promise<booking.CreateBookingResponse> {
    if (req.seatCount <= 0) throw new Error('INVALID_SEAT_COUNT');

    const pickupStopOrder = req.pickupStopOrder ?? undefined;
    const dropoffStopOrder = req.dropoffStopOrder ?? undefined;
    const hasLeg = pickupStopOrder != null || dropoffStopOrder != null;
    if (hasLeg && (pickupStopOrder == null || dropoffStopOrder == null)) throw new Error('INVALID_ROUTE_LEG');
    if (hasLeg) {
      if (!(pickupStopOrder! < dropoffStopOrder!)) throw new Error('INVALID_ROUTE_LEG');
      const stopOrders = await bookingRepository.listRideStopOrders(req.rideId);
      if (!stopOrders.includes(pickupStopOrder!)) throw new Error('INVALID_PICKUP_STOP');
      if (!stopOrders.includes(dropoffStopOrder!)) throw new Error('INVALID_DROPOFF_STOP');
    }

    const ride = await bookingRepository.getRideForBooking(req.rideId);
    const approvalMode = ride.approval_mode === 'MANUAL' ? 'MANUAL' : 'AUTO';
    const initialStatus = approvalMode === 'MANUAL' ? 'PENDING' : 'CONFIRMED';

    const reserved = await reserveSeats({
      rideId: req.rideId,
      seatCount: req.seatCount,
      pickupStopOrder,
      dropoffStopOrder,
    });
    if (!reserved) throw new Error('INSUFFICIENT_SEATS');

    try {
      const bookingId = await bookingRepository.createBooking({
        rideId: req.rideId,
        passengerId: req.passengerId,
        seatCount: req.seatCount,
        status: initialStatus,
        pickupStopOrder,
        dropoffStopOrder,
      });

      // Outbox: booking.requested
      try {
        const outboxId = randomUUID();
        const occurredAt = new Date();
        const envelope = makeEnvelope({
          eventId: outboxId,
          eventType: 'booking.requested',
          aggregateId: bookingId,
          occurredAt: occurredAt.toISOString(),
          recipients: [ride.driver_id],
          payload: {
            bookingId,
            rideId: req.rideId,
            passengerId: req.passengerId,
            driverId: ride.driver_id,
            seatCount: req.seatCount,
          },
          version: 1,
        });
        await insertOutboxEvent(db, {
          schema: 'booking_service',
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
        console.error('[booking-service] failed to insert outbox event booking.requested', err);
      }

      // Notify driver about request
      try {
        const driverEmail = await getUserEmail(ride.driver_id);
        if (driverEmail) {
          await sendMail({
            from: MAIL_FROM,
            to: driverEmail,
            templateId: 'booking-requested',
            templateVariables: {
              appName: APP_NAME,
              driverEmail,
              bookingId,
              rideId: req.rideId,
              passengerId: req.passengerId,
              seatCount: req.seatCount,
              sourceCity: ride.source_city ?? undefined,
              destinationCity: ride.destination_city ?? undefined,
              departureTime: ride.departure_time ? ride.departure_time.toISOString() : undefined,
            },
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[booking-service] failed to enqueue booking-requested email', err);
      }

      // If auto-approved, notify passenger immediately
      if (initialStatus === 'CONFIRMED') {
        try {
          const passengerEmail = await getUserEmail(req.passengerId);
          if (passengerEmail) {
            await sendMail({
              from: MAIL_FROM,
              to: passengerEmail,
              templateId: 'booking-approved',
              templateVariables: {
                appName: APP_NAME,
                passengerEmail,
                bookingId,
                rideId: req.rideId,
                driverId: ride.driver_id,
                seatCount: req.seatCount,
                sourceCity: ride.source_city ?? undefined,
                destinationCity: ride.destination_city ?? undefined,
                departureTime: ride.departure_time ? ride.departure_time.toISOString() : undefined,
              },
            });

            // Outbox: booking.approved
            try {
              const outboxId = randomUUID();
              const occurredAt = new Date();
              const envelope = makeEnvelope({
                eventId: outboxId,
                eventType: 'booking.approved',
                aggregateId: bookingId,
                occurredAt: occurredAt.toISOString(),
                recipients: [req.passengerId],
                payload: {
                  bookingId,
                  rideId: req.rideId,
                  passengerId: req.passengerId,
                  driverId: ride.driver_id,
                  seatCount: req.seatCount,
                  pickupStopOrder: pickupStopOrder ?? null,
                  dropoffStopOrder: dropoffStopOrder ?? null,
                },
                version: 1,
              });
              await insertOutboxEvent(db, {
                schema: 'booking_service',
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
              console.error('[booking-service] failed to insert outbox event booking.approved', err);
            }

          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[booking-service] failed to enqueue booking-approved email', err);
        }
      }

      return { bookingId, status: statusFromDb(initialStatus) };
    } catch (err) {
      await releaseSeats({
        rideId: req.rideId,
        seatCount: req.seatCount,
        pickupStopOrder,
        dropoffStopOrder,
      });
      throw err;
    }
  },

  async cancelBooking(req: booking.CancelBookingRequest): Promise<booking.CancelBookingResponse> {
    const b = await bookingRepository.getBooking(req.bookingId);
    if (b.passenger_id !== req.passengerId) throw new Error('UNAUTHORIZED');

    const success = await bookingRepository.updateBookingStatus({ bookingId: req.bookingId, nextStatus: 'CANCELLED' });
    if (success) {
      await releaseSeats({
        rideId: b.ride_id,
        seatCount: b.seat_count,
        pickupStopOrder: b.pickup_stop_order ?? undefined,
        dropoffStopOrder: b.dropoff_stop_order ?? undefined,
      });

      // Outbox: booking.cancelled
      try {
        const ride = await bookingRepository.getRideForBooking(b.ride_id);
        const outboxId = randomUUID();
        const occurredAt = new Date();
        const envelope = makeEnvelope({
          eventId: outboxId,
          eventType: 'booking.cancelled',
          aggregateId: b.id,
          occurredAt: occurredAt.toISOString(),
          recipients: [ride.driver_id, b.passenger_id],
          payload: {
            bookingId: b.id,
            rideId: b.ride_id,
            passengerId: b.passenger_id,
            driverId: ride.driver_id,
            seatCount: b.seat_count,
            cancelledByUserId: req.passengerId,
            pickupStopOrder: b.pickup_stop_order ?? null,
            dropoffStopOrder: b.dropoff_stop_order ?? null,
          },
          version: 1,
        });
        await insertOutboxEvent(db, {
          schema: 'booking_service',
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
        console.error('[booking-service] failed to insert outbox event booking.cancelled', err);
      }

      // Notify driver that passenger cancelled
      try {
        const ride = await bookingRepository.getRideForBooking(b.ride_id);
        const driverEmail = await getUserEmail(ride.driver_id);
        if (driverEmail) {
          await sendMail({
            from: MAIL_FROM,
            to: driverEmail,
            templateId: 'booking-cancelled',
            templateVariables: {
              appName: APP_NAME,
              toEmail: driverEmail,
              bookingId: b.id,
              rideId: b.ride_id,
              cancelledByUserId: req.passengerId,
              seatCount: b.seat_count,
              sourceCity: ride.source_city ?? undefined,
              destinationCity: ride.destination_city ?? undefined,
              departureTime: ride.departure_time ? ride.departure_time.toISOString() : undefined,
            },
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[booking-service] failed to enqueue booking-cancelled email', err);
      }
    }
    return { success };
  },

  async approveBooking(req: booking.ApproveBookingRequest): Promise<booking.ApproveBookingResponse> {
    const ctx = await bookingRepository.getBookingWithRide(req.bookingId);
    if (ctx.driver_id !== req.driverId) throw new Error('UNAUTHORIZED');

    const success = await bookingRepository.updateBookingStatus({ bookingId: req.bookingId, nextStatus: 'CONFIRMED' });
    if (!success) throw new Error('INVALID_STATE');

    // Outbox: booking.approved
    try {
      const outboxId = randomUUID();
      const occurredAt = new Date();
      const envelope = makeEnvelope({
        eventId: outboxId,
        eventType: 'booking.approved',
        aggregateId: ctx.id,
        occurredAt: occurredAt.toISOString(),
        recipients: [ctx.passenger_id],
        payload: {
          bookingId: ctx.id,
          rideId: ctx.ride_id,
          passengerId: ctx.passenger_id,
          driverId: ctx.driver_id,
          seatCount: ctx.seat_count,
          pickupStopOrder: ctx.pickup_stop_order ?? null,
          dropoffStopOrder: ctx.dropoff_stop_order ?? null,
        },
        version: 1,
      });
      await insertOutboxEvent(db, {
        schema: 'booking_service',
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
      console.error('[booking-service] failed to insert outbox event booking.approved', err);
    }

    try {
      const passengerEmail = await getUserEmail(ctx.passenger_id);
      if (passengerEmail) {
        await sendMail({
          from: MAIL_FROM,
          to: passengerEmail,
          templateId: 'booking-approved',
          templateVariables: {
            appName: APP_NAME,
            passengerEmail,
            bookingId: ctx.id,
            rideId: ctx.ride_id,
            driverId: ctx.driver_id,
            seatCount: ctx.seat_count,
            sourceCity: ctx.source_city ?? undefined,
            destinationCity: ctx.destination_city ?? undefined,
            departureTime: ctx.departure_time ? ctx.departure_time.toISOString() : undefined,
          },
        });

      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[booking-service] failed to enqueue booking-approved email', err);
    }

    return { status: booking.BookingStatus.CONFIRMED };
  },

  async rejectBooking(req: booking.RejectBookingRequest): Promise<booking.RejectBookingResponse> {
    const ctx = await bookingRepository.getBookingWithRide(req.bookingId);
    if (ctx.driver_id !== req.driverId) throw new Error('UNAUTHORIZED');

    const success = await bookingRepository.updateBookingStatus({ bookingId: req.bookingId, nextStatus: 'CANCELLED' });
    if (!success) throw new Error('INVALID_STATE');

    await releaseSeats({
      rideId: ctx.ride_id,
      seatCount: ctx.seat_count,
      pickupStopOrder: ctx.pickup_stop_order ?? undefined,
      dropoffStopOrder: ctx.dropoff_stop_order ?? undefined,
    });

    // Outbox: booking.rejected
    try {
      const outboxId = randomUUID();
      const occurredAt = new Date();
      const envelope = makeEnvelope({
        eventId: outboxId,
        eventType: 'booking.rejected',
        aggregateId: ctx.id,
        occurredAt: occurredAt.toISOString(),
        recipients: [ctx.passenger_id],
        payload: {
          bookingId: ctx.id,
          rideId: ctx.ride_id,
          passengerId: ctx.passenger_id,
          driverId: ctx.driver_id,
          seatCount: ctx.seat_count,
          reason: 'REJECTED',
          pickupStopOrder: ctx.pickup_stop_order ?? null,
          dropoffStopOrder: ctx.dropoff_stop_order ?? null,
        },
        version: 1,
      });
      await insertOutboxEvent(db, {
        schema: 'booking_service',
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
      console.error('[booking-service] failed to insert outbox event booking.rejected', err);
    }

    try {
      const passengerEmail = await getUserEmail(ctx.passenger_id);
      if (passengerEmail) {
        await sendMail({
          from: MAIL_FROM,
          to: passengerEmail,
          templateId: 'booking-rejected',
          templateVariables: {
            appName: APP_NAME,
            passengerEmail,
            bookingId: ctx.id,
            rideId: ctx.ride_id,
            driverId: ctx.driver_id,
            seatCount: ctx.seat_count,
            sourceCity: ctx.source_city ?? undefined,
            destinationCity: ctx.destination_city ?? undefined,
            departureTime: ctx.departure_time ? ctx.departure_time.toISOString() : undefined,
          },
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[booking-service] failed to enqueue booking-rejected email', err);
    }

    return { status: booking.BookingStatus.CANCELLED };
  },

  async getBooking(req: booking.GetBookingRequest): Promise<booking.GetBookingResponse> {
    const b = await bookingRepository.getBooking(req.bookingId);
    return {
      bookingId: b.id,
      rideId: b.ride_id,
      passengerId: b.passenger_id,
      seatCount: b.seat_count,
      status: statusFromDb(b.booking_status),
      pickupStopOrder: b.pickup_stop_order ?? undefined,
      dropoffStopOrder: b.dropoff_stop_order ?? undefined,
    };
  },

  async listUserBookings(req: booking.ListUserBookingsRequest): Promise<booking.ListUserBookingsResponse> {
    const rows = await bookingRepository.listUserBookings(req.passengerId);
    return {
      bookings: rows.map((b) => ({
        bookingId: b.id,
        rideId: b.ride_id,
        passengerId: b.passenger_id,
        seatCount: b.seat_count,
        status: statusFromDb(b.booking_status),
        pickupStopOrder: b.pickup_stop_order ?? undefined,
        dropoffStopOrder: b.dropoff_stop_order ?? undefined,
      })),
    };
  },

  async listDriverBookings(req: booking.ListDriverBookingsRequest): Promise<booking.ListDriverBookingsResponse> {
    const rows = await bookingRepository.listDriverBookings(req.driverId);
    return {
      bookings: rows.map((b) => ({
        bookingId: b.id,
        rideId: b.ride_id,
        passengerId: b.passenger_id,
        seatCount: b.seat_count,
        status: statusFromDb(b.booking_status),
        pickupStopOrder: b.pickup_stop_order ?? undefined,
        dropoffStopOrder: b.dropoff_stop_order ?? undefined,
      })),
    };
  },
};
