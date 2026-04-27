export const queryKeys = {
  vehicles: ["vehicles"] as const,
  vehicle: (vehicleId: string) => ["vehicle", vehicleId] as const,
  rides: ["rides"] as const,
  ride: (rideId: string) => ["ride", rideId] as const,
  trips: ["trips"] as const,
  trip: (tripId: string) => ["trip", tripId] as const,
  bookings: ["bookings"] as const,
  notifications: ["notifications"] as const,
  user: (userId: string) => ["user", userId] as const,
  userProfile: (userId: string) => ["userProfile", userId] as const,
  searchRides: (params: Record<string, unknown>) => ["searchRides", params] as const,
  searchRide: (rideId: string) => ["searchRide", rideId] as const,
  seatAvailability: (rideId: string, params: Record<string, unknown>) =>
    ["seatAvailability", rideId, params] as const,
};
