# Car Pool Project Overview

## 1. What this project is

This repository is a ride-sharing and car-pool platform built as a monorepo. It covers the full flow from authentication and profile setup to ride publishing, ride search, booking, trip tracking, notifications, and realtime updates.

The product is split into a web app for users and a set of backend services that handle domain logic. The web app is the main user-facing client, while the backend is organized into small services that each own one part of the system.

## 2. Tech stack

- Monorepo tooling: pnpm workspaces + Turbo
- Frontend: Next.js 16.2, React 19.2, App Router
- Styling/UI: Tailwind CSS 4, local shadcn-style UI components, @base-ui/react, Sonner, Lucide icons
- Frontend data and forms: TanStack Query 5, React Hook Form 7, Zod
- Maps: Mapbox GL + react-map-gl
- Auth on the web: JWT session storage plus optional Firebase support
- API layer: Express 5 in the API gateway
- Service-to-service transport: gRPC via @grpc/grpc-js and shared proto code in @repo/grpc
- Shared validation/contracts: @repo/contracts and zod
- Messaging and async work: Kafka via Redpanda, outbox publisher, reminder worker, mailer worker
- Realtime updates: WebSocket gateway backed by Redis pub/sub
- Persistence and infra: PostgreSQL, Redis, Docker Compose
- Language/tooling: TypeScript across the repo

Shared internal packages are used to keep behavior consistent across apps, especially auth helpers, gRPC definitions, Redis helpers, Kafka helpers, and TypeScript config presets.

## 3. How the services talk to each other and how they are connected

The backend is centered around the API gateway at port 3000. The browser talks to the web app at port 3002, and the web app calls the API gateway over HTTP REST using the `/api/v1/*` routes. The gateway applies request ID, logging, rate limiting, CORS, and error mapping before forwarding requests to backend services.

For synchronous internal calls, the API gateway uses gRPC clients to reach the domain services:

- `user-service` on `50051`
- `vehicle-service` on `50052`
- `ride-service` on `50053`
- `search-service` on `50054`
- `booking-service` on `50055`
- `trip-service` on `50056`
- `notification-service` on `50057`

The services themselves also call each other over gRPC when they need another domain to verify or enrich data. For example, booking and trip flows depend on user and ride data, so those services use internal gRPC metadata and an internal JWT secret to authenticate service-to-service requests.

For async and event-driven work, the services publish domain events to Kafka through Redpanda. The `outbox-publisher` service reads outbox records and pushes them to Kafka topics. The `notification-service` consumes those events, stores notification data, and exposes notification APIs. The `webSocket-gateway` listens to Redis-backed realtime channels and pushes live events to connected clients.

Infra-wise, Docker Compose wires everything together:

- PostgreSQL is the shared database
- Redis backs rate limiting and realtime pub/sub
- Redpanda acts as the Kafka broker
- Each service gets its own port and internal host name on the Docker network
- The API gateway depends on the domain services and Redis
- The WebSocket gateway depends on Redis

## 4. How user flow happens in the project

The user experience starts in the web app at port 3002. A new user signs in or registers through the public auth routes, then verifies their account with OTP and verification screens. After that, authenticated routes become available.

Typical passenger flow:

1. Search rides in the passenger search screen.
2. Open a ride detail page.
3. Create a booking request.
4. Watch booking status changes and notifications update in realtime.
5. View past and current bookings from the bookings screen.

Typical driver flow:

1. Add and manage vehicles.
2. Publish a new ride or edit an existing one.
3. Review booking requests for that ride.
4. Approve or reject requests.
5. Start and complete trips, then submit ratings.
6. Track driver trips and ride history.

Cross-cutting flow:

- The web app uses React Query for server state and invalidates cached data when events arrive.
- The API client automatically attaches the bearer token when a route requires authentication.
- If the backend says verification is required, the client redirects the user to `/verify`.
- Realtime booking, ride, and trip events arrive through the WebSocket gateway and update the UI, including notification toasts and query refreshes.

In short: users interact with the Next.js app, the app calls the API gateway, the gateway fans out to gRPC services, those services persist data and emit events, and the web app gets realtime updates back through WebSocket and Redis.