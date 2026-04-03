import app from "./app.js";
import { logger } from "./lib/logger.js";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

// Warn loudly if running in production without API key auth
if (process.env["NODE_ENV"] === "production" && !process.env["FREELLM_API_KEY"]) {
  logger.warn("FREELLM_API_KEY is not set -- gateway is open to the internet without authentication");
}

app.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT }, "FreeLLM gateway listening");
});
