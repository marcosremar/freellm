import type {
  ChatCompletionRequest,
  KeyStatus,
  ModelObject,
  ProviderStats,
  CircuitBreakerState,
} from "../types.js";

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly models: ModelObject[];

  isEnabled(): boolean;
  getStats(): ProviderStats;
  getCircuitBreakerState(): CircuitBreakerState;
  isAvailable(): boolean;
  getKeysStatus(): KeyStatus[];

  complete(request: ChatCompletionRequest): Promise<Response>;
  onSuccess(response: Response): void;
  onRateLimit(response: Response, retryAfterSeconds?: number): void;
  onError(): void;
  resetCircuitBreaker(): void;

  /**
   * Optional: dynamically discover available (free) models from the provider API.
   * Called on startup and periodically. Providers that implement this will have
   * their model list updated automatically instead of relying on a static list.
   */
  discoverModels?(): Promise<ModelObject[]>;

  /**
   * Optional: fetch the remaining credit balance for this provider (in USD).
   * Returns null if the provider doesn't support balance checking or has no key.
   * Used by GET /v1/credits to show how much quota is left on paid providers.
   */
  getBalance?(): Promise<number | null>;
}
