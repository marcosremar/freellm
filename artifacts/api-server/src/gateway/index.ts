import { ProviderRegistry } from "./registry.js";
import { GatewayRouter } from "./router.js";

export const registry = new ProviderRegistry();
export const router = new GatewayRouter(registry);

export { ProviderRegistry } from "./registry.js";
export { GatewayRouter, AllProvidersExhaustedError, ProviderClientError } from "./router.js";
export type * from "./types.js";
