import { Router, type IRouter } from "express";
import type { Request, Response, NextFunction } from "express";
import { router as gatewayRouter, AllProvidersExhaustedError, ProviderClientError } from "../../gateway/index.js";
import { logger } from "../../lib/logger.js";
import type { ChatCompletionRequest } from "../../gateway/types.js";
import type { RouteMeta } from "../../gateway/router.js";
import { validate } from "../../middleware/validate.js";
import { chatCompletionRequestSchema } from "../../gateway/schemas.js";
import { parseStrictHeader } from "../../gateway/strict.js";
import { parsePrivacyHeader } from "../../gateway/privacy.js";

const chatRouter: IRouter = Router();

/** Set the X-FreeLLM-* observability headers on a response. */
function setRouteHeaders(res: Response, meta: RouteMeta): void {
  res.setHeader("X-FreeLLM-Provider", meta.provider);
  res.setHeader("X-FreeLLM-Model", meta.resolvedModel);
  res.setHeader("X-FreeLLM-Requested-Model", meta.requestedModel);
  res.setHeader("X-FreeLLM-Cached", meta.cached ? "true" : "false");
  res.setHeader("X-FreeLLM-Route-Reason", meta.reason);
}

chatRouter.post("/completions", validate(chatCompletionRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  const body = req.body as ChatCompletionRequest;
  const strict = parseStrictHeader(req.header("x-freellm-strict"));
  const privacy = parsePrivacyHeader(req.header("x-freellm-privacy"));

  if (body.stream) {
    await handleStreamingRequest(req, res, body, strict, privacy, next);
  } else {
    await handleNonStreamingRequest(req, res, body, strict, privacy, next);
  }
});

async function handleNonStreamingRequest(
  _req: Request,
  res: Response,
  body: ChatCompletionRequest,
  strict: boolean,
  privacy: "any" | "no-training",
  next: NextFunction,
) {
  try {
    const { data, meta } = await gatewayRouter.complete(body, { strict, privacy });
    setRouteHeaders(res, meta);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function handleStreamingRequest(
  _req: Request,
  res: Response,
  body: ChatCompletionRequest,
  strict: boolean,
  privacy: "any" | "no-training",
  next: NextFunction,
) {
  const startTime = Date.now();

  try {
    const { response, provider, resolvedModel, latencyMs, attempted, failoverCount } =
      await gatewayRouter.routeStream(body, { strict, privacy });

    const meta: RouteMeta = {
      provider: provider.id,
      resolvedModel,
      requestedModel: body.model,
      cached: false,
      reason: failoverCount > 0 ? "failover" : body.model.startsWith("free") ? "meta" : "direct",
      attempted,
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    setRouteHeaders(res, meta);
    res.flushHeaders();

    if (!response.body) {
      gatewayRouter.requestLog.add({
        requestedModel: body.model,
        resolvedModel,
        provider: provider.id,
        latencyMs,
        status: "success",
        streaming: true,
      });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          res.write(decoder.decode(value, { stream: true }));
        }
      }

      // Log success once — provider.onSuccess() was already called in route()
      gatewayRouter.requestLog.add({
        requestedModel: body.model,
        resolvedModel,
        provider: provider.id,
        latencyMs,
        status: "success",
        streaming: true,
      });
    } catch (streamErr) {
      // Stream read failed after headers were sent
      const elapsed = Date.now() - startTime;
      gatewayRouter.requestLog.add({
        requestedModel: body.model,
        resolvedModel,
        provider: provider.id,
        latencyMs: elapsed,
        status: "error",
        error: String(streamErr),
        streaming: true,
      });
      logger.error({ err: streamErr }, "Stream relay error");
    }

    res.end();
  } catch (err) {
    const elapsed = Date.now() - startTime;

    if (err instanceof ProviderClientError) {
      gatewayRouter.requestLog.add({
        requestedModel: body.model,
        latencyMs: elapsed,
        status: "error",
        error: err.message,
        streaming: true,
      });
      if (!res.headersSent) {
        return next(err);
      }
      return;
    }

    if (err instanceof AllProvidersExhaustedError) {
      gatewayRouter.requestLog.add({
        requestedModel: body.model,
        latencyMs: elapsed,
        status: "all_providers_failed",
        error: err.message,
        streaming: true,
      });

      if (!res.headersSent) {
        return next(err);
      }
      // Headers already flushed mid-stream — surface as SSE error frame.
      res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    logger.error({ err }, "Streaming gateway error");
    gatewayRouter.requestLog.add({
      requestedModel: body.model,
      latencyMs: elapsed,
      status: "error",
      error: String(err),
      streaming: true,
    });

    if (!res.headersSent) {
      return next(err);
    }
    res.end();
  }
}

export default chatRouter;
