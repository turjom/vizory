/**
 * Supabase Auth Store Actions
 *
 * Action methods for Supabase authentication operations
 */

import { Platform } from "react-native"
import * as Linking from "expo-linking"

import { TIMING } from "../../../config/constants"
import { env } from "../../../config/env"
import { queryClient } from "../../../hooks/queries"
import { hasBiometricLoginCredentials } from "../../../services/biometricSessionStorage"
import { supabase, isUsingMockSupabase } from "../../../services/supabase"
import type { Session } from "../../../types/auth"
import { isEmailConfirmed } from "../../../types/auth"
import {
  extractSupabaseError,
  isNetworkError,
  enhanceNetworkError,
} from "../../../types/supabaseErrors"
import { logger } from "../../../utils/Logger"
import {
  authRateLimiter,
  passwordResetRateLimiter,
  signUpRateLimiter,
} from "../../../utils/rateLimiter"
import { useSubscriptionStore } from "../../subscriptionStore"
import type { AuthState } from "../authTypes"
import { getEmailRedirectUrl, getPasswordResetRedirectUrl, updateUserState } from "./authHelpers"

type SetState = (partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)) => void
type GetState = () => AuthState

/**
 * Sign in action
 */
export async function signInAction(
  email: string,
  password: string,
  set: SetState,
): Promise<{ error?: Error; session?: Session | null }> {
  try {
    // Rate limiting check - only count actual API calls, not button clicks
    const isAllowed = await authRateLimiter.isAllowed(`signin:${email.toLowerCase()}`)
    if (!isAllowed) {
      const resetTime = await authRateLimiter.getResetTime(`signin:${email.toLowerCase()}`)
      const minutesRemaining = Math.ceil(resetTime / TIMING.MINUTE_MS)
      return {
        error: new Error(
          `Too many sign-in attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
        ),
      }
    }

    // Make the actual API call - this is what we're rate limiting
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // Note: Rate limit is incremented in isAllowed() above, which happens before the API call
    // This is intentional for security - we want to prevent excessive API calls

    if (error) {
      // Check if error is due to unconfirmed email
      const isEmailNotConfirmedError =
        error.message.toLowerCase().includes("email not confirmed") ||
        error.message.toLowerCase().includes("email_not_confirmed") ||
        error.message.toLowerCase().includes("not confirmed")

      if (isEmailNotConfirmedError && data?.user) {
        // User exists but email not confirmed - set user state but don't authenticate
        set({
          session: null,
          user: data.user,
          isAuthenticated: false,
          isEmailConfirmed: false,
          loading: false,
        })
        // Return error so UI can handle it (navigate to EmailVerification)
        return { error }
      }

      return { error }
    }

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[BiometricFlow] signInAction: password sign-in succeeded", {
        userId: data.user?.id,
        hasSession: !!data.session,
        hasAccessToken: !!data.session?.access_token,
        hasRefreshToken: !!data.session?.refresh_token,
      })
    }

    // Reset rate limit on successful login
    await authRateLimiter.reset(`signin:${email.toLowerCase()}`)

    const stateUpdate = updateUserState(data.user, data.session)
    set({
      ...stateUpdate,
      loading: false,
    })

    return { session: data.session }
  } catch (error) {
    // Enhance network errors with helpful messages
    if (isNetworkError(error)) {
      logger.error("SignIn network error", {
        supabaseUrl: env.supabaseUrl?.substring(0, 50),
        hint: "Check if your Supabase project is active",
      })
      return { error: enhanceNetworkError(error, "Supabase") }
    }
    return { error: error as Error }
  }
}

/**
 * Sign up action
 */
export async function signUpAction(
  email: string,
  password: string,
  set: SetState,
): Promise<{ error?: Error }> {
  try {
    // Check if using real Supabase and validate configuration
    if (!isUsingMockSupabase) {
      const supabaseUrl = env.supabaseUrl || ""
      const supabaseKey = env.supabasePublishableKey || ""

      if (!supabaseUrl || !supabaseKey) {
        logger.warn("Supabase credentials missing but not using mock - this shouldn't happen")
      } else if (__DEV__) {
        // Log configuration for debugging (truncated for security)
        logger.debug("Supabase configuration check", {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
          urlPrefix: supabaseUrl.substring(0, 30) + "...",
          keyPrefix: supabaseKey.substring(0, 10) + "...",
        })
      }
    }

    // Rate limiting check (skip in mock mode for easier development/testing)
    if (!isUsingMockSupabase) {
      const isAllowed = await signUpRateLimiter.isAllowed(`signup:${email.toLowerCase()}`)
      if (!isAllowed) {
        const resetTime = await signUpRateLimiter.getResetTime(`signup:${email.toLowerCase()}`)
        const minutesRemaining = Math.ceil(resetTime / TIMING.MINUTE_MS)
        return {
          error: new Error(
            `Too many sign-up attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
          ),
        }
      }
    }

    // Generate proper redirect URL for email confirmation
    const emailRedirectTo = Platform.OS === "web" ? getEmailRedirectUrl() : undefined

    // Build signUp parameters - pass options only if emailRedirectTo is set
    const signUpParams: Parameters<typeof supabase.auth.signUp>[0] = {
      email,
      password,
    }

    if (emailRedirectTo) {
      signUpParams.options = { emailRedirectTo }
    }

    let data, error
    try {
      const result = await supabase.auth.signUp(signUpParams)
      data = result.data
      error = result.error

      // Log for debugging - include FULL error details
      if (__DEV__) {
        if (error) {
          const supabaseError = extractSupabaseError(error)
          logger.debug("SignUp error from Supabase", {
            errorMessage: error.message,
            errorStatus: supabaseError?.status,
            errorName: supabaseError?.name,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            isUsingMock: isUsingMockSupabase,
            hasEmailRedirectTo: !!emailRedirectTo,
            platform: Platform.OS,
            supabaseUrl: env.supabaseUrl ? env.supabaseUrl.substring(0, 30) + "..." : undefined,
          })
        } else {
          logger.debug("SignUp success", {
            hasUser: !!data?.user,
            hasSession: !!data?.session,
            isUsingMock: isUsingMockSupabase,
            hasEmailRedirectTo: !!emailRedirectTo,
          })
        }
      }
    } catch (signUpError) {
      // Handle network errors with helpful messages
      if (isNetworkError(signUpError)) {
        logger.error("SignUp network error", {
          supabaseUrl: env.supabaseUrl?.substring(0, 50),
          hint: "Check if your Supabase project is active",
          isUsingMock: isUsingMockSupabase,
          platform: Platform.OS,
        })
        return { error: enhanceNetworkError(signUpError, "Supabase") }
      }

      // Log other errors with details
      logger.error(
        "SignUp failed with exception",
        {
          errorType: signUpError?.constructor?.name,
          isUsingMock: isUsingMockSupabase,
          platform: Platform.OS,
        },
        signUpError as Error,
      )

      return { error: signUpError as Error }
    }

    if (error) {
      // Check for network errors and enhance the message
      if (isNetworkError(error)) {
        logger.error("SignUp network error from Supabase response", {
          supabaseUrl: env.supabaseUrl?.substring(0, 50),
          hint: "Check if your Supabase project is active",
          isUsingMock: isUsingMockSupabase,
          platform: Platform.OS,
        })
        return { error: enhanceNetworkError(error, "Supabase") }
      }
      return { error }
    }

    // Reset rate limit on successful signup (only if rate limiting was applied)
    if (!isUsingMockSupabase) {
      await signUpRateLimiter.reset(`signup:${email.toLowerCase()}`)
    }

    // Check if email is confirmed (may be null if email confirmation is required)
    const emailConfirmed = isEmailConfirmed(data.user)
    // Only authenticate if session exists AND email is confirmed
    // If email confirmation is required, session may be null
    const shouldAuthenticate = !!data.session && emailConfirmed

    const stateUpdate = updateUserState(data.user, data.session)
    set({
      ...stateUpdate,
      isAuthenticated: shouldAuthenticate,
      loading: false,
    })

    return {}
  } catch (error) {
    return { error: error as Error }
  }
}

