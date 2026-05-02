/**
 * Account Deletion Service
 *
 * Handles user account deletion across different backends.
 * - Supabase: Uses Edge Functions for secure server-side deletion
 * - Convex: Uses Convex mutations for deletion
 */

import { isSupabase } from "@/config/env"
import { useAuthStore, useSubscriptionStore } from "@/stores"
import { GUEST_USER_KEY } from "@/stores/auth"
import type { AuthState } from "@/stores/auth/authTypes"
import type { Session } from "@/types/auth"

import { clearBiometricSessionTokens } from "./biometricSessionStorage"
import { mockSupabaseHelpers } from "./mocks/supabase"
import { logger } from "../utils/Logger"

// Conditionally import Supabase - only when using Supabase backend
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase, supabaseKey, supabaseUrl, isUsingMockSupabase } = isSupabase
  ? require("./supabase")
  : { supabase: null, supabaseKey: null, supabaseUrl: null, isUsingMockSupabase: true }

// Convex removed - using Supabase only
const _convexClient = null

const DELETE_TIMEOUT_MS = 10_000

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs = DELETE_TIMEOUT_MS,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function deleteProfileRow(userId: string) {
  const { error } = await supabase.from("profiles").delete().eq("id", userId)
  if (error) {
    throw error
  }
}

async function deleteSupabaseAccount(session: Session, userId: string) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase is not configured for account deletion")
  }

  try {
    // Try using Supabase client's functions.invoke() which handles auth properly
    logger.debug("Invoking delete-user edge function via Supabase client")
    const { data, error: functionError } = await supabase.functions.invoke("delete-user", {
      body: { userId },
    })

    if (!functionError && data?.success) {
      logger.debug("Edge function deleted user successfully")
      return
    }

    if (functionError) {
      logger.warn("Edge function invocation failed", {
        error: functionError.message,
        context: functionError.context,
      })
    } else if (data && !data.success) {
      logger.warn("Edge function returned error", { data })
    }

    // Fallback: try deleting profile row first
    logger.debug("Falling back to direct deletion")
    try {
      await deleteProfileRow(userId)
      logger.debug("Profile row deleted successfully")
    } catch (error) {
      logger.warn("Failed to delete profile row before auth deletion", { error })
    }

    // Fallback to direct Supabase Auth delete endpoint
    // Note: This requires the user to have permission to delete themselves
    // which is typically not enabled by default in Supabase
    logger.debug("Attempting direct auth deletion", {
      url: `${supabaseUrl}/auth/v1/user`,
      hasAccessToken: !!session.access_token,
    })

    const response = await fetchWithTimeout(`${supabaseUrl}/auth/v1/user`, {
      method: "DELETE",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    logger.debug("Direct auth deletion response", {
      status: response.status,
      ok: response.ok,
    })

    if (response.ok) {
      logger.debug("Direct auth deletion succeeded")
      return
    }

    let message = `Account deletion failed (${response.status})`
    let errorBody: Record<string, unknown> | null = null
    try {
      errorBody = await response.json()
      message = (errorBody?.error_description ||
        errorBody?.message ||
        errorBody?.error ||
        message) as string
    } catch {
      // Ignore JSON parsing errors
    }

    logger.error("Direct auth deletion failed", {
      status: response.status,
      errorBody,
      message,
    })

    throw new Error(message)
  } catch (error) {
    throw error instanceof Error ? error : new Error("Unable to delete account")
  }
}

async function clearSubscriptionState() {
  const subscriptionState = useSubscriptionStore.getState()

  try {
    const service = subscriptionState.getActiveService()
    await service.logOut()
  } catch (error) {
    logger.warn("Failed to log out of subscription service", { error })
  }

  subscriptionState.setCustomerInfo(null)
  subscriptionState.setWebSubscriptionInfo(null)
  subscriptionState.setPackages([])
  subscriptionState.checkProStatus()
}

function resetAuthState(userId: string) {
  useAuthStore.setState((state: AuthState) => {
    // Remove onboarding entry for the deleted user while preserving guest state
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [userId]: _removed, ...onboardingStatusByUserId } = state.onboardingStatusByUserId
    const guestOnboarding =
      onboardingStatusByUserId[GUEST_USER_KEY] ?? state.onboardingStatusByUserId[GUEST_USER_KEY]
    return {
      session: null,
      user: null,
      isAuthenticated: false,
      hasCompletedOnboarding: guestOnboarding ?? true,
      onboardingStatusByUserId: {
        ...onboardingStatusByUserId,
        [GUEST_USER_KEY]: guestOnboarding ?? true,
      },
      loading: false,
    }
  })
}

export async function deleteAccount(): Promise<{ error?: Error }> {
  const authState = useAuthStore.getState()
  const { user, session: cachedSession } = authState

  if (!user) {
    return { error: new Error("No active user to delete") }
  }

  const userId = user.id

  useAuthStore.setState({ loading: true })

  try {
    logger.debug("Starting account deletion", { userId })

    // Use cached session first, then try to get/refresh if needed
    let session = cachedSession

    // If no cached session or missing access token, get from Supabase
    if (!session?.access_token) {
      logger.debug("No cached session, fetching from Supabase")
      try {
        const { data, error: getError } = await supabase.auth.getSession()
        if (getError) {
          logger.warn("getSession failed", { error: getError.message })
        }
        session = data?.session ?? null
      } catch (e) {
        logger.warn("getSession threw exception", { error: e })
      }
    }

    // If still no valid session, try refreshing (this forces a fresh token)
    if (!session?.access_token) {
      logger.debug("Attempting session refresh")
      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          logger.error("refreshSession failed", { error: refreshError.message })
          throw refreshError
        }
        session = data?.session ?? null
      } catch (e) {
        logger.error("refreshSession threw exception", { error: e })
        throw e
      }
    }

    if (!session?.access_token) {
      throw new Error("Unable to verify your session. Please sign in again.")
    }

    logger.debug("Session obtained, proceeding with deletion")

    // Delete user data first
    if (isUsingMockSupabase) {
      const removed = await mockSupabaseHelpers.deleteUser(userId)
      if (!removed) {
        throw new Error("Unable to delete mock account")
      }
    } else {
      await deleteSupabaseAccount(session as Session, userId)
    }

    // Clear subscription state (ignore errors - user is already deleted)
    try {
      await clearSubscriptionState()
    } catch (subscriptionError) {
      logger.warn("Failed to clear subscription state during account deletion", {
        error: subscriptionError,
      })
    }

    // Sign out from Supabase (ignore errors - user is already deleted)
    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch (signOutError) {
      logger.warn("Failed to sign out during account deletion", { error: signOutError })
    }

    try {
      await clearBiometricSessionTokens()
    } catch (clearBiometricError) {
      logger.warn("Failed to clear biometric session storage during account deletion", {
        error: clearBiometricError,
      })
    }

    // Reset auth state - this is critical and should always happen
    resetAuthState(userId)

    return {}
  } catch (error) {
    logger.error(
      "Account deletion failed",
      {},
      error instanceof Error ? error : new Error(String(error)),
    )
    return {
      error: error instanceof Error ? error : new Error("Unable to delete account"),
    }
  } finally {
    // Always ensure loading is set to false
    useAuthStore.setState({ loading: false })
  }
}
