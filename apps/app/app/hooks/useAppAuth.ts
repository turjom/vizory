/**
 * Unified App Auth Hook
 *
 * This hook provides a unified authentication interface that works with both
 * Supabase and Convex backends. It automatically selects the correct implementation
 * based on your configured backend provider.
 *
 * This is the PRIMARY hook you should use in all screens and components.
 * It provides a consistent API regardless of which backend is configured.
 *
 * @example
 * ```tsx
 * import { useAppAuth } from "@/hooks/useAppAuth"
 *
 * function ProfileScreen() {
 *   const { isAuthenticated, isLoading, user, signOut, updateProfile } = useAppAuth()
 *
 *   if (isLoading) return <Loading />
 *   if (!isAuthenticated) return <SignInPrompt />
 *
 *   return (
 *     <View>
 *       <Text>Hello, {user?.displayName}</Text>
 *       <Button onPress={() => updateProfile({ firstName: "New Name" })} />
 *       <Button onPress={signOut} title="Sign Out" />
 *     </View>
 *   )
 * }
 * ```
 */

import { useCallback, useMemo } from "react"

import type { AuthState } from "../stores/auth/authTypes"
import type { Session } from "../types/auth"

// ============================================================================
// Types - Unified User Interface
// ============================================================================

/**
 * Unified user object that works with both backends.
 * This normalizes the different user structures from Supabase and Convex.
 */
export interface AppUser {
  /** Unique user ID */
  id: string
  /** User's email address */
  email: string | null
  /** User's display name (computed from first_name/last_name or name) */
  displayName: string | null
  /** User's first name */
  firstName: string | null
  /** User's last name */
  lastName: string | null
  /** User's full name */
  fullName: string | null
  /** User's avatar URL */
  avatarUrl: string | null
  /** User's bio/description */
  bio: string | null
  /** Whether the user's email is verified */
  emailVerified: boolean
  /** When the user was created */
  createdAt: string | null
  /** Raw metadata from the backend (for advanced use cases) */
  metadata: Record<string, unknown>
}

export interface AppAuthState {
  /** Whether the user is authenticated */
  isAuthenticated: boolean
  /** Whether the auth state is loading */
  isLoading: boolean
  /** The current user (null if not authenticated or loading) */
  user: AppUser | null
  /** User ID shortcut */
  userId: string | null
  /** Whether the user's email is verified */
  isEmailVerified: boolean
  /** Whether onboarding is completed */
  hasCompletedOnboarding: boolean
  /** The backend provider in use */
  provider: "supabase" | "convex"
}

export interface ProfileUpdateData {
  firstName?: string
  lastName?: string
  fullName?: string
  avatarUrl?: string
  bio?: string
}

export interface AppAuthActions {
  /** Sign in with email/password */
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null; session?: Session | null }>
  /**
   * Sign up with email/password. `firstName` / optional `lastName` are sent as Supabase
   * `user_metadata` and picked up by the DB trigger into `public.profiles`.
   */
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName?: string,
  ) => Promise<{ error: Error | null }>
  /** Sign in with Google OAuth */
  signInWithGoogle: () => Promise<{ error: Error | null }>
  /** Sign in with Apple OAuth */
  signInWithApple: () => Promise<{ error: Error | null }>
  /** Sign in with magic link */
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  /** Verify OTP code */
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  /** Sign out */
  signOut: () => Promise<{ error: Error | null }>
  /** Reset password */
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  /** Update user profile */
  updateProfile: (data: ProfileUpdateData) => Promise<{ error: Error | null }>
  /** Mark onboarding as completed */
  completeOnboarding: () => Promise<{ error: Error | null }>
  /** Set the user in local state (for optimistic updates) */
  setUser: (user: AppUser | null) => void
  /** Initialize auth state (call on app startup) */
  initialize: () => Promise<void>
}

// ============================================================================
// Supabase Implementation
// ============================================================================

