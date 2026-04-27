export type RouteStop = {
  stopOrder: number;
  cityName: string;
  latitude: number;
  longitude: number;
};

export type RideSearchResult = {
  rideId: string;
  driverId: string;
  vehicleId: string;
  sourceCity: string;
  destinationCity: string;
  departureTime: number;
  driverPricePerSeat: number;
  estimatedPricePerSeat: number;
  availableSeats: number;
  pickupStopOrder: number;
  dropoffStopOrder: number;
  routeStops: RouteStop[];
  driverRating: number;
};

export type RideSearchDetail = {
  rideId: string;
  driverId: string;
  vehicleId: string;
  sourceCity: string;
  destinationCity: string;
  departureTime: number;
  driverPricePerSeat: number;
  availableSeats: number;
  routeStops: RouteStop[];
  driverRating: number;
};

export type Ride = {
  rideId: string;
  driverId: string;
  vehicleId: string;
  sourceCity: string;
  destinationCity: string;
  departureTime: number;
  pricePerSeat: number;
  approvalMode?: number;
  stops: RouteStop[];
  rideStatus?: string;
};

export type Vehicle = {
  vehicleId: string;
  ownerId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  seatCapacity: number;
};

export type User = {
  userId: string;
  phoneNumber: string;
  email: string;
  isVerified: boolean;
  isDriver: boolean;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
};

export type UserProfile = {
  userId: string;
  name: string;
  profilePictureUrl: string;
  bio: string;
  city: string;
};

export type UserRatingSummary = {
  averageRating: number;
  totalRatings: number;
};

export type Booking = {
  bookingId: string;
  rideId: string;
  passengerId: string;
  seatCount: number;
  status: number;
  pickupStopOrder?: number;
  dropoffStopOrder?: number;
};

export type NotificationItem = {
  notificationId: string;
  userId: string;
  message: string;
  timestamp: number;
  isRead: boolean;

  type?: string;
  title?: string;
  topic?: string;
  eventType?: string;
  aggregateId?: string;
  occurredAt?: string;
  payloadJson?: string;
};

export type Trip = {
  tripId: string;
  rideId: string;
  driverId: string;
  passengerIds: string[];
  status: number;
};
