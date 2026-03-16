import { Request, Response, NextFunction } from "express";

export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  console.log(`[${req.requestId}] ${req.method} ${req.originalUrl}`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${req.requestId}] ${res.statusCode} ${duration}ms`)
  })
  next()
}