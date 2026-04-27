export const PORTS = {
  apiGateway: 3000,
  websocketGateway: 3001,

  userGrpc: 50051,
  vehicleGrpc: 50052,
  rideGrpc: 50053,
  searchGrpc: 50054,
  bookingGrpc: 50055,
  tripGrpc: 50056,
  notificationGrpc: 50057,

  postgres: 5432,
  redis: 6379,
  // Redpanda's host-accessible listener. The 9092 listener advertises `redpanda:9092`
  // which is not resolvable from the host.
  kafka: 19092,
} as const;
