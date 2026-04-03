import rateLimit from "express-rate-limit";

const windowMs = parseInt(process.env["RATE_LIMIT_WINDOW_MS"] ?? "60000", 10);
const max = parseInt(process.env["RATE_LIMIT_RPM"] ?? "60", 10);

/**
 * Per-client rate limiter (by IP).
 * Configurable via RATE_LIMIT_RPM (default 60) and RATE_LIMIT_WINDOW_MS (default 60000).
 * This is independent of the per-provider rate limiter in the gateway.
 */
export const clientRateLimit = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: `Rate limit exceeded. Max ${max} requests per ${windowMs / 1000}s.`,
      type: "rate_limit_error",
    },
  },
  skip: (req) => {
    // Don't rate-limit health checks
    return req.path === "/healthz" || req.path === "/api/healthz";
  },
});
