import app from "./app.js";
import { logger } from "./lib/logger.js";
import { PROVIDER_PRIVACY, daysSinceVerified } from "./gateway/privacy.js";
import { initVirtualKeys } from "./gateway/virtual-keys-singleton.js";
import { VirtualKeysError } from "./gateway/virtual-keys.js";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

if (process.env["NODE_ENV"] === "production" && !process.env["FREELLM_API_KEY"]) {
  logger.warn("FREELLM_API_KEY is not set -- gateway is open to the internet without authentication");
}

// Virtual keys load synchronously at boot. A bad file aborts startup with
// a clear error instead of letting the gateway run with partial config.
try {
  const vkStore = initVirtualKeys();
  if (vkStore.size() > 0) {
    logger.warn(
      { keyCount: vkStore.size() },
      "virtual key caps are SOFT (in-memory, reset on restart). Not a billing system.",
    );
  }
} catch (err) {
  if (err instanceof VirtualKeysError) {
    logger.fatal({ err: err.message }, "failed to load virtual keys, refusing to boot");
    process.exit(1);
  }
  throw err;
}

// Stale privacy catalog warning. Entries older than 90 days should be
// re-verified by a human against the provider's current terms of service.
for (const [id, entry] of Object.entries(PROVIDER_PRIVACY)) {
  const age = daysSinceVerified(entry);
  if (age > 90) {
    logger.warn(
      { provider: id, last_verified: entry.last_verified, days_stale: age },
      "privacy catalog entry is older than 90 days -- re-verify against provider ToS",
    );
  }
}

const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT }, "FreeLLM gateway listening");
});

// Graceful shutdown: drain in-flight requests before exiting
function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received, draining connections...");
  server.close(() => {
    logger.info("All connections drained, exiting.");
    process.exit(0);
  });
  // Force exit if drain takes too long (Railway gives 10s)
  setTimeout(() => {
    logger.warn("Forcefully shutting down after timeout.");
    process.exit(1);
  }, 8000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
