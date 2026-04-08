import { Router, type IRouter, type NextFunction } from "express";
import { registry, router as gatewayRouter } from "../../gateway/index.js";
import type { RoutingStrategy } from "../../gateway/types.js";
import { validate } from "../../middleware/validate.js";
import { updateRoutingSchema } from "../../gateway/schemas.js";
import { adminAuth } from "../../middleware/admin-auth.js";
import { freellmError } from "../../errors/index.js";

const statusRouter: IRouter = Router();

// Admin auth for mutation endpoints (reset, routing strategy changes)
statusRouter.post("/providers/:providerId/reset", adminAuth);
statusRouter.patch("/routing", adminAuth);

statusRouter.get("/", (_req, res) => {
  const stats = gatewayRouter.requestLog.getStats();
  const recentRequests = gatewayRouter.requestLog.getRecent(50);
  const { byProvider, gateway } = gatewayRouter.usageTracker.getAllTotals();
  const cacheStats = gatewayRouter.cache.getStats();

  res.json({
    routingStrategy: gatewayRouter.strategy,
    totalRequests: stats.totalRequests,
    successRequests: stats.successRequests,
    failedRequests: stats.failedRequests,
    providers: registry.getStatusAll(byProvider),
    recentRequests,
    usage: gateway,
    cache: cacheStats,
  });
});

statusRouter.post("/providers/:providerId/reset", (req, res, next: NextFunction) => {
  const { providerId } = req.params;
  const provider = registry.getById(providerId);

  if (!provider) {
    next(
      freellmError({
        code: "provider_not_found",
        message: `Provider not found: ${providerId}`,
      }),
    );
    return;
  }

  provider.resetCircuitBreaker();
  const stats = provider.getStats();
  const keys = provider.getKeysStatus();
  const usage = gatewayRouter.usageTracker.getTotals(provider.id);

  res.json({
    id: provider.id,
    name: provider.name,
    enabled: provider.isEnabled(),
    circuitBreakerState: provider.getCircuitBreakerState(),
    totalRequests: stats.totalRequests,
    successRequests: stats.successRequests,
    failedRequests: stats.failedRequests,
    rateLimitedRequests: stats.rateLimitedRequests,
    lastError: stats.lastError ?? null,
    lastUsedAt: stats.lastUsedAt ?? null,
    models: provider.models.map((m) => m.id),
    keyCount: keys.length,
    keysAvailable: keys.filter((k) => !k.rateLimited).length,
    keys,
    usage,
  });
});

statusRouter.patch("/routing", validate(updateRoutingSchema), (req, res) => {
  const { strategy } = req.body as { strategy: RoutingStrategy };

  gatewayRouter.strategy = strategy;
  const stats = gatewayRouter.requestLog.getStats();
  const recentRequests = gatewayRouter.requestLog.getRecent(50);
  const { byProvider, gateway } = gatewayRouter.usageTracker.getAllTotals();
  const cacheStats = gatewayRouter.cache.getStats();

  res.json({
    routingStrategy: gatewayRouter.strategy,
    totalRequests: stats.totalRequests,
    successRequests: stats.successRequests,
    failedRequests: stats.failedRequests,
    providers: registry.getStatusAll(byProvider),
    recentRequests,
    usage: gateway,
    cache: cacheStats,
  });
});

export default statusRouter;
