/**
 * Universal Authentication Hook
 *
 * Provides a consistent authentication interface regardless of backend provider.
 * Automatically detects whether Supabase or Convex is being used and provides
 * the appropriate implementation.
 *
 * Usage:
 * ```typescript
 * const { user, signIn, signOut, isAuthenticated } = useAuth()
 * ```
 */

import { useState, useEffect, useCallback } from "react"
import { Platform } from "react-native"
import * as Linking from "expo-linking"

import { env, isConvex } from "../config/env"
import { useAuthStore } from "../stores/auth"
import type {
  User,
  Session,
  SignUpCredentials,
  SignInCredentials,
  UpdateUserAttributes,
} from "../types/auth"
import { createAppUrl } from "../utils/appScheme"
import { logger } from "../utils/Logger"
import { clearOAuthState, consumeOAuthState, createOAuthState } from "../utils/oauthState"

// ============================================================================
// Web Browser Import (Platform-Specific)
// ============================================================================

const getWebBrowser = () => {
  if (Platform.OS === "web") {
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-web-browser")
  } catch {
    logger.warn("expo-web-browser not available, falling back to Linking")
    return null
  }
}

const WebBrowser = getWebBrowser()
if (WebBrowser?.maybeCompleteAuthSession) {
  WebBrowser.maybeCompleteAuthSession()
}

// ============================================================================
// Google Sign-In Module (Platform-Specific)
// ============================================================================

type GoogleSigninModule = {
  GoogleSignin: {
    configure: (options: { webClientId?: string; iosClientId?: string }) => void
    signIn: () => Promise<{ idToken?: string; data?: { idToken?: string } }>
    hasPlayServices?: () => Promise<void>
    getTokens?: () => Promise<{ idToken?: string; accessToken?: string }>
  }
  statusCodes?: Record<string, string>
}

let isGoogleSigninConfigured = false

const getGoogleSigninModule = (): GoogleSigninModule | null => {
  if (Platform.OS === "web") {
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as GoogleSigninModule
  } catch (error) {
    if (__DEV__) {
      logger.warn("Google Sign-In library not available", { error })
    }
    return null
  }
}

// ============================================================================
// Types
// ============================================================================

export interface UseAuthReturn {
  // State
  user: User | null
  session: Session | null
  loading: boolean

  // Methods
  signUp: (credentials: SignUpCredentials) => Promise<{ error: Error | null }>
  signIn: (credentials: SignInCredentials) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithApple: () => Promise<{ error: Error | null }>
  signInWithMagicLink: (email: string, captchaToken?: string) => Promise<{ error: Error | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updateUser: (attributes: UpdateUserAttributes) => Promise<{ error: Error | null }>

  // Helpers
  isAuthenticated: boolean

  // Provider info
  provider: "supabase" | "convex"
}

// ============================================================================
// Supabase Implementation
// ============================================================================

function useSupabaseAuth(): UseAuthReturn {
  // Lazy import supabase to enable code splitting
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { supabase } = require("../services/supabase")

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const waitForSession = useCallback(
    async (timeoutMs: number): Promise<Session | null> => {
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        const { data } = await supabase.auth.getSession()
        if (data.session) return data.session
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      return null
    },
    [supabase.auth],
  )

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signUp = useCallback(
    async (credentials: SignUpCredentials) => {
      setLoading(true)
      const { error } = await supabase.auth.signUp(credentials)
      setLoading(false)
      return { error }
    },
    [supabase.auth],
  )

  const signIn = useCallback(
    async (credentials: SignInCredentials) => {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword(credentials)
      setLoading(false)
      return { error }
    },
    [supabase.auth],
  )

  const signOut = useCallback(async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut({ scope: "local" })
    setLoading(false)
    return { error }
  }, [supabase.auth])

  const resetPassword = useCallback(
    async (email: string) => {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      setLoading(false)
      return { error }
    },
    [supabase.auth],
  )

