/**
 * Supabase Auth Store
 *
 * Manages authentication state using Zustand with MMKV persistence.
 * Works with both real Supabase and mock Supabase (when API keys are missing).
 *
 * This is the Supabase-specific implementation. For Convex, use the convex/ directory.
 */
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

import { env } from "../../../config/env"
import { fetchAndApplyUserPreferences } from "../../../services/preferencesSync"
import { supabase, isUsingMockSupabase } from "../../../services/supabase"
import { isEmailConfirmed, type Session } from "../../../types/auth"
import { isNetworkError, getNetworkErrorMessage } from "../../../types/supabaseErrors"
import { logger } from "../../../utils/Logger"
import { loadString, saveString } from "../../../utils/storage"
import {
  AUTH_STORAGE_KEY,
  GUEST_USER_KEY,
  getUserKey,
  mmkvStorage,
  sanitizePersistedAuthState,
} from "../authConstants"
import type { AuthState } from "../authTypes"
import {
  resendConfirmationEmailAction,
  resetPasswordAction,
  signInAction,
  signOutAction,
  signUpAction,
  verifyEmailAction,
} from "./authActions"
import { syncOnboardingStatus, syncOnboardingToDatabase, updateUserState } from "./authHelpers"

// Track auth state change subscription to prevent duplicate listeners
let authStateSubscription: { unsubscribe: () => void } | null = null
const SUPABASE_URL_STORAGE_KEY = "supabase.last_url"