function useSupabaseAppAuth(): AppAuthState & AppAuthActions {
  // Lazy import to enable code splitting
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useSupabaseAuth } = require("./supabase")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuthStore } = require("../stores/auth")

  const auth = useSupabaseAuth()
  const storeLoading = useAuthStore((state: AuthState) => state.loading)
  const hasCompletedOnboarding = useAuthStore((state: AuthState) => state.hasCompletedOnboarding)
  const setStoreUser = useAuthStore((state: AuthState) => state.setUser)
  const setStoreHasCompletedOnboarding = useAuthStore(
    (state: AuthState) => state.setHasCompletedOnboarding,
  )
  const initializeStore = useAuthStore((state: AuthState) => state.initialize)
  const storeSignIn = useAuthStore((state: AuthState) => state.signIn)

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await storeSignIn(email, password)
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[BiometricFlow] useAppAuth.signIn passthrough", {
          hasError: !!result.error,
          hasSession: !!result.session,
          hasAccessToken: !!result.session?.access_token,
          hasRefreshToken: !!result.session?.refresh_token,
        })
      }
      return { error: result.error ?? null, session: result.session ?? null }
    },
    [storeSignIn],
  )

  // Transform Supabase user to unified AppUser
  const user: AppUser | null = useMemo(() => {
    if (!auth.user) return null

    const metadata = auth.user.user_metadata || {}
    const firstName = typeof metadata.first_name === "string" ? metadata.first_name : null
    const lastName = typeof metadata.last_name === "string" ? metadata.last_name : null
    const fullName =
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : firstName && lastName
          ? `${firstName} ${lastName}`
          : null
    const displayName = firstName || fullName || auth.user.email?.split("@")[0] || null

    return {
      id: auth.user.id,
      email: auth.user.email || null,
      displayName,
      firstName,
      lastName,
      fullName,
      avatarUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
      bio: typeof metadata.bio === "string" ? metadata.bio : null,
      emailVerified: !!auth.user.email_confirmed_at,
      createdAt: auth.user.created_at || null,
      metadata,
    }
  }, [auth.user])

  // Update profile using Supabase
  const updateProfile = useCallback(
    async (data: ProfileUpdateData): Promise<{ error: Error | null }> => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { supabase } = require("../services/supabase")

      try {
        const updatedMetadata: Record<string, unknown> = {}
        if (data.firstName !== undefined) updatedMetadata.first_name = data.firstName
        if (data.lastName !== undefined) updatedMetadata.last_name = data.lastName
        if (data.fullName !== undefined) {
          updatedMetadata.full_name = data.fullName
        } else if (data.firstName !== undefined || data.lastName !== undefined) {
          // Auto-compute full_name if first or last name changed
          const newFirst = data.firstName ?? user?.firstName ?? ""
          const newLast = data.lastName ?? user?.lastName ?? ""
          updatedMetadata.full_name = `${newFirst} ${newLast}`.trim()
        }
        if (data.avatarUrl !== undefined) updatedMetadata.avatar_url = data.avatarUrl
        if (data.bio !== undefined) updatedMetadata.bio = data.bio

        // Optimistic update
        if (user) {
          const optimisticUser = {
            ...auth.user,
            user_metadata: {
              ...auth.user.user_metadata,
              ...updatedMetadata,
            },
          }
          setStoreUser(optimisticUser)
        }

        // Update auth user metadata
        const { error: authError } = await supabase.auth.updateUser({
          data: updatedMetadata,
        })

        if (authError) {
          return { error: authError as Error }
        }

        // Also update profiles table if it exists
        if (auth.user?.id) {
          const profileData: Record<string, unknown> = {
            id: auth.user.id,
            updated_at: new Date().toISOString(),
          }
          if (data.firstName !== undefined) profileData.first_name = data.firstName
          if (data.lastName !== undefined) profileData.last_name = data.lastName
          if (data.avatarUrl !== undefined) profileData.avatar_url = data.avatarUrl
          if (data.bio !== undefined) profileData.bio = data.bio

          // Fire and forget - profiles table is optional
          supabase
            .from("profiles")
            .upsert(profileData)
            .then(({ error: profileError }: { error: Error | null }) => {
              if (profileError) {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { logger } = require("../utils/Logger")
                logger.warn("Profile table update error", { error: profileError.message })
              }
            })
        }

        return { error: null }
      } catch (err) {
        return { error: err as Error }
      }
    },
    [auth.user, user, setStoreUser],
  )

  const completeOnboarding = useCallback(async (): Promise<{ error: Error | null }> => {
    try {
      await setStoreHasCompletedOnboarding(true)
      return { error: null }
    } catch (err) {
      return { error: err as Error }
    }
  }, [setStoreHasCompletedOnboarding])

  const setUser = useCallback(
    (newUser: AppUser | null) => {
      if (!newUser) {
        setStoreUser(null)
        return
      }

      // Transform AppUser back to Supabase user format for the store
      if (auth.user) {
        setStoreUser({
          ...auth.user,
          user_metadata: {
            ...auth.user.user_metadata,
            first_name: newUser.firstName,
            last_name: newUser.lastName,
            full_name: newUser.fullName,
            avatar_url: newUser.avatarUrl,
            bio: newUser.bio,
          },
        })
      }
    },
    [auth.user, setStoreUser],
  )

  const initialize = useCallback(async () => {
    await initializeStore()
  }, [initializeStore])

  const signUp = useCallback(
    async (email: string, password: string, firstName: string, lastName?: string) => {
      return auth.signUpWithPassword(email, password, firstName, lastName)
    },
    [auth],
  )

  return {
    // State
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading || storeLoading,
    user,
    userId: auth.userId,
    isEmailVerified: auth.isEmailVerified,
    hasCompletedOnboarding,
    provider: "supabase",
    // Actions
    signIn,
    signUp,
    signInWithGoogle: auth.signInWithGoogle,
    signInWithApple: auth.signInWithApple,
    signInWithMagicLink: auth.signInWithMagicLink,
    verifyOtp: auth.verifyOtp,
    signOut: auth.signOut,
    resetPassword: auth.resetPassword,
    updateProfile,
    completeOnboarding,
    setUser,
    initialize,
  }
}

