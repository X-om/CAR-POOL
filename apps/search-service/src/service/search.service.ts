import { search } from '@repo/grpc';
import { getUserRating } from '../clients/user.client';
import { searchRepository } from '../db/search.repository';
import { approxDegreeDeltaKm, haversineKm } from '../utils/geo';

function unixToDate(unix: number | bigint): Date {
  const n = typeof unix === 'bigint' ? Number(unix) : unix;
  if (!Number.isFinite(n) || n <= 0) return new Date(0);
  return n > 1_000_000_000_000 ? new Date(n) : new Date(n * 1000);
}

export const searchService = {
  async searchRides(req: search.SearchRidesRequest): Promise<search.SearchRidesResponse> {
    const RADIUS_KM = 5;
    const delta = approxDegreeDeltaKm(RADIUS_KM);

    const departureTimeNum = typeof req.departureTime === 'number' ? req.departureTime : Number(req.departureTime);
    const hasDepartureFilter = Number.isFinite(departureTimeNum) && departureTimeNum > 0;

    const desiredDeparture = unixToDate(req.departureTime);
    const departureMin = hasDepartureFilter
      ? new Date(desiredDeparture.getTime() - 6 * 60 * 60 * 1000)
      : new Date(0);
    const departureMax = hasDepartureFilter
      ? new Date(desiredDeparture.getTime() + 6 * 60 * 60 * 1000)
      : new Date('2100-01-01T00:00:00.000Z');

    const candidateRideIds = await searchRepository.searchRideIdsByStopsBBox({
      departureMin,
      departureMax,

      sourceLatMin: req.sourceLatitude - delta,
      sourceLatMax: req.sourceLatitude + delta,
      sourceLngMin: req.sourceLongitude - delta,
      sourceLngMax: req.sourceLongitude + delta,

      destinationLatMin: req.destinationLatitude - delta,
      destinationLatMax: req.destinationLatitude + delta,
      destinationLngMin: req.destinationLongitude - delta,
      destinationLngMax: req.destinationLongitude + delta,
    });

    const rides: search.RideInfo[] = [];
    for (const rideId of candidateRideIds) {
      const r = await searchRepository.getRide(rideId);
      if (r.ride_status !== 'ACTIVE') continue;

      const stops = await searchRepository.listRideStops(rideId);
      if (stops.length < 2) continue;

      // Find the best (pickup, dropoff) stop pair along the route.
      // We consider multiple pickup candidates to avoid missing matches where the nearest pickup stop
      // cannot produce a valid dropoff (order constraint).
      const pickupCandidates = stops
        .map((s) => ({
          stopOrder: s.stop_order,
          km: haversineKm(
            { lat: req.sourceLatitude, lng: req.sourceLongitude },
            { lat: s.latitude, lng: s.longitude },
          ),
        }))
        .filter((c) => c.km <= RADIUS_KM)
        .sort((a, b) => a.km - b.km);

      let bestPair:
        | { pickupStopOrder: number; dropoffStopOrder: number; scoreKm: number }
        | null = null;

      for (const pickup of pickupCandidates) {
        let bestDropoffForPickup: { stopOrder: number; km: number } | null = null;
        for (const s of stops) {
          if (s.stop_order <= pickup.stopOrder) continue;
          const km = haversineKm(
            { lat: req.destinationLatitude, lng: req.destinationLongitude },
            { lat: s.latitude, lng: s.longitude },
          );
          if (km > RADIUS_KM) continue;
          if (!bestDropoffForPickup || km < bestDropoffForPickup.km) {
            bestDropoffForPickup = { stopOrder: s.stop_order, km };
          }
        }
        if (!bestDropoffForPickup) continue;

        const scoreKm = pickup.km + bestDropoffForPickup.km;
        if (!bestPair || scoreKm < bestPair.scoreKm) {
          bestPair = {
            pickupStopOrder: pickup.stopOrder,
            dropoffStopOrder: bestDropoffForPickup.stopOrder,
            scoreKm,
          };
        }
      }

      if (!bestPair) continue;

      const legStats = await searchRepository.getRideLegStats({
        rideId,
        pickupStopOrder: bestPair.pickupStopOrder,
        dropoffStopOrder: bestPair.dropoffStopOrder,
      });
      if (legStats.legMinAvailableSeats < req.requiredSeats) continue;

      const driverPrice = Number(r.price_per_seat);
      const ratio = legStats.totalKm > 0 ? Math.max(0, Math.min(1, legStats.legKm / legStats.totalKm)) : 1;
      const estimated = Math.max(1, Math.round(driverPrice * ratio));

      rides.push({
        rideId: r.id,
        driverId: r.driver_id,
        vehicleId: r.vehicle_id,
        sourceCity: r.source_city,
        destinationCity: r.destination_city,
        departureTime: r.departure_time.getTime(),
        driverPricePerSeat: driverPrice,
        estimatedPricePerSeat: estimated,
        availableSeats: legStats.legMinAvailableSeats,
        pickupStopOrder: bestPair.pickupStopOrder,
        dropoffStopOrder: bestPair.dropoffStopOrder,
        routeStops: stops.map((s) => ({
          stopOrder: s.stop_order,
          cityName: s.city_name,
          latitude: s.latitude,
          longitude: s.longitude,
        })),
        driverRating: await getUserRating(r.driver_id),
      });
    }

    rides.sort((a, b) => Number(a.departureTime) - Number(b.departureTime));
    return { rides };
  },

  async getRideSearchData(req: search.GetRideSearchDataRequest): Promise<search.GetRideSearchDataResponse> {
    const r = await searchRepository.getRide(req.rideId);
    const stops = await searchRepository.listRideStops(req.rideId);
    return {
      rideId: r.id,
      driverId: r.driver_id,
      vehicleId: r.vehicle_id,
      sourceCity: r.source_city,
      destinationCity: r.destination_city,
      departureTime: r.departure_time.getTime(),
      driverPricePerSeat: Number(r.price_per_seat),
      availableSeats: r.available_seats,
      routeStops: stops.map((s) => ({
        stopOrder: s.stop_order,
        cityName: s.city_name,
        latitude: s.latitude,
        longitude: s.longitude,
      })),
      driverRating: await getUserRating(r.driver_id),
    };
  },
};
