import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { loggingMiddleware } from './middleware/logging.middleware';
import { globalRateLimitMiddleware } from './middleware/rateLimit.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { authRouter } from "./routes/auth.routes";
import { vehicleRouter } from './routes/vehicle.routes';
import { rideRouter } from './routes/ride.routes';
import { searchRouter } from './routes/search.routes';
import { bookingRouter } from './routes/booking.routes';
import { tripRouter } from './routes/trip.routes';
import { notificationRouter } from './routes/notification.routes';
import { userRouter } from './routes/user.routes';

export async function createApp(): Promise<express.Express> {
  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  app.use(requestIdMiddleware);
  app.use(loggingMiddleware);
  app.use(globalRateLimitMiddleware);

  app.use("/api/v1/auth", authRouter);
  app.use('/api/v1/vehicles', vehicleRouter);
  app.use('/api/v1/rides', rideRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/bookings', bookingRouter);
  app.use('/api/v1/trips', tripRouter);
  app.use('/api/v1/notifications', notificationRouter);

  app.use(errorMiddleware);
  return app;
}