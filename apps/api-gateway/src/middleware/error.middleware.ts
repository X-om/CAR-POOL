import type { NextFunction, Request, Response } from "express";
import { status as grpcStatus } from "@grpc/grpc-js";
import { ZodError } from "zod";

function looksLikeCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_]+$/.test(value);
}

function grpcCodeToHttpStatus(code: number, details: string): number {
  switch (code) {
    case grpcStatus.INVALID_ARGUMENT:
      return 400;
    case grpcStatus.UNAUTHENTICATED:
      return 401;
    case grpcStatus.PERMISSION_DENIED:
      return 403;
    case grpcStatus.NOT_FOUND:
      return 404;
    case grpcStatus.ALREADY_EXISTS:
      return 409;
    case grpcStatus.FAILED_PRECONDITION:
      return 409;
    case grpcStatus.RESOURCE_EXHAUSTED:
      return 429;
    case grpcStatus.UNAVAILABLE:
      return 503;
    case grpcStatus.DEADLINE_EXCEEDED:
      return 504;
    default: {
      if (looksLikeCode(details)) {
        if (details.endsWith("_NOT_FOUND")) return 404;
        if (details === "UNAUTHORIZED" || details === "UNAUTHENTICATED") return 401;
        if (details === "FORBIDDEN" || details === "PERMISSION_DENIED") return 403;
        return 400;
      }
      return 500;
    }
  }
}

export function errorMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  const requestId = req.requestId;

  // eslint-disable-next-line no-console
  console.error(`[${requestId}] Error:`, err);

  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      data: null,
      error: "Invalid request",
      code: "INVALID_REQUEST",
      requestId,
      details: err.issues,
    });
  }

  if (err.message === "UNAUTHORIZED") {
    return res.status(401).json({
      success: false,
      data: null,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      requestId,
    });
  }

  const anyErr = err as unknown as { code?: unknown; details?: unknown };
  if (typeof anyErr.code === "number" && typeof anyErr.details === "string") {
    const details = anyErr.details;
    const statusCode = grpcCodeToHttpStatus(anyErr.code, details);
    const code = looksLikeCode(details) ? details : `GRPC_${anyErr.code}`;
    const message = looksLikeCode(details) ? details : details || "Request failed";

    return res.status(statusCode).json({
      success: false,
      data: null,
      error: message,
      code,
      requestId,
    });
  }

  if (looksLikeCode(err.message)) {
    const code = err.message;
    const statusCode = code.endsWith("_NOT_FOUND") ? 404 : 400;
    return res.status(statusCode).json({
      success: false,
      data: null,
      error: code,
      code,
      requestId,
    });
  }

  return res.status(500).json({
    success: false,
    data: null,
    error: "Internal Server Error",
    code: "INTERNAL_SERVER_ERROR",
    requestId,
  });
}
