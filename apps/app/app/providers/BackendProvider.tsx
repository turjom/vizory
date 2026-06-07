/**
 * Backend Provider
 *
 * Unified provider component that wraps your app with the appropriate
 * backend context based on configuration.
 *
 * For Supabase: Provides QueryProvider (React Query)
 * For Convex: Provides ConvexProvider and ConvexAuthProvider
 *
 * Usage:
 * ```tsx
 * <BackendProvider>
 *   <App />
 * </BackendProvider>
 * ```
 */

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { env } from "../config/env"
import { queryClient } from "../hooks/queries"
import { getBackendAsync, isBackendInitialized } from "../services/backend"
import type { Backend, BackendProvider as BackendProviderType } from "../services/backend/types"
import { logger } from "../utils/Logger"

// ============================================================================
// Context
// ============================================================================

interface BackendContextValue {
  /** The backend instance */
  backend: Backend | null
  /** Whether the backend is ready to use */
  isReady: boolean
  /** Error if backend initialization failed */
  error: Error | null
  /** The current backend provider type */
  provider: BackendProviderType
}

const BackendContext = createContext<BackendContextValue | null>(null)

// ============================================================================
// Hook
// ============================================================================

/**
 * Access the backend context
 *
 * @throws If used outside of BackendProvider
 */
export function useBackendContext(): BackendContextValue {
  const context = useContext(BackendContext)
  if (!context) {
    throw new Error("useBackendContext must be used within a BackendProvider")
  }
  return context
}

/**
 * Access the backend instance
 *
 * @throws If backend is not ready or used outside of BackendProvider
 */
export function useBackend(): Backend {
  const { backend, isReady, error } = useBackendContext()

  if (error) {
    throw error
  }

  if (!isReady || !backend) {
    throw new Error("Backend is not ready. Use useBackendContext() to check isReady first.")
  }

  return backend
}

// ============================================================================
// Provider Props
// ============================================================================

interface BackendProviderProps {
  children: ReactNode
  /** Optional: Show a loading component while backend initializes */
  loadingComponent?: ReactNode
  /** Optional: Show an error component if backend fails to initialize */
  errorComponent?: (error: Error) => ReactNode
}

// ============================================================================
// Supabase Provider
// ============================================================================

function SupabaseProvider({ children }: { children: ReactNode }) {
  // Supabase uses React Query for data fetching
  // The Supabase client is already initialized globally
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// ============================================================================
// Convex Provider
// ============================================================================

// ============================================================================
// Main Provider
// ============================================================================

export function BackendProvider({
  children,
  loadingComponent,
  errorComponent,
}: BackendProviderProps) {
  const [backend, setBackend] = useState<Backend | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Initialize backend on mount
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const backendInstance = await getBackendAsync()

        if (mounted) {
          setBackend(backendInstance)
          setIsReady(true)
        }
      } catch (err) {
        if (mounted) {
          logger.error("Backend initialization failed", {}, err as Error)
          setError(err as Error)
        }
      }
    }

    // Only initialize if not already done
    if (!isBackendInitialized()) {
      init()
    } else {
      // Already initialized, get the instance synchronously
      import("../services/backend")
        .then(({ getBackend }) => {
          if (mounted) {
            setBackend(getBackend())
            setIsReady(true)
          }
        })
        .catch((err) => {
          if (mounted) {
            logger.error("Backend import failed", {}, err as Error)
            setError(err as Error)
          }
        })
    }

    return () => {
      mounted = false
    }
  }, [])

  // Context value (memoized)
  const contextValue = useMemo<BackendContextValue>(
    () => ({
      backend,
      isReady,
      error,
      provider: env.backendProvider,
    }),
    [backend, isReady, error],
  )

  // Handle error state
  if (error) {
    if (errorComponent) {
      return <>{errorComponent(error)}</>
    }
    // Default: Re-throw to be caught by error boundary
    throw error
  }

  // Handle loading state - render loading component if provided
  // Otherwise, continue rendering children since the app handles its own loading UI
  // This prevents blank screens during backend initialization
  if (!isReady && loadingComponent) {
    return <>{loadingComponent}</>
  }

  // Wrap children with provider-specific components
  // Always render children even during loading - the app handles its own loading state
  const providerContent = (
    <BackendContext.Provider value={contextValue}>{children}</BackendContext.Provider>
  )

  return <SupabaseProvider>{providerContent}</SupabaseProvider>
}

// ============================================================================
// Convenience Exports
// ============================================================================

export { BackendContext }

/**
 * Higher-order component to inject backend
 */
export function withBackend<P extends object>(
  Component: React.ComponentType<P & { backend: Backend }>,
): React.FC<Omit<P, "backend">> {
  return function WithBackendWrapper(props: Omit<P, "backend">) {
    const backend = useBackend()
    return <Component {...(props as P)} backend={backend} />
  }
}
