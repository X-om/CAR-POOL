import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export function validate(
  bodySchema: z.ZodSchema,
  querySchema?: z.ZodSchema,
  paramsSchema?: z.ZodSchema
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues.map((issue) => issue.message).join(", "),
        code: "INVALID_REQUEST",
        requestId: req.requestId,
        details: result.error.issues,
      });
    }

    if (querySchema) {
      const queryResult = querySchema.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({
          success: false,
          data: null,
          error: queryResult.error.issues.map((issue) => issue.message).join(", "),
          code: "INVALID_REQUEST",
          requestId: req.requestId,
          details: queryResult.error.issues,
        });
      }
    }

    if (paramsSchema) {
      const paramsResult = paramsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(400).json({
          success: false,
          data: null,
          error: paramsResult.error.issues.map((issue) => issue.message).join(", "),
          code: "INVALID_REQUEST",
          requestId: req.requestId,
          details: paramsResult.error.issues,
        });
      }
    }

    req.body = result.data;
    return next();
  };
}
