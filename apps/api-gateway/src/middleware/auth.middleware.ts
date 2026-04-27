import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../env";

function unauthorized(res: Response, requestId?: string) {
  return res.status(401).json({
    success: false,
    data: null,
    error: "Unauthorized",
    code: "UNAUTHORIZED",
    requestId,
  });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, req.requestId);
    }

    const token = authHeader.split(" ")[1];
    if (!token) return unauthorized(res, req.requestId);

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return unauthorized(res, req.requestId);
  }
}