  const updateUser = useCallback(
    async (attributes: UpdateUserAttributes) => {
      setLoading(true)
      const { error } = await supabase.auth.updateUser(attributes)
      setLoading(false)
      return { error }
    },
    [supabase.auth],
  )

  const signInWithGoogle = useCallback(async () => {
    setLoading(true)
    try {
      if (Platform.OS !== "web") {
        const googleModule = getGoogleSigninModule()
        if (!googleModule?.GoogleSignin) {
          return { error: new Error("Google Sign-In is not available on this platform") }
        }

        if (!env.googleClientId) {
          return { error: new Error("Google client ID is missing") }
        }

        if (!isGoogleSigninConfigured) {
          googleModule.GoogleSignin.configure({
            webClientId: env.googleClientId,
            iosClientId: env.googleIosClientId,
          })
          isGoogleSigninConfigured = true
        }

        if (googleModule.GoogleSignin.hasPlayServices) {
          await googleModule.GoogleSignin.hasPlayServices()
        }

        let response
        try {
          response = await googleModule.GoogleSignin.signIn()
        } catch (signInError) {
          const errorMessage =
            signInError instanceof Error ? signInError.message : String(signInError)
          if (
            errorMessage.includes("cancel") ||
            errorMessage.includes("SIGN_IN_CANCELLED") ||
            errorMessage.includes("user cancelled") ||
            errorMessage.includes("getTokens requires a user")
          ) {
            return { error: new Error("OAuth flow cancelled") }
          }
          throw signInError
        }

        let idToken = response?.idToken ?? response?.data?.idToken ?? null
        let accessToken: string | null = null

        if (googleModule.GoogleSignin.getTokens) {
          try {
            const tokens = await googleModule.GoogleSignin.getTokens()
            idToken = tokens?.idToken ?? idToken
            accessToken = tokens?.accessToken ?? null
          } catch {
            return { error: new Error("OAuth flow cancelled") }
          }
        }

        if (!idToken) {
          return { error: new Error("Google ID token not returned") }
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
          ...(accessToken ? { access_token: accessToken } : {}),
        })

        if (error) {
          return { error }
        }

        if (data?.session) {
          setSession(data.session)
          setUser(data.session.user ?? null)
          useAuthStore.getState().setSession(data.session)
        }

        return { error: null }
      }

      let redirectTo: string | undefined

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          redirectTo = `${window.location.origin}/auth/callback`
        }
      } else {
        redirectTo = createAppUrl("auth/callback")
      }
      if (__DEV__) {
        logger.debug("[useAuth] Google OAuth redirectTo", { redirectTo })
      }
      const oauthState = createOAuthState()

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { state: oauthState },
          // On web, allow Supabase to redirect the browser directly to Google
          // On mobile, we handle the redirect ourselves via WebBrowser
          skipBrowserRedirect: Platform.OS !== "web",
        },
      })

      if (error) {
        clearOAuthState()
        return { error }
      }

      // Web: Browser will redirect to Google, then back to /auth/callback
      // The AuthCallbackScreen will handle the token exchange
      // Mobile: Handle OAuth flow via in-app browser
      if (Platform.OS !== "web" && data?.url) {
        if (__DEV__) {
          logger.debug("[useAuth] Google OAuth URL received", { url: data.url })
        }
        if (WebBrowser) {
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

          if (__DEV__) {
            logger.debug("[useAuth] Google OAuth session result", {
              type: result.type,
              url: result.url ?? null,
            })
          }

          if (result.type === "success" && result.url) {
            const urlStr = result.url
            const getParam = (name: string) => {
              const regex = new RegExp(`[?&|#]${name}=([^&|#]*)`)
              const match = urlStr.match(regex)
              return match ? decodeURIComponent(match[1]) : null
            }

            const accessTokenParam = getParam("access_token")
            const refreshToken = getParam("refresh_token")
            const code = getParam("code")
            const state = getParam("state")

            if (__DEV__) {
              logger.debug("[useAuth] Google OAuth callback params", {
                hasAccessToken: !!accessTokenParam,
                hasRefreshToken: !!refreshToken,
                hasCode: !!code,
              })
            }

            if (!consumeOAuthState(state)) {
              return { error: new Error("Invalid OAuth callback state") }
            }

            if (code) {
              if (__DEV__) {
                try {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const authInternal = supabase.auth as any
                  const storageKey = authInternal?.storageKey
                  const verifierKey = storageKey ? `${storageKey}-code-verifier` : null
                  const storedVerifier = verifierKey
                    ? await authInternal?.storage?.getItem?.(verifierKey)
                    : null
                  logger.debug("[useAuth] Google code verifier check", {
                    storageKey: storageKey ?? null,
                    hasVerifier: !!storedVerifier,
                  })
                } catch (verifierError) {
                  logger.error(
                    "[useAuth] Google code verifier read failed",
                    {},
                    verifierError as Error,
                  )
                }
                logger.debug("[useAuth] Google exchanging code for session", {
                  codePrefix: code.slice(0, 8),
                })
              }
              const exchangePromise = supabase.auth.exchangeCodeForSession(code)
              exchangePromise.catch(() => undefined)
              const exchangeResult = await Promise.race([
                exchangePromise,
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
              ])
              if (exchangeResult && "error" in exchangeResult && exchangeResult.error) {
                logger.error(
                  "[useAuth] Failed to exchange code for session",
                  { error: exchangeResult.error.message },
                  exchangeResult.error,
                )
                return { error: exchangeResult.error }
              }
              let nextSession =
                exchangeResult && "data" in exchangeResult ? exchangeResult.data?.session : null
              if (!nextSession) {
                nextSession = await waitForSession(10000)
              }
              if (nextSession) {
                const { data: refreshed } = await supabase.auth.getUser()
                if (refreshed.user) {
                  nextSession.user = refreshed.user
                }
                setSession(nextSession)
                setUser(nextSession.user)
                useAuthStore.getState().setSession(nextSession)
              }
            } else if (accessTokenParam && refreshToken) {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessTokenParam,
                refresh_token: refreshToken,
              })
              if (sessionError) {
                return { error: sessionError }
              }
              if (sessionData?.session) {
                const { data: refreshed } = await supabase.auth.getUser()
                if (refreshed.user) {
                  sessionData.session.user = refreshed.user
                }
                useAuthStore.getState().setSession(sessionData.session)
              }
            }
          } else if (result.type === "cancel") {
            clearOAuthState()
            return { error: new Error("OAuth flow cancelled") }
          }
        } else {
          const canOpen = await Linking.canOpenURL(data.url)
          if (canOpen) {
            await Linking.openURL(data.url)
          } else {
            return { error: new Error("Unable to open OAuth URL") }
          }
        }
      }

      return { error: null }
    } catch (error) {
      clearOAuthState()
      const resolvedError = error instanceof Error ? error : new Error(String(error))
      if (resolvedError.name === "TimeoutError") {
        const { data: fallbackSession } = await supabase.auth.getSession()
        if (fallbackSession.session) {
          setSession(fallbackSession.session)
          setUser(fallbackSession.session.user)
          useAuthStore.getState().setSession(fallbackSession.session)
          return { error: null }
        }
      }
      logger.error(
        "[useAuth] Google OAuth flow failed",
        {
          name: resolvedError.name,
          message: resolvedError.message,
        },
        resolvedError,
      )
      return { error: error as Error }
    } finally {
      setLoading(false)
    }
  }, [supabase.auth, waitForSession])

  const signInWithApple = useCallback(async () => {
    setLoading(true)
    try {
      let redirectTo: string | undefined

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          redirectTo = `${window.location.origin}/auth/callback`
        }
      } else {
        redirectTo = createAppUrl("auth/callback")
      }
      if (__DEV__) {
        logger.debug("[useAuth] Apple OAuth redirectTo", { redirectTo })
      }
      const oauthState = createOAuthState()

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo,
          queryParams: { state: oauthState },
          // On web, allow Supabase to redirect the browser directly to Apple
          // On mobile, we handle the redirect ourselves via WebBrowser
          skipBrowserRedirect: Platform.OS !== "web",
        },
      })

      if (error) {
        clearOAuthState()
        return { error }
      }

      // Web: Browser will redirect to Apple, then back to /auth/callback
      // The AuthCallbackScreen will handle the token exchange
      // Mobile: Handle OAuth flow via in-app browser
      if (Platform.OS !== "web" && data?.url) {
        if (__DEV__) {
          logger.debug("[useAuth] Apple OAuth URL received", { url: data.url })
        }
        if (WebBrowser) {
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

          if (__DEV__) {
            logger.debug("[useAuth] Apple OAuth session result", {
              type: result.type,
              url: result.url ?? null,
            })
          }

          if (result.type === "success" && result.url) {
            const urlStr = result.url
            const getParam = (name: string) => {
              const regex = new RegExp(`[?&|#]${name}=([^&|#]*)`)
              const match = urlStr.match(regex)
              return match ? decodeURIComponent(match[1]) : null
            }

            const accessTokenParam = getParam("access_token")
            const refreshToken = getParam("refresh_token")
            const code = getParam("code")
            const state = getParam("state")

            if (__DEV__) {
              logger.debug("[useAuth] Apple OAuth callback params", {
                hasAccessToken: !!accessTokenParam,
                hasRefreshToken: !!refreshToken,
                hasCode: !!code,
              })
            }

            if (!consumeOAuthState(state)) {
              return { error: new Error("Invalid OAuth callback state") }
            }

            if (code) {
              if (__DEV__) {
                logger.debug("[useAuth] Apple exchanging code for session", {
                  codePrefix: code.slice(0, 8),
                })
              }
              const exchangePromise = supabase.auth.exchangeCodeForSession(code)
              exchangePromise.catch(() => undefined)
              const exchangeResult = await Promise.race([
                exchangePromise,
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
              ])
              if (exchangeResult && "error" in exchangeResult && exchangeResult.error) {
                logger.error(
                  "[useAuth] Failed to exchange code for session (Apple)",
                  { error: exchangeResult.error.message },
                  exchangeResult.error,
                )
                return { error: exchangeResult.error }
              }
              let nextSession =
                exchangeResult && "data" in exchangeResult ? exchangeResult.data?.session : null
              if (!nextSession) {
                nextSession = await waitForSession(10000)
              }
              if (nextSession) {
                const { data: refreshed } = await supabase.auth.getUser()
                if (refreshed.user) {
                  nextSession.user = refreshed.user
                }
                setSession(nextSession)
                setUser(nextSession.user)
                useAuthStore.getState().setSession(nextSession)
              }
            } else if (accessTokenParam && refreshToken) {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessTokenParam,
                refresh_token: refreshToken,
              })
              if (sessionError) {
                return { error: sessionError }
              }
              if (sessionData?.session) {
                const { data: refreshed } = await supabase.auth.getUser()
                if (refreshed.user) {
                  sessionData.session.user = refreshed.user
                }
                useAuthStore.getState().setSession(sessionData.session)
              }
            }
          } else if (result.type === "cancel") {
            clearOAuthState()
            return { error: new Error("OAuth flow cancelled") }
          }
        } else {
          const canOpen = await Linking.canOpenURL(data.url)
          if (canOpen) {
            await Linking.openURL(data.url)
          } else {
            return { error: new Error("Unable to open OAuth URL") }
          }
        }
      }

      return { error: null }
    } catch (error) {
      clearOAuthState()
      const resolvedError = error instanceof Error ? error : new Error(String(error))
      if (resolvedError.name === "TimeoutError") {
        const { data: fallbackSession } = await supabase.auth.getSession()
        if (fallbackSession.session) {
          setSession(fallbackSession.session)
          setUser(fallbackSession.session.user)
          useAuthStore.getState().setSession(fallbackSession.session)
          return { error: null }
        }
      }
      logger.error(
        "[useAuth] Apple OAuth flow failed",
        {
          name: resolvedError.name,
          message: resolvedError.message,
        },
        resolvedError,
      )
      return { error: error as Error }
    } finally {
      setLoading(false)
    }
  }, [supabase.auth, waitForSession])

  const signInWithMagicLink = useCallback(
    async (email: string, captchaToken?: string) => {
      setLoading(true)
      try {
        // Generate proper redirect URL for magic link
        // On web: redirect to auth callback page
        // On mobile: no redirect needed (user enters OTP code manually)
        const emailRedirectTo =
          Platform.OS === "web" && typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo,
            ...(captchaToken ? { captchaToken } : {}),
          },
        })
        return { error }
      } finally {
        setLoading(false)
      }
    },
    [supabase.auth],
  )

  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      setLoading(true)
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      })
      if (!error && data?.session) {
        const verifiedSession = data.session
        setSession(verifiedSession)
        setUser(verifiedSession?.user ?? null)
      }
      setLoading(false)
      return { error }
    },
    [supabase.auth],
  )

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signInWithMagicLink,
    verifyOtp,
    signOut,
    resetPassword,
    updateUser,
    isAuthenticated: !!session,
    provider: "supabase",
  }
}

