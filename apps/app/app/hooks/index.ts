/**
 * Hooks Index
 *
 * This is the main entry point for all hooks. Import from here for most use cases.
 *
 * ## Auth Hook
 *
 * ```tsx
 * import { useAuth, useUser, useAuthState } from "@/hooks"
 *
 * function MyScreen() {
 *   const { isAuthenticated, user, signIn, signOut, signInWithMagicLink, verifyOtp } = useAuth()
 *   // ... your component
 * }
 * ```
 *
 * `useAuth()` is the ONLY auth hook you need.
 *
 * ## Real-time Hooks
 *
 * ```tsx
 * import { useRealtimeMessages, useRealtimePresence } from "@/hooks"
 * ```
 */

// ============================================================================
// Auth Hooks - THE hooks to use in screens
// ============================================================================

export {
  // Main unified auth hook
  useAuth,
  // Lightweight helpers
  useUser,
  useAuthState,
  // Types
  type AppUser,
  type AppAuthState,
  type AppAuthActions,
  type ProfileUpdateData,
  // Deprecated aliases (for migration)
  useAppAuth,
  useAppUser,
  useAppAuthState,
} from "./useAppAuth"

// ============================================================================
// Real-time Hooks
// ============================================================================

export { useRealtimeMessages } from "./useRealtimeMessages"
export { useRealtimePresence } from "./useRealtimePresence"
export { useRealtimeSubscription } from "./useRealtimeSubscription"

// ============================================================================
// Utility Hooks
// ============================================================================

export { useAnalytics } from "./useAnalytics"
export { useDeepLinking } from "./useDeepLinking"
export { usePressableGesture } from "./usePressableGesture"
export { useEmailVerificationPolling } from "./useEmailVerificationPolling"
export { useWidgetData } from "./useWidgetData"
export { useTrialStatus } from "./useTrialStatus"

// ============================================================================
// Query Hooks (React Query)
// ============================================================================

export { queryClient } from "./queries/queryClient"
export { queryKeys } from "./queries/queryKeys"
export { useSkusQuery } from "./queries/useSkusQuery"
export { useSkuDetailQuery } from "./queries/useSkuDetailQuery"
export { useDashboardInventoryQuery } from "./queries/useDashboardInventoryQuery"
export { useProfileQuery, type ProfileRow } from "./queries/useProfileQuery"

