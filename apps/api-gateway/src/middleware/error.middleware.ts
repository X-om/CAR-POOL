import { NextFunction, Request, Response } from "express";

export function errorMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(`[${req.requestId}] Error:`, err);
  res.status(500).json({ success: false, error: "Internal Server Error", requestId: req.requestId })
}