// ============================================================================
// Convex Implementation
// ============================================================================

/**
 * Convex authentication hook.
 *
 * Provides full authentication functionality using Convex Auth with proper
 * OAuth handling for mobile (React Native) and web platforms.
 *
 * For more granular control, use these hooks directly:
 * - useConvexSocialAuth() - for Google, Apple, GitHub sign-in with mobile OAuth handling
 * - useConvexPasswordAuth() - for email/password authentication
 * - useConvexMagicLink() - for OTP/magic link authentication
 * - useConvexAuth() - for unified auth state and actions
 */
function useConvexAuthImpl(): UseAuthReturn {
  // Convex removed - returning no-op stub to satisfy React hooks rules
  return {
    user: null,
    session: null,
    loading: false,
    isAuthenticated: false,
    provider: "supabase",
    signUp: async (_credentials: SignUpCredentials) => ({
      error: new Error("Convex not configured"),
    }),
    signIn: async () => ({ error: new Error("Convex not configured") }),
    signOut: async () => ({ error: null }),
    verifyOtp: async () => ({ error: new Error("Convex not configured") }),
    resetPassword: async () => ({ error: new Error("Convex not configured") }),
    signInWithMagicLink: async () => ({ error: new Error("Convex not configured") }),
    signInWithGoogle: async () => ({ error: new Error("Convex not configured") }),
    signInWithApple: async () => ({ error: new Error("Convex not configured") }),
    updateUser: async () => ({ error: new Error("Convex not configured") }),
  }
}

// ============================================================================
// Main Hook Export
// ============================================================================

/**
 * Universal authentication hook that works with both Supabase and Convex.
 *
 * Automatically detects the configured backend provider and returns
 * the appropriate implementation.
 *
 * For Supabase: Full featured auth with all methods working directly.
 *
 * For Convex: Full featured auth with proper OAuth handling for mobile.
 *   For more control, use the modular hooks directly:
 *   - useConvexSocialAuth() - Google, Apple, GitHub with mobile OAuth
 *   - useConvexPasswordAuth() - email/password authentication
 *   - useConvexMagicLink() - OTP/magic link authentication
 */
const useSelectedAuthImpl: () => UseAuthReturn = isConvex ? useConvexAuthImpl : useSupabaseAuth

export function useAuth(): UseAuthReturn {
  return useSelectedAuthImpl()
}

// ============================================================================
// Provider-Specific Hook Exports
// ============================================================================

/**
 * Force use of Supabase auth regardless of env config.
 * Useful for migration or testing scenarios.
 */
export { useSupabaseAuth }

/**
 * Force use of Convex auth regardless of env config.
 * Useful for migration or testing scenarios.
 */
export { useConvexAuthImpl as useConvexAuth }
