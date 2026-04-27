import type { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userId?: string;
      user?: string | JwtPayload;
    }
  }
}

export { };
