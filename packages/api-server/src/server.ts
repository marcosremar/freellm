import app from "./app.js";
import { logger } from "./lib/logger.js";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

app.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT }, "FreeLLM gateway listening");
});