// ============================================================================
// Convex Implementation (removed - using Supabase only)
// ============================================================================

// Convex code has been removed. If you need Convex, restore from git or re-clone.

// ============================================================================
// Main Hook
// ============================================================================

/**
 * useAuth - THE unified auth hook for all screens
 *
 * Automatically uses the correct implementation based on your configured
 * backend provider (EXPO_PUBLIC_BACKEND_PROVIDER).
 *
 * This is THE ONLY auth hook you should use in screens and components.
 * It provides a consistent API regardless of whether you're using Supabase or Convex.
 *
 * @example
 * ```tsx
 * import { useAuth } from "@/hooks"
 *
 * function AuthButton() {
 *   const { isAuthenticated, isLoading, user, signIn, signOut } = useAuth()
 *
 *   if (isLoading) return <ActivityIndicator />
 *
 *   return isAuthenticated ? (
 *     <View>
 *       <Text>Welcome, {user?.displayName}</Text>
 *       <Button onPress={signOut} title="Sign Out" />
 *     </View>
 *   ) : (
 *     <Button onPress={() => signIn("email", "password")} title="Sign In" />
 *   )
 * }
 * ```
 */
export function useAuth(): AppAuthState & AppAuthActions {
  return useSupabaseAppAuth()
}

/**
 * @deprecated Use `useAuth()` instead. This alias will be removed in a future version.
 */
export const useAppAuth = useAuth

/**
 * useUser - Get just the current user
 *
 * A lightweight hook when you only need user data, not auth actions.
 *
 * @example
 * ```tsx
 * import { useUser } from "@/hooks"
 *
 * const user = useUser()
 * if (user) {
 *   console.log(`Logged in as ${user.displayName}`)
 * }
 * ```
 */
export function useUser(): AppUser | null {
  const { user } = useAuth()
  return user
}

/**
 * @deprecated Use `useUser()` instead.
 */
export const useAppUser = useUser

/**
 * useAuthState - Get just the auth state (no actions)
 *
 * A lightweight hook when you only need to check auth status.
 *
 * @example
 * ```tsx
 * import { useAuthState } from "@/hooks"
 *
 * const { isAuthenticated, isLoading } = useAuthState()
 * ```
 */
export function useAuthState(): Pick<
  AppAuthState,
  "isAuthenticated" | "isLoading" | "hasCompletedOnboarding"
> {
  const { isAuthenticated, isLoading, hasCompletedOnboarding } = useAuth()
  return { isAuthenticated, isLoading, hasCompletedOnboarding }
}

/**
 * @deprecated Use `useAuthState()` instead.
 */
export const useAppAuthState = useAuthState
