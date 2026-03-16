import { NextFunction, Request, Response } from 'express';
import { z } from "zod";

export async function validate(bodySchema: z.ZodSchema, querySchema?: z.ZodSchema, paramsSchema?: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = bodySchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: result.error.issues.map(issue => issue.message).join(", ") });

    if (querySchema) {
      const queryResult = querySchema.safeParse(req.query);
      if (!queryResult.success)
        return res.status(400).json({ error: queryResult.error.issues.map(issue => issue.message).join(", ") });
    }

    if (paramsSchema) {
      const paramsResult = paramsSchema.safeParse(req.params);
      if (!paramsResult.success)
        return res.status(400).json({ error: paramsResult.error.issues.map(issue => issue.message).join(", ") });
    }

    req.body = result.data;
    next();
  }
} 