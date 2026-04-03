import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "crypto";

/** Hash a string to a fixed-length buffer for timing-safe comparison. */
function hashKey(key: string): Buffer {
  return createHash("sha256").update(key).digest();
}

/**
 * Optional API key authentication.
 * If FREELLM_API_KEY is set, every request must include a matching
 * Authorization: Bearer <key> header. If not set, all requests pass through.
 * Uses timing-safe comparison to prevent side-channel attacks.
 */
export function auth(req: Request, res: Response, next: NextFunction): void {
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

  if (!token || !timingSafeEqual(hashKey(token), hashKey(requiredKey))) {
    res.status(401).json({
      error: {
        message: "Invalid or missing API key. Set Authorization: Bearer <key>.",
        type: "authentication_error",
      },
    });
    return;
  }

  next();
}
