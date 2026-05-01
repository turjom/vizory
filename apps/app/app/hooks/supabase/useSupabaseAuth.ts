/**
 * Supabase Auth Hook
 *
 * Provides a unified auth interface for Supabase that matches the app's auth patterns.
 * This wraps the Supabase client to provide a consistent DX similar to Convex hooks.
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { Platform } from "react-native"
import * as _Linking from "expo-linking"
import type { User as SupabaseUser, Session as SupabaseSession } from "@supabase/supabase-js"

import { env } from "../../config/env"
import { supabase } from "../../services/supabase"
import { useAuthStore } from "../../stores/auth"
import { createAppUrl } from "../../utils/appScheme"
import { logger } from "../../utils/Logger"
import { clearOAuthState, consumeOAuthState, createOAuthState } from "../../utils/oauthState"

// ============================================================================
// Platform Imports
// ============================================================================

const getWebBrowser = () => {
  if (Platform.OS === "web") return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-web-browser")
  } catch {
    return null
  }
}

const WebBrowser = getWebBrowser()
if (WebBrowser?.maybeCompleteAuthSession) {
  WebBrowser.maybeCompleteAuthSession()
}

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
  if (Platform.OS === "web") return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as GoogleSigninModule
  } catch {
    return null
  }
}

// ============================================================================
// Types
// ============================================================================

export interface SupabaseAuthState {
  /** Whether the user is authenticated */
  isAuthenticated: boolean
  /** Whether the auth state is loading */
  isLoading: boolean
  /** The current user (null if not authenticated) */
  user: SupabaseUser | null
  /** The current session (null if not authenticated) */
  session: SupabaseSession | null
  /** User ID shortcut */
  userId: string | null
  /** Whether the user's email is verified */
  isEmailVerified: boolean
}

