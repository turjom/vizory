/**
 * Backend Service Factory
 *
 * Dynamically loads the appropriate backend based on configuration.
 * Uses code splitting to ensure only the selected provider's code is loaded.
 *
 * Usage:
 * ```typescript
 * import { getBackend } from "./services/backend"
 *
 * const backend = getBackend()
 * const { user } = await backend.auth.getUser()
 * ```
 */

import type { Backend, BackendProvider } from "./types"
import { env, isSupabase } from "../../config/env"
import { logger } from "../../utils/Logger"

// ============================================================================
// Backend Instance Management
// ============================================================================

let backendInstance: Backend | null = null
let initializationPromise: Promise<Backend> | null = null

/**
 * Get the current backend provider type
 */
export function getBackendProvider(): BackendProvider {
  return env.backendProvider
}

/**
 * Check if a specific backend is active
 */
export function isBackendProvider(provider: BackendProvider): boolean {
  return env.backendProvider === provider
}

/**
 * Get or create the backend instance
 *
 * This function dynamically imports only the selected backend's code,
 * ensuring minimal bundle size when one provider is not used.
 */
export async function getBackendAsync(): Promise<Backend> {
  // Return existing instance if available
  if (backendInstance) {
    return backendInstance
  }

  // Return existing initialization promise to prevent race conditions
  if (initializationPromise) {
    return initializationPromise
  }

  // Start initialization
  initializationPromise = (async () => {
    logger.info(`Initializing ${env.backendProvider} backend...`)

    try {
      if (isSupabase) {
        // Dynamically import Supabase backend
        const { createSupabaseBackend } = await import("./supabase")
        backendInstance = createSupabaseBackend()
      } else {
        throw new Error(`Unknown backend provider: ${env.backendProvider}`)
      }

      // Initialize the backend
      await backendInstance.initialize()

      logger.info(`${env.backendProvider} backend initialized successfully`, {
        isMock: backendInstance.isMock,
      })

      return backendInstance
    } catch (error) {
      logger.error("Failed to initialize backend", {}, error as Error)
      initializationPromise = null
      throw error
    }
  })()

  return initializationPromise
}

/**
 * Get the backend instance synchronously
 *
 * WARNING: This will throw if the backend hasn't been initialized yet.
 * Use getBackendAsync() in async contexts, or ensure initialization
 * completes before calling this.
 *
 * For most cases, prefer using the specialized hooks:
 * - useBackend() - React hook that handles async loading
 * - useAuth() - Auth operations
 */
export function getBackend(): Backend {
  if (!backendInstance) {
    // Try to initialize synchronously (will only work if already cached)
    // This is a fallback for code that can't use async
    if (isSupabase) {
      // Supabase is available synchronously
      const { createSupabaseBackend } = require("./supabase")
      backendInstance = createSupabaseBackend()
    } else {
      throw new Error(
        `Backend not initialized. Call getBackendAsync() first or use useBackend() hook.`,
      )
    }
  }

  return backendInstance!
}

/**
 * Destroy the backend instance and clean up resources
 */
export async function destroyBackend(): Promise<void> {
  if (backendInstance) {
    await backendInstance.destroy()
    backendInstance = null
    initializationPromise = null
    logger.info("Backend destroyed")
  }
}

/**
 * Check if the backend is initialized
 */
export function isBackendInitialized(): boolean {
  return backendInstance !== null
}

/**
 * Check if the backend is using mock mode
 */
export function isUsingMockBackend(): boolean {
  return backendInstance?.isMock ?? false
}

// ============================================================================
// Type Exports
// ============================================================================

export * from "./types"

// ============================================================================
// Provider-Specific Exports (for advanced use cases)
// ============================================================================

// Re-export provider modules for direct access when needed
// These are tree-shaken out if not used

export type { TypedSupabaseClient } from "./supabase/client"
