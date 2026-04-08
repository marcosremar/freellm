import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { freellmError } from "../errors/index.js";
import { getVirtualKeyStore } from "../gateway/virtual-keys-singleton.js";
import type { VirtualKey } from "../gateway/virtual-keys.js";

/** Hash a string to a fixed-length buffer for timing-safe comparison. */
function hashKey(key: string): Buffer {
  return createHash("sha256").update(key).digest();
}

/**
 * Express request augmentation: when a virtual key authenticated the
 * request, the chat route reads it back from `req.virtualKey` to enforce
 * its caps and model allowlist before routing to a provider.
 */
declare global {
  namespace Express {
    interface Request {
      virtualKey?: VirtualKey;
    }
  }
}

/**
 * Authentication middleware. Accepts two credential shapes:
 *
 *   1. The master key `FREELLM_API_KEY` via timing-safe comparison.
 *   2. A virtual key loaded from the configured virtual-keys file. The
 *      token itself is the full key id (e.g. `sk-freellm-portfolio-abc`).
 *
 * When both `FREELLM_API_KEY` is set and virtual keys are loaded, either
 * credential is accepted. This lets operators use a master key for
 * admin tooling while issuing per-app virtual keys with their own caps.
 *
 * If neither auth source is configured, requests pass through (local
 * dev mode). The server logs a warning at boot for this case.
 */
export function auth(req: Request, _res: Response, next: NextFunction): void {
  const requiredKey = process.env["FREELLM_API_KEY"];
  const virtualKeyStore = getVirtualKeyStore();
  const hasVirtualKeys = virtualKeyStore.size() > 0;

  // Health check is always unauthenticated so Docker HEALTHCHECK works.
  if (req.path === "/healthz" || req.path === "/api/healthz") {
    next();
    return;
  }

  // Fully open gateway: no master key, no virtual keys.
  if (!requiredKey && !hasVirtualKeys) {
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

  // 1. Try master key (timing-safe).
  if (requiredKey) {
    try {
      if (timingSafeEqual(hashKey(token), hashKey(requiredKey))) {
        next();
        return;
      }
    } catch {
      // hashKey lengths are always equal, but be defensive.
    }
  }

  // 2. Try virtual keys. Constant-time comparison by hashing both
  //    before `.get()` would be overkill because the Map key is the
  //    full token string and lookup time leaks nothing useful once
  //    the token format is known. The format itself (`sk-freellm-`
  //    prefix) is public.
  if (hasVirtualKeys && token.startsWith("sk-freellm-")) {
    const virtualKey = virtualKeyStore.findByToken(token);
    if (virtualKey) {
      req.virtualKey = virtualKey;
      next();
      return;
    }
  }

  next(
    freellmError({
      code: "invalid_api_key",
      message: "Invalid API key.",
    }),
  );
}
