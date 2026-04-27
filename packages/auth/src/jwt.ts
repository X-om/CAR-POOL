import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { z } from "zod";

export const AccessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(1),
});

export type AccessTokenClaims = z.infer<typeof AccessTokenClaimsSchema>;

export type VerifiedAccessToken = {
  raw: string;
  claims: AccessTokenClaims;
  issuedAt?: number;
  expiresAt?: number;
};

export function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  options: SignOptions = { expiresIn: "15m" },
): string {
  return jwt.sign(claims, secret, { algorithm: "HS256", ...options });
}

export function verifyAccessToken(token: string, secret: string): VerifiedAccessToken {
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

  const payload: JwtPayload = typeof decoded === "string" ? { sub: decoded } : (decoded as JwtPayload);

  const parsed = AccessTokenClaimsSchema.parse({
    sub: payload.sub,
    email: payload.email,
    phoneNumber: payload.phoneNumber,
  });

  return {
    raw: token,
    claims: parsed,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };
}

// Internal service-to-service auth (JWT in gRPC metadata)

export const InternalServiceClaimsSchema = z.object({
  svc: z.string().min(1),
});

export type InternalServiceClaims = z.infer<typeof InternalServiceClaimsSchema>;

export type VerifiedInternalServiceToken = {
  raw: string;
  claims: InternalServiceClaims;
  issuedAt?: number;
  expiresAt?: number;
};

export function signInternalServiceToken(
  claims: InternalServiceClaims,
  secret: string,
  options: SignOptions = { expiresIn: "5m" },
): string {
  return jwt.sign(claims, secret, { algorithm: "HS256", ...options });
}

export function verifyInternalServiceToken(token: string, secret: string): VerifiedInternalServiceToken {
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  const payload: JwtPayload = typeof decoded === "string" ? { sub: decoded } : (decoded as JwtPayload);

  const parsed = InternalServiceClaimsSchema.parse({
    svc: payload.svc,
  });

  return {
    raw: token,
    claims: parsed,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };
}
