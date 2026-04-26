import { useEffect, useState } from "react"
import { Platform, View, TouchableOpacity } from "react-native"
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native"
import { useTranslation } from "react-i18next"
import { StyleSheet } from "react-native-unistyles"

import { AuthScreenLayout } from "@/components/layouts/AuthScreenLayout"
import { Text } from "@/components/Text"
import { isConvex, isSupabase } from "@/config/env"
import type { AppStackParamList, AppStackScreenProps } from "@/navigators/navigationTypes"
import { LoadingScreen } from "@/screens/LoadingScreen"
import { useAuthStore } from "@/stores/auth"
import { formatAuthError } from "@/utils/formatAuthError"
import { logger } from "@/utils/Logger"
import { consumeOAuthState } from "@/utils/oauthState"

/**
 * Parse OAuth tokens from URL hash fragment (web only)
 * Supabase OAuth returns tokens in the hash: #access_token=...&refresh_token=...
 */
function getHashParams(): {
  access_token?: string
  refresh_token?: string
  code?: string
  state?: string
} {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return {}
  }

  const hash = window.location.hash.substring(1) // Remove the leading '#'
  if (!hash) return {}

  const params: Record<string, string> = {}
  hash.split("&").forEach((pair) => {
    const [key, value] = pair.split("=")
    if (key && value) {
      params[key] = decodeURIComponent(value)
    }
  })

  return params
}

/**
 * Parse OAuth code from URL query params (web only)
 * Convex OAuth returns code in query: ?code=...
 */
function getQueryParams(): {
  code?: string
  state?: string
  error?: string
  error_description?: string
} {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return {}
  }

  const search = window.location.search
  if (!search) return {}

  const params = new URLSearchParams(search)
  return {
    code: params.get("code") ?? undefined,
    state: params.get("state") ?? undefined,
    error: params.get("error") ?? undefined,
    error_description: params.get("error_description") ?? undefined,
  }
}

export const AuthCallbackScreen = () => {
  const navigation = useNavigation<AppStackScreenProps<"AuthCallback">["navigation"]>()
  const route = useRoute<RouteProp<AppStackParamList, "AuthCallback">>()
  const { t } = useTranslation()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Get params from route (mobile) or hash fragment / query params (web OAuth)
  const hashParams = getHashParams()
  const queryParams = getQueryParams()
  const code = route.params?.code ?? hashParams.code ?? queryParams.code
  const accessToken = route.params?.access_token ?? hashParams.access_token
  const refreshToken = route.params?.refresh_token ?? hashParams.refresh_token
  const oauthState = route.params?.state ?? hashParams.state ?? queryParams.state
  const oauthError = queryParams.error
  const oauthErrorDescription = queryParams.error_description

  useEffect(() => {
    let isMounted = true

    const handleAuthCallback = async () => {
      try {
        // Handle OAuth errors
        if (oauthError) {
          throw new Error(oauthErrorDescription || oauthError)
        }

        // ================================================================
        // Convex OAuth Callback Handling
        // ================================================================
        if (isConvex) {
          if (code) {
            // For Convex, the OAuth code needs to be sent to the signIn action
            // This is handled by the useConvexSocialAuth hook when it receives the callback
            // The code should already be processed by the hook that opened the auth session
            if (__DEV__) {
              logger.debug("[AuthCallback] Convex OAuth code received", {
                codePrefix: code.substring(0, 8),
              })
            }

            // For web, we need to complete the OAuth flow
            if (Platform.OS === "web") {
              try {
                // Convex removed - using Supabase only
                // Note: The flow is handled by the ConvexAuthProvider detecting the code
                // and completing the flow automatically

                // Clear the URL params
                if (typeof window !== "undefined") {
                  window.history.replaceState(null, "", window.location.pathname)
                }

                // Wait for the auth state to update
                await new Promise((resolve) => setTimeout(resolve, 2000))
              } catch (error) {
                logger.warn("[AuthCallback] Convex auth import failed", { error })
              }
            }
            return
          }

          // No code found for Convex - this might be an error
          if (__DEV__) {
            logger.debug("[AuthCallback] Convex: No OAuth code found in callback")
          }
          return
        }

        // ================================================================
        // Supabase OAuth Callback Handling
        // ================================================================
        if (isSupabase) {
          // consumeOAuthState atomically reads and clears the stored state.
          // If no state was pending, it returns false only when receivedState is also absent.
          if (!oauthState || !consumeOAuthState(oauthState)) {
            throw new Error("Invalid OAuth callback state. Please try signing in again.")
          }

          // Dynamic import to avoid loading Supabase in Convex builds
          const { supabase } = await import("@/services/supabase")

          // On web, Supabase's detectSessionInUrl may have already handled the tokens
          // Check if we already have a session
          if (Platform.OS === "web") {
            const { data: sessionData } = await supabase.auth.getSession()
            if (sessionData.session) {
              if (__DEV__) {
                logger.debug("Session already established by Supabase detectSessionInUrl")
              }
              useAuthStore.getState().setSession(sessionData.session)
              // Clear the hash from URL to prevent re-processing
              if (typeof window !== "undefined" && window.location.hash) {
                window.history.replaceState(null, "", window.location.pathname)
              }
              return
            }
          }

          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) throw error
            if (data.session) {
              useAuthStore.getState().setSession(data.session)
            }
            return
          }

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (error) throw error
            if (data.session) {
              useAuthStore.getState().setSession(data.session)
            }
            // Clear the hash from URL after processing
            if (Platform.OS === "web" && typeof window !== "undefined") {
              window.history.replaceState(null, "", window.location.pathname)
            }
            return
          }

          // If no params found, wait briefly for Supabase to process the URL
          // This handles the case where detectSessionInUrl is processing asynchronously
          if (Platform.OS === "web") {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            const { data: retrySessionData } = await supabase.auth.getSession()
            if (retrySessionData.session) {
              useAuthStore.getState().setSession(retrySessionData.session)
              if (typeof window !== "undefined" && window.location.hash) {
                window.history.replaceState(null, "", window.location.pathname)
              }
              return
            }
          }
        }

        throw new Error(t("authCallbackScreen:invalidParams"))
      } catch (error) {
        const resolvedError = error instanceof Error ? error : new Error(String(error))
        logger.error("Auth callback failed", {}, resolvedError)
        if (isMounted) {
          setErrorMessage(formatAuthError(resolvedError))
        }
      }
    }

    void handleAuthCallback()

    return () => {
      isMounted = false
    }
  }, [code, accessToken, refreshToken, oauthError, oauthErrorDescription, oauthState, t])

  if (!errorMessage) {
    return (
      <LoadingScreen
        message={t("authCallbackScreen:loadingMessage")}
        status={t("authCallbackScreen:loadingStatus")}
      />
    )
  }

  return (
    <AuthScreenLayout
      headerIcon="⚠️"
      title={t("authCallbackScreen:errorTitle")}
      subtitle={errorMessage}
      scrollable={false}
    >
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("Login" as never)}
          activeOpacity={0.8}
        >
          <Text
            weight="semiBold"
            style={styles.primaryButtonText}
            tx="authCallbackScreen:backToLogin"
          />
        </TouchableOpacity>
      </View>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    marginTop: theme.spacing.lg,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.sizes.lg,
  },
}))