/**
 * Resend confirmation email action
 */
export async function resendConfirmationEmailAction(email: string): Promise<{ error?: Error }> {
  try {
    // Validate email
    if (!email || !email.trim()) {
      return { error: new Error("Email is required") }
    }

    const trimmedEmail = email.trim()

    // Generate proper redirect URL for email confirmation
    const emailRedirectTo = Platform.OS === "web" ? getEmailRedirectUrl() : undefined

    // Build the resend options
    const resendOptions: {
      type: "signup"
      email: string
      options?: { emailRedirectTo: string }
    } = {
      type: "signup",
      email: trimmedEmail,
    }

    // Only add emailRedirectTo if it's defined
    if (emailRedirectTo) {
      resendOptions.options = { emailRedirectTo }
    }

    // Call Supabase resend method
    // Note: This works even if the user is authenticated but email is not confirmed
    const { data, error } = await supabase.auth.resend(resendOptions)

    // Log for debugging
    if (__DEV__) {
      if (error) {
        const supabaseError = extractSupabaseError(error)
        logger.error("Failed to resend confirmation email", {
          error: error.message || error,
          email: trimmedEmail,
          code: supabaseError?.code,
          status: supabaseError?.status,
        })
      } else {
        logger.info("Confirmation email resent successfully", { email: trimmedEmail, data })
      }
    }

    if (error) {
      // Check for network errors first
      if (isNetworkError(error)) {
        return { error: enhanceNetworkError(error, "Supabase") }
      }

      // Provide more helpful error messages
      let errorMessage = error.message || "Failed to resend email. Please try again."

      // Handle specific Supabase error cases
      const supabaseError = extractSupabaseError(error)
      if (error.message?.includes("rate limit") || supabaseError?.code === "rate_limit_exceeded") {
        errorMessage = "Too many requests. Please wait a moment before trying again."
      } else if (error.message?.includes("not found") || supabaseError?.code === "user_not_found") {
        errorMessage = "No account found with this email address."
      } else if (error.message?.includes("already confirmed")) {
        errorMessage = "This email has already been confirmed."
      }

      return { error: new Error(errorMessage) }
    }

    return {}
  } catch (error) {
    // Enhance network errors with helpful messages
    if (isNetworkError(error)) {
      return { error: enhanceNetworkError(error, "Supabase") }
    }
    logger.error("Error in resendConfirmationEmail", { error, email })
    return { error: error as Error }
  }
}

