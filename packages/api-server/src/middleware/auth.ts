import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { freellmError } from "../errors/index.js";

/** Hash a string to a fixed-length buffer for timing-safe comparison. */
function hashKey(key: string): Buffer {
  return createHash("sha256").update(key).digest();
}

/**
 * Optional API key authentication.
 * If FREELLM_API_KEY is set, every request must include a matching
 * Authorization: Bearer <key> header. If not set, all requests pass through.
 * Uses timing-safe comparison to prevent side-channel attacks.
 *
 * Errors are delegated to the central error handler via next(err) so the
 * response body shape stays consistent with every other 4xx/5xx.
 */
export function auth(req: Request, _res: Response, next: NextFunction): void {
  const requiredKey = process.env["FREELLM_API_KEY"];

  if (!requiredKey) {
    next();
    return;
  }

  // Allow health check through without auth (used by Docker HEALTHCHECK, load balancers)
  if (req.path === "/healthz" || req.path === "/api/healthz") {
    next();
    return;
  }

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    next(
      freellmError({
        code: "missing_api_key",
        message: "Missing API key. Set Authorization: Bearer <key>.",
      }),
    );
    return;
  }

  if (!timingSafeEqual(hashKey(token), hashKey(requiredKey))) {
    next(
      freellmError({
        code: "invalid_api_key",
        message: "Invalid API key.",
      }),
    );
    return;
  }

  next();
}
