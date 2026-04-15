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
}