/**
 * Verify email action
 */
export async function verifyEmailAction(code: string, set: SetState): Promise<{ error?: Error }> {
  try {
    // Supabase confirmation links provide token_hash; try signup first, then email as fallback.
    const tryVerify = async (type: "signup" | "email") => {
      return supabase.auth.verifyOtp({
        token_hash: code,
        type,
      })
    }

    let response = await tryVerify("signup")

    // Fallback to "email" for older templates or email-change flows
    if (response.error) {
      response = await tryVerify("email")
    }

    const { data, error } = response

    if (error) {
      // Enhance network errors with helpful messages
      if (isNetworkError(error)) {
        return { error: enhanceNetworkError(error, "Supabase") }
      }
      return { error }
    }

    // Update auth state after email verification
    const stateUpdate = updateUserState(data.user, data.session)
    set({
      ...stateUpdate,
      loading: false,
    })

    return {}
  } catch (error) {
    // Enhance network errors with helpful messages
    if (isNetworkError(error)) {
      return { error: enhanceNetworkError(error, "Supabase") }
    }
    return { error: error as Error }
  }
}

/**
 * Sign out action
 */
export async function signOutAction(
  get: GetState,
  set: SetState,
  guestUserKey: string,
): Promise<void> {
  try {
    // `global` revokes refresh tokens for the user on the server. The same refresh value is
    // stored in the biometric vault for Touch ID, so a global sign-out makes that copy
    // unusable (`refresh_session` → "Refresh Token Not Found").
    // `local` ends this client session only (Supabase-recommended default for single-device UX).
    await supabase.auth.signOut({ scope: "local" })
  } catch (error) {
    logger.warn("Sign out request failed, clearing local session anyway", { error })
  }
  queryClient.clear()
  const subscriptionState = useSubscriptionStore.getState()
  subscriptionState.setCustomerInfo(null)
  subscriptionState.setWebSubscriptionInfo(null)
  subscriptionState.setPackages([])
  subscriptionState.checkProStatus()
  const guestOnboarding = get().onboardingStatusByUserId[guestUserKey] ?? false
  set({
    session: null,
    user: null,
    isAuthenticated: false,
    isEmailConfirmed: false,
    hasCompletedOnboarding: guestOnboarding,
  })

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      "[BiometricFlow] signOutAction: used scope=local; biometric vault (stored password) unchanged after sign-out",
    )
    try {
      const stillHasVault = await hasBiometricLoginCredentials()
      // eslint-disable-next-line no-console
      console.log("[BiometricFlow] signOutAction: hasBiometricLoginCredentials after sign-out", {
        stillHasVault,
      })
    } catch (vaultErr) {
      // eslint-disable-next-line no-console
      console.warn("[BiometricFlow] signOutAction: could not read biometric vault", vaultErr)
    }
  }
}

/**
 * Reset password action
 */
export async function resetPasswordAction(email: string): Promise<{ error?: Error }> {
  try {
    // Rate limiting check
    const isAllowed = await passwordResetRateLimiter.isAllowed(`reset:${email.toLowerCase()}`)
    if (!isAllowed) {
      const resetTime = await passwordResetRateLimiter.getResetTime(`reset:${email.toLowerCase()}`)
      const minutesRemaining = Math.ceil(resetTime / TIMING.MINUTE_MS)
      return {
        error: new Error(
          `Too many password reset attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
        ),
      }
    }

    const redirectTo =
      getPasswordResetRedirectUrl() ??
      (Platform.OS !== "web" && process.env.NODE_ENV !== "test"
        ? Linking.createURL("/reset-password")
        : undefined)

    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    )

    if (error) {
      // Enhance network errors with helpful messages
      if (isNetworkError(error)) {
        return { error: enhanceNetworkError(error, "Supabase") }
      }
      return { error }
    }

    // Don't reset rate limit on success - allow server to handle email sending rate limits

    return {}
  } catch (error) {
    // Enhance network errors with helpful messages
    if (isNetworkError(error)) {
      logger.error("Password reset network error", {
        supabaseUrl: env.supabaseUrl?.substring(0, 50),
        hint: "Check if your Supabase project is active",
      })
      return { error: enhanceNetworkError(error, "Supabase") }
    }
    return { error: error as Error }
  }
}
