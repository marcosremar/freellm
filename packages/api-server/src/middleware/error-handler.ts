import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";
import { AllProvidersExhaustedError, ProviderClientError } from "../gateway/index.js";

/** Extract a safe error message from an upstream response without leaking internals. */
async function safeUpstreamMessage(response: Response | globalThis.Response, fallback: string): Promise<string> {
  try {
    const body = await (response as globalThis.Response).json();
    const msg = body?.error?.message;
    return typeof msg === "string" ? msg : fallback;
  } catch {
    return fallback;
  }
}

export async function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): Promise<void> {
  if (res.headersSent) {
    return;
  }

  if (err instanceof ProviderClientError) {
    const message = await safeUpstreamMessage(err.upstreamResponse, err.message);
    res.status(err.statusCode).json({
      error: { message, type: "provider_error" },
    });
    return;
  }

  if (err instanceof AllProvidersExhaustedError) {
    res.status(429).json({
      error: {
        message: err.message,
        type: "rate_limit_error",
        code: "all_providers_exhausted",
      },
    });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    error: { message: "Internal server error", type: "internal_error" },
  });
}
