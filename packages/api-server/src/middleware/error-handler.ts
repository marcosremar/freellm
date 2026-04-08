import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";
import { AllProvidersExhaustedError, ProviderClientError, registry } from "../gateway/index.js";
import { StrictModeError } from "../gateway/strict.js";
import { buildRetryAdvice, retryAfterSeconds } from "../gateway/retry-advice.js";

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

  if (err instanceof StrictModeError) {
    res.status(400).json({
      error: {
        message: err.message,
        type: "strict_mode_error",
        code: "strict_mode_meta_model_forbidden",
        requested_model: err.requestedModel,
      },
    });
    return;
  }

  if (err instanceof ProviderClientError) {
    const message = await safeUpstreamMessage(err.upstreamResponse, err.message);
    if (err.statusCode === 429) {
      const advice = buildRetryAdvice(registry.getStatusAll(), [err.providerId]);
      const retryAfter = retryAfterSeconds(advice);
      if (retryAfter != null) res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-FreeLLM-Provider", err.providerId);
      res.status(429).json({
        error: {
          message,
          type: "rate_limit_error",
          code: "provider_rate_limited",
          provider: err.providerId,
          ...advice,
        },
      });
      return;
    }
    res.status(err.statusCode).json({
      error: { message, type: "provider_error", provider: err.providerId },
    });
    return;
  }

  if (err instanceof AllProvidersExhaustedError) {
    const advice = buildRetryAdvice(registry.getStatusAll(), err.triedProviders);
    const retryAfter = retryAfterSeconds(advice);
    if (retryAfter != null) res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: {
        message: err.message,
        type: "rate_limit_error",
        code: "all_providers_exhausted",
        ...advice,
      },
    });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    error: { message: "Internal server error", type: "internal_error" },
  });
}