export interface SupabaseAuthActions {
  /** Sign in with email/password */
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>
  /** Sign up with email/password */
  signUpWithPassword: (
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
  updateUser: (attributes: {
    email?: string
    password?: string
    data?: Record<string, unknown>
  }) => Promise<{ error: Error | null }>
}

// ============================================================================
// Helper Functions
// ============================================================================

async function waitForSession(timeoutMs: number): Promise<SupabaseSession | null> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return null
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * useSupabaseAuth - Primary auth hook for Supabase
 *
 * Provides authentication state and actions in a unified interface.
 *
 * @example
 * ```tsx
 * function ProfileScreen() {
 *   const { isAuthenticated, isLoading, user, signOut } = useSupabaseAuth()
 *
 *   if (isLoading) return <Loading />
 *   if (!isAuthenticated) return <SignInPrompt />
 *
 *   return (
 *     <View>
 *       <Text>Hello, {user?.email}</Text>
 *       <Button onPress={signOut} title="Sign Out" />
 *     </View>
 *   )
 * }
 * ```
 */
export function useSupabaseAuth(): SupabaseAuthState & SupabaseAuthActions {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [session, setSession] = useState<SupabaseSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ========================================================================
  // Initialize Auth State
  // ========================================================================

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ========================================================================
  // Derived State
  // ========================================================================

  const isAuthenticated = !!session
  const userId = user?.id ?? null
  const isEmailVerified = !!user?.email_confirmed_at

  // ========================================================================
  // Actions
  // ========================================================================

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error as Error | null }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signUpWithPassword = useCallback(
    async (email: string, password: string, firstName: string, lastName?: string) => {
      setIsLoading(true)
      try {
        const fn = firstName.trim()
        const ln = lastName?.trim() ?? ""
        const data: Record<string, string> = {
          first_name: fn,
          full_name: ln ? `${fn} ${ln}`.trim() : fn,
        }
        if (ln) {
          data.last_name = ln
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data },
        })
        return { error: error as Error | null }
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" })
      return { error: error as Error | null }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      return { error: error as Error | null }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateUser = useCallback(
    async (attributes: { email?: string; password?: string; data?: Record<string, unknown> }) => {
      setIsLoading(true)
      try {
        const { error } = await supabase.auth.updateUser(attributes)
        return { error: error as Error | null }
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const signInWithMagicLink = useCallback(async (email: string) => {
    setIsLoading(true)
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
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      })
      return { error: error as Error | null }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const verifyOtp = useCallback(async (email: string, token: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      })
      if (!error && data?.session) {
        setSession(data.session)
        setUser(data.session.user)
      }
      return { error: error as Error | null }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true)
    try {
      // Native Google Sign-In for mobile
      if (Platform.OS !== "web") {
        const googleModule = getGoogleSigninModule()
        if (googleModule?.GoogleSignin) {
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
            if (errorMessage.includes("cancel") || errorMessage.includes("SIGN_IN_CANCELLED")) {
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

          if (error) return { error: error as Error }

          if (data?.session) {
            setSession(data.session)
            setUser(data.session.user ?? null)
            useAuthStore.getState().setSession(data.session)
          }

          return { error: null }
        }
      }

      // OAuth flow for web or fallback
      const redirectTo =
        Platform.OS === "web"
          ? typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined
          : createAppUrl("auth/callback")
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
        return { error: error as Error }
      }

      // Mobile: Handle OAuth flow via in-app browser
      if (Platform.OS !== "web" && data?.url && WebBrowser) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
        if (result.type === "success" && result.url) {
          await handleOAuthCallback(result.url)
        } else if (result.type === "cancel") {
          clearOAuthState()
          return { error: new Error("OAuth flow cancelled") }
        }
      }

      // Web: Browser will redirect to Google, then back to /auth/callback
      // The AuthCallbackScreen will handle the token exchange
      return { error: null }
    } catch (error) {
      clearOAuthState()
      return { error: error as Error }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signInWithApple = useCallback(async () => {
    setIsLoading(true)
    try {
      const redirectTo =
        Platform.OS === "web"
          ? typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined
          : createAppUrl("auth/callback")
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
        return { error: error as Error }
      }

      // Mobile: Handle OAuth flow via in-app browser
      if (Platform.OS !== "web" && data?.url && WebBrowser) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
        if (result.type === "success" && result.url) {
          await handleOAuthCallback(result.url)
        } else if (result.type === "cancel") {
          clearOAuthState()
          return { error: new Error("OAuth flow cancelled") }
        }
      }

      // Web: Browser will redirect to Apple, then back to /auth/callback
      // The AuthCallbackScreen will handle the token exchange
      return { error: null }
    } catch (error) {
      clearOAuthState()
      return { error: error as Error }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Helper for OAuth callback handling
  const handleOAuthCallback = async (url: string) => {
    const getParam = (name: string) => {
      const regex = new RegExp(`[?&|#]${name}=([^&|#]*)`)
      const match = url.match(regex)
      return match ? decodeURIComponent(match[1]) : null
    }

    const accessToken = getParam("access_token")
    const refreshToken = getParam("refresh_token")
    const code = getParam("code")
    const state = getParam("state")

    if (!consumeOAuthState(state)) {
      throw new Error("Invalid OAuth callback state")
    }

    if (code) {
      const exchangeResult = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeResult.error) {
        logger.error("Failed to exchange code", {}, exchangeResult.error)
        return
      }
      let nextSession = exchangeResult.data?.session
      if (!nextSession) {
        const waitedSession = await waitForSession(10000)
        if (waitedSession) nextSession = waitedSession
      }
      if (nextSession) {
        setSession(nextSession)
        setUser(nextSession.user)
        useAuthStore.getState().setSession(nextSession)
      }
    } else if (accessToken && refreshToken) {
      const { data: sessionData } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (sessionData?.session) {
        setSession(sessionData.session)
        setUser(sessionData.session.user)
        useAuthStore.getState().setSession(sessionData.session)
      }
    }
  }

  // ========================================================================
  // Return
  // ========================================================================

  return useMemo(
    () => ({
      // State
      isAuthenticated,
      isLoading,
      user,
      session,
      userId,
      isEmailVerified,
      // Actions
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      signInWithApple,
      signInWithMagicLink,
      verifyOtp,
      signOut,
      resetPassword,
      updateUser,
    }),
    [
      isAuthenticated,
      isLoading,
      user,
      session,
      userId,
      isEmailVerified,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      signInWithApple,
      signInWithMagicLink,
      verifyOtp,
      signOut,
      resetPassword,
      updateUser,
    ],
  )
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * useSupabaseUser - Get just the current user
 */
export function useSupabaseUser(): SupabaseUser | null {
  const [user, setUser] = useState<SupabaseUser | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return user
}

/**
 * useSupabaseAuthState - Get just the auth state (no actions)
 */
export function useSupabaseAuthState(): Pick<SupabaseAuthState, "isAuthenticated" | "isLoading"> {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { isAuthenticated, isLoading }
}
