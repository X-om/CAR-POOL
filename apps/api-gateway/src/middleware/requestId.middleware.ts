import { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const fromHeader = req.header("x-request-id");
  const requestId = typeof fromHeader === "string" && fromHeader.length > 0 ? fromHeader : uuid();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}