const isInvalidRefreshToken = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /invalid refresh token|refresh token not found/i.test(message)
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      loading: true,
      isAuthenticated: false,
      isEmailConfirmed: false,
      hasCompletedOnboarding: false,
      onboardingStatusByUserId: { [GUEST_USER_KEY]: true },

      setSession: (session) => {
        const user = session?.user ?? null
        const stateUpdate = updateUserState(user, session)
        set({
          ...stateUpdate,
          session,
        })
      },

      setUser: (user) => {
        const stateUpdate = updateUserState(user, get().session)
        set({
          ...stateUpdate,
          user,
        })
      },

      setLoading: (loading) => {
        set({ loading })
      },

      setHasCompletedOnboarding: async (completed) => {
        const { user } = get()
        const userKey = getUserKey(user)
        set((state) => ({
          hasCompletedOnboarding: completed,
          onboardingStatusByUserId: {
            ...state.onboardingStatusByUserId,
            [userKey]: completed,
          },
        }))
        if (user && !isUsingMockSupabase) {
          // Only sync to database if using real Supabase
          await syncOnboardingToDatabase(user.id, completed)
        }
      },

      signIn: async (email, password) => {
        return signInAction(email, password, set)
      },

      signUp: async (email, password, firstName, lastName) => {
        return signUpAction(email, password, set, firstName, lastName)
      },

      resendConfirmationEmail: async (email) => {
        return resendConfirmationEmailAction(email)
      },

      verifyEmail: async (code) => {
        return verifyEmailAction(code, set)
      },

      signOut: async () => {
        return signOutAction(get, set, GUEST_USER_KEY)
      },

      resetPassword: async (email) => {
        return resetPasswordAction(email)
      },

      /**
       * Initialize authentication state.
       *
       * This method:
       * 1. Retrieves the current session from Supabase
       * 2. Syncs onboarding status between local storage and database
       * 3. Sets up auth state change listeners
       * 4. Updates store with current user and session state
       *
       * Should be called once on app startup.
       */
      initialize: async () => {
        try {
          set({ loading: true })

          const currentSupabaseUrl = env.supabaseUrl ?? ""
          const storedSupabaseUrl = loadString(SUPABASE_URL_STORAGE_KEY)
          if (storedSupabaseUrl && currentSupabaseUrl && storedSupabaseUrl !== currentSupabaseUrl) {
            logger.warn("Supabase URL changed, clearing local session", {
              storedSupabaseUrl,
              currentSupabaseUrl,
            })
            await signOutAction(get, set, GUEST_USER_KEY)
          }
          if (currentSupabaseUrl) {
            saveString(SUPABASE_URL_STORAGE_KEY, currentSupabaseUrl)
          }

          const onboardingStatusByUserId = get().onboardingStatusByUserId

          // Get initial session
          let session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] =
            null
          try {
            const sessionResult = await supabase.auth.getSession()
            if (sessionResult.error && isInvalidRefreshToken(sessionResult.error)) {
              await signOutAction(get, set, GUEST_USER_KEY)
              set({ loading: false })
              return
            }
            session = sessionResult.data.session
          } catch (error) {
            if (isInvalidRefreshToken(error)) {
              await signOutAction(get, set, GUEST_USER_KEY)
              set({ loading: false })
              return
            }
            // Check for network errors and log with helpful context
            if (isNetworkError(error)) {
              const friendlyMessage = getNetworkErrorMessage(error, "Supabase")
              logger.error(
                "Auth initialization failed - network error",
                {
                  friendlyMessage,
                  supabaseUrl: env.supabaseUrl?.substring(0, 50),
                  hint: "Check if your Supabase project is active and the URL is correct",
                },
                error as Error,
              )
              // Continue without session - app can still work in offline mode
              set({ loading: false })
              return
            }
            throw error
          }

          // If no session, try to get user anyway (user might exist but email not confirmed)
          let user = session?.user ?? null
          if (!user) {
            try {
              const {
                data: { user: fetchedUser },
              } = await supabase.auth.getUser()
              user = fetchedUser ?? null
            } catch {
              // If getUser fails, preserve existing user from store (might be in email verification state)
              const existingUser = get().user
              if (existingUser) {
                user = existingUser
              }
            }
          }

          const userKey = getUserKey(user)
          const localOnboardingCompleted = onboardingStatusByUserId[userKey] ?? false

          let hasCompletedOnboarding = localOnboardingCompleted
          if (user && !isUsingMockSupabase) {
            // Only query database if using real Supabase
            // Mock Supabase doesn't need this as onboarding state is handled locally
            const syncedStatus = await syncOnboardingStatus(user.id, localOnboardingCompleted)
            hasCompletedOnboarding = syncedStatus

            // Fetch and apply user preferences (theme, notifications) from database
            // This runs in background and doesn't block initialization
            fetchAndApplyUserPreferences(user.id).catch((err) => {
              logger.debug("Failed to fetch user preferences", { error: err })
            })
          }

          // Check email confirmation status
          const emailConfirmed = isEmailConfirmed(user)
          // Only authenticate if session exists AND email is confirmed
          const shouldAuthenticate = !!session && emailConfirmed

          const stateUpdate = updateUserState(user, session)
          set({
            ...stateUpdate,
            session,
            isAuthenticated: shouldAuthenticate,
            hasCompletedOnboarding,
            onboardingStatusByUserId: {
              ...onboardingStatusByUserId,
              [userKey]: hasCompletedOnboarding,
            },
            loading: false,
          })

          // Listen for auth changes - only set up once
          if (!authStateSubscription) {
            const {
              data: { subscription },
            } = supabase.auth.onAuthStateChange(async (event, session) => {
              if ((event as string) === "SIGNED_UP") {
                return
              }

              // Handle SIGNED_OUT event immediately - don't try to fetch user or preserve state
              if (event === "SIGNED_OUT") {
                const onboardingStatusByUserId = get().onboardingStatusByUserId
                const guestOnboarding = onboardingStatusByUserId[GUEST_USER_KEY] ?? false
                set({
                  session: null,
                  user: null,
                  isAuthenticated: false,
                  isEmailConfirmed: false,
                  hasCompletedOnboarding: guestOnboarding,
                  loading: false,
                })
                return
              }

              // Refresh user data to get latest email confirmation status
              // This is important when email is confirmed from another device/browser
              // Note: Skip getUser() for USER_UPDATED - the session already has updated data
              // and calling getUser() can cause a deadlock with updateUser()
              if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
                try {
                  // Refresh user data to get latest email_confirmed_at
                  const {
                    data: { user: refreshedUser },
                  } = await supabase.auth.getUser()
                  if (refreshedUser) {
                    session.user = refreshedUser
                  }
                } catch (error) {
                  // If refresh fails, continue with existing user data
                  logger.error("Failed to refresh user data", {}, error as Error)
                }
              }

              // If no session, try to get user anyway (user might exist but email not confirmed)
              let user = session?.user ?? null
              if (!user) {
                try {
                  const {
                    data: { user: fetchedUser },
                  } = await supabase.auth.getUser()
                  user = fetchedUser ?? null
                } catch {
                  // If getUser fails, preserve existing user from store (might be in email verification state)
                  const existingUser = get().user
                  if (existingUser) {
                    user = existingUser
                  }
                }
              }

              // Preserve local onboarding state - don't reset it
              const onboardingStatusByUserId = get().onboardingStatusByUserId
              const userKey = getUserKey(user)
              const currentLocalOnboarding = onboardingStatusByUserId[userKey] ?? false
              let hasCompletedOnboarding = currentLocalOnboarding

              if (user && !isUsingMockSupabase) {
                // Only query database if using real Supabase
                const syncedStatus = await syncOnboardingStatus(user.id, currentLocalOnboarding)
                hasCompletedOnboarding = syncedStatus

                // Fetch and apply user preferences on sign in
                fetchAndApplyUserPreferences(user.id).catch((err) => {
                  logger.debug("Failed to fetch user preferences on auth change", { error: err })
                })
              }

              // Check email confirmation status
              const emailConfirmed = isEmailConfirmed(user)
              // Only authenticate if session exists AND email is confirmed
              const shouldAuthenticate = !!session && emailConfirmed

              const stateUpdate = updateUserState(user, session)
              set({
                ...stateUpdate,
                session,
                isAuthenticated: shouldAuthenticate,
                hasCompletedOnboarding,
                onboardingStatusByUserId: {
                  ...onboardingStatusByUserId,
                  [userKey]: hasCompletedOnboarding,
                },
                loading: false,
              })
            })
            authStateSubscription = subscription
          }
        } catch (error) {
          // Provide more helpful error messages for common issues
          if (isNetworkError(error)) {
            const friendlyMessage = getNetworkErrorMessage(error, "Supabase")
            logger.error(
              "Auth initialization failed - network error",
              {
                friendlyMessage,
                supabaseUrl: env.supabaseUrl?.substring(0, 50),
                hint: "Check if your Supabase project is active and the URL is correct",
              },
              error as Error,
            )
          } else {
            logger.error("Auth initialization failed", {}, error as Error)
          }
          set({ loading: false })
        }
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage),
      version: 3,
      // Strip sensitive auth/session data from persisted storage
      partialize: (state) => sanitizePersistedAuthState(state) as unknown as AuthState,
      migrate: (persistedState) => {
        const sanitizedState = sanitizePersistedAuthState(persistedState as Partial<AuthState>)
        const onboardingStatusByUserId = {
          ...sanitizedState.onboardingStatusByUserId,
          [GUEST_USER_KEY]: sanitizedState.onboardingStatusByUserId[GUEST_USER_KEY] ?? true,
        }
        sanitizedState.onboardingStatusByUserId = onboardingStatusByUserId
        try {
          // Overwrite any legacy persisted tokens with the sanitized payload
          const storage = require("../../../utils/storage")
          storage.save(AUTH_STORAGE_KEY, sanitizedState)
        } catch {
          // Ignore storage write errors during migration
        }
        return sanitizedState as AuthState
      },
    },
  ),
)
