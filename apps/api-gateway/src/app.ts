import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { loggingMiddleware } from './middleware/logging.middleware';
import { globalRateLimitMiddleware } from './middleware/rateLimit.middleware';
import { errorMiddleware } from './middleware/error.middleware';

export async function createApp(): Promise<express.Express> {
  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  app.use(requestIdMiddleware);
  app.use(loggingMiddleware);
  app.use(globalRateLimitMiddleware);

  // routes would be added here

  app.use(errorMiddleware);
  return app;
}