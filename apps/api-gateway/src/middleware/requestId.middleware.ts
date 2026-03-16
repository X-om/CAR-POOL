import { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers["x-request-id"] || uuid();
  req.requestId = requestId
  res.setHeader("x-request-id", requestId)
  next();
}