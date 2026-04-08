/**
 * Process-wide virtual key store. Loaded once at boot from
 * `FREELLM_VIRTUAL_KEYS_PATH` via `loadVirtualKeysFromEnv()`. Middleware
 * and route handlers import the singleton through this module to avoid
 * circular imports between `middleware/` and `gateway/`.
 */

import {
  VirtualKeyStore,
  emptyVirtualKeyStore,
  loadVirtualKeysFromEnv,
} from "./virtual-keys.js";

let store: VirtualKeyStore = emptyVirtualKeyStore();
let initialized = false;

export function initVirtualKeys(): VirtualKeyStore {
  if (initialized) return store;
  store = loadVirtualKeysFromEnv();
  initialized = true;
  return store;
}

/** Overwrite the store. Used by tests that need a custom config. */
export function setVirtualKeyStore(next: VirtualKeyStore): void {
  store = next;
  initialized = true;
}

export function getVirtualKeyStore(): VirtualKeyStore {
  return store;
}
