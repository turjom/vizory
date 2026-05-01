/* eslint-disable import/first */
/**
 * Welcome to the main entry point of the app. In this file, we'll
 * be kicking off our app.
 *
 * Most of this file is boilerplate and you shouldn't need to modify
 * it very often. But take some time to look through and understand
 * what is going on here.
 *
 * The app navigation resides in ./app/navigators, so head over there
 * if you're interested in adding screens and navigators.
 */
if (__DEV__ && Platform.OS !== "web") {
  // Load Reactotron in development only.
  // Note that you must be using metro's `inlineRequires` for this to work.
  // If you turn it off in metro.config.js, you'll have to manually import it.
  require("./devtools/ReactotronConfig.ts")
}
import "./utils/gestureHandler"

import "./styles"

import type { ReactElement } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ViewStyle } from "react-native"
import { InteractionManager, Platform } from "react-native"
import { useFonts } from "expo-font"
import * as Linking from "expo-linking"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"
import { ToastProvider } from "@/components"

import { logEnvValidation } from "./config/env"
import { initI18n, initializeLanguage } from "./i18n"
import { AppNavigator } from "./navigators/AppNavigator"
import { useNavigationPersistence } from "./navigators/navigationUtilities"
import { BackendProvider } from "./providers"
import { LoadingScreen } from "./screens/LoadingScreen"
import { certificatePinning } from "./services/certificatePinning"
import { logMockServicesStatus } from "./services/mocks"
import { initPosthog } from "./services/posthog"
import { initRevenueCat } from "./services/revenuecat"
import { initSentry, sentry } from "./services/sentry"
import { useAuthStore, useNotificationStore, useSubscriptionStore } from "./stores"
import { ThemeProvider } from "./theme/context"
import { customFontsToLoad } from "./theme/typography"
import { webDimension } from "./types/webStyles"
import { logger } from "./utils/Logger"
import { securityCheck } from "./utils/securityCheck"
import * as storage from "./utils/storage"
import { ErrorBoundary } from "./screens/ErrorScreen/ErrorBoundary"

type KeyboardProviderProps = { children?: React.ReactNode }

let KeyboardProvider: React.ComponentType<KeyboardProviderProps> = ({ children }) => <>{children}</>
if (Platform.OS !== "web") {
  try {
    KeyboardProvider = require("react-native-keyboard-controller").KeyboardProvider
  } catch (e) {
    // This is expected on web, so we'll keep console.warn for visibility
    if (__DEV__) {
      console.warn("Failed to load keyboard controller", e)
    }
  }
}

export const NAVIGATION_PERSISTENCE_KEY = "NAVIGATION_STATE"
const APP_START_TIME = Date.now()

const logStartup = (label: string) => {
  const elapsed = Date.now() - APP_START_TIME
  logger.info(`[perf] ${label} (${elapsed}ms since start)`)
}

// Web linking configuration
const prefix = Linking.createURL("/")
const config = {
  screens: {
    Onboarding: "onboarding",
    Welcome: "welcome",
    Login: "login",
    Register: "register",
    ForgotPassword: "forgot-password",
    ResetPassword: {
      path: "reset-password",
      parse: {
        code: (code: string) => code,
        token: (token: string) => token,
      },
    },
    EmailVerification: "verify-email",
    Paywall: "paywall",
    Main: {
      path: "",
      screens: {
        Home: "home",
        Inventory: "inventory",
        Add: "add",
        Profile: "profile",
      },
    },
    // Auth callback for email confirmation and password reset
    AuthCallback: {
      path: "auth/callback",
      parse: {
        code: (code: string) => code,
        access_token: (accessToken: string) => accessToken,
        refresh_token: (refreshToken: string) => refreshToken,
        state: (state: string) => state,
        token: (token: string) => token,
        type: (type: string) => type,
      },
    },
  },
}

/**
 * This is the root component of our app.
 * @param {AppProps} props - The props for the `App` component.
 * @returns {JSX.Element} The rendered `App` component.
 */
export function App() {
  const {
    initialNavigationState,
    onNavigationStateChange,
    isRestored: isNavigationStateRestored,
  } = useNavigationPersistence(storage, NAVIGATION_PERSISTENCE_KEY)

  const [areFontsLoaded, fontLoadError] = useFonts(customFontsToLoad)
  const [isI18nInitialized, setIsI18nInitialized] = useState(false)
  const [isStoresInitialized, setIsStoresInitialized] = useState(false)
  const hasLoggedReadyRef = useRef(false)

  // Restored nav state can still say "Welcome" after sign-in; ignore it whenever we have a Supabase user.
  const suppressPersistedNavigation = useAuthStore((s) => !s.loading && !!s.user)

  const handleInitialEmailLink = useCallback(async () => {
    // Handle email confirmation code from deep link (non-blocking)
    try {
      const initialUrl = await Linking.getInitialURL()
      if (!initialUrl) return

      const url = new URL(initialUrl)
      const code = url.searchParams.get("code")
      const type = url.searchParams.get("type")

      if (code && (type === "signup" || type === "email")) {
        if (__DEV__) {
          logger.debug("Email confirmation code detected, verifying...")
        }
        await useAuthStore.getState().verifyEmail(code)
      }
    } catch {
      if (__DEV__) {
        logger.debug("No email confirmation code in initial URL")
      }
    }
  }, [])

  useEffect(() => {
    // Initialize Sentry early so it can capture errors during app initialization.
    // This must run before initialize() which may call sentry.captureException().
    initSentry()

    let isMounted = true
    const initialize = async () => {
      try {
        logStartup("App initialize started")

        const i18nPromise = (async () => {
          await initI18n()
          await initializeLanguage()
          if (__DEV__) {
            logger.debug("i18n and language initialized")
          }
        })()

        const authPromise = (async () => {
          if (__DEV__) {
            logger.debug("initializing auth store...")
          }
          const { persist } = useAuthStore
          if (persist?.rehydrate) {
            await persist.rehydrate()
          }
          await useAuthStore.getState().initialize()
          if (__DEV__) {
            logger.debug("auth store initialized")
          }
        })()

        await Promise.all([i18nPromise, authPromise])

        if (isMounted) {
          setIsI18nInitialized(true)
          setIsStoresInitialized(true)
        }

        // Initialize subscription store in background (non-blocking)
        if (__DEV__) {
          logger.debug("initializing subscription store...")
        }
        useSubscriptionStore
          .getState()
          .initialize()
          .catch((error) => {
            logger.error("Subscription initialization failed", {}, error as Error)
            sentry.captureException(error as Error, {
              tags: { context: "initialization", service: "subscription" },
            })
          })

        // Handle email confirmation link without blocking initial render
        handleInitialEmailLink().catch((error) => {
          logger.error("Failed to handle initial email link", {}, error as Error)
        })
      } catch (e) {
        logger.error("App initialize failed", {}, e as Error)
        sentry.captureException(e as Error, {
          tags: { context: "initialization", service: "app" },
        })
      }
    }

    const deferredInitialization = InteractionManager.runAfterInteractions(() => {
      try {
        logEnvValidation()
        logMockServicesStatus()
        certificatePinning.initialize()
        securityCheck.log()
        initPosthog()
        void initRevenueCat().catch((error) => {
          logger.error("RevenueCat initialization failed", {}, error as Error)
          sentry.captureException(error as Error, {
            tags: { context: "initialization", service: "revenuecat" },
          })
        })

        // Initialize notification store (sets up listeners for push notifications)
        void useNotificationStore
          .getState()
          .initialize()
          .catch((error) => {
            logger.error("Notification store initialization failed", {}, error as Error)
            sentry.captureException(error as Error, {
              tags: { context: "initialization", service: "notifications" },
            })
          })

        logStartup("Deferred services initialized")
      } catch (error) {
        logger.error("Deferred initialization failed", {}, error as Error)
        sentry.captureException(error as Error, {
          tags: { context: "initialization", service: "deferred" },
        })
      }
    })

    initialize()

    return () => {
      isMounted = false
      deferredInitialization.cancel()
      // Clean up notification listeners to prevent memory leaks
      useNotificationStore.getState().cleanup()
      useSubscriptionStore.getState().cleanup()
    }
  }, [handleInitialEmailLink])

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return undefined
    }

    const handler = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      logger.error("Unhandled promise rejection", {}, reason)
    }

    window.addEventListener("unhandledrejection", handler)
    return () => {
      window.removeEventListener("unhandledrejection", handler)
    }
  }, [])

  const isLoading =
    !isNavigationStateRestored ||
    !isI18nInitialized ||
    !isStoresInitialized ||
    (!areFontsLoaded && !fontLoadError)

  useEffect(() => {
    if (!isLoading && !hasLoggedReadyRef.current) {
      hasLoggedReadyRef.current = true
      logStartup("App shell ready")
    }
  }, [isLoading])

  const handleNavigatorReady = useCallback(() => {
    logStartup("First navigation ready")
  }, [])

  const linking = {
    prefixes: [prefix],
    config,
  }

  let content: ReactElement

  // Before we show the app, we have to wait for our state to be ready.
  // Show a loading screen with a nice animation while initializing.
  if (isLoading) {
    const status = {
      isNavigationStateRestored,
      isI18nInitialized,
      isStoresInitialized,
      areFontsLoaded,
      fontLoadError,
    }
    if (__DEV__) {
      logger.debug("App loading state", status)
    }

    // Determine loading message based on state
    const loadingMessage = "Loading"
    let loadingStatus = "Preparing your experience..."
    if (!isI18nInitialized) {
      loadingStatus = "Initializing language..."
    } else if (!isStoresInitialized) {
      loadingStatus = "Setting up your account..."
    } else if (!areFontsLoaded) {
      loadingStatus = "Loading fonts..."
    } else if (!isNavigationStateRestored) {
      loadingStatus = "Restoring navigation..."
    }

    content = <LoadingScreen message={loadingMessage} status={loadingStatus} />
  } else {
    content = (
      <AppNavigator
        linking={linking}
        initialState={suppressPersistedNavigation ? undefined : initialNavigationState}
        onStateChange={onNavigationStateChange}
        onReady={handleNavigatorReady}
      />
    )
  }

  // otherwise, we're ready to render the app
  return (
    <ErrorBoundary catchErrors="always">
      <GestureHandlerRootView style={$gestureHandlerRoot}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics} style={$safeAreaProvider}>
          <BackendProvider>
            {Platform.OS === "web" ? (
              <ThemeProvider>
                <ToastProvider>{content}</ToastProvider>
              </ThemeProvider>
            ) : (
              <KeyboardProvider>
                <ThemeProvider>
                  <ToastProvider>{content}</ToastProvider>
                </ThemeProvider>
              </KeyboardProvider>
            )}
          </BackendProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}

const $gestureHandlerRoot: ViewStyle = {
  flex: 1,
  // Web needs explicit height for proper scrolling
  ...(Platform.OS === "web" && {
    minHeight: webDimension("100vh"),
    height: webDimension("100vh"),
    overflow: "hidden",
  }),
}

const $safeAreaProvider: ViewStyle = {
  flex: 1,
  ...(Platform.OS === "web" && {
    minHeight: webDimension("100vh"),
    height: webDimension("100vh"),
    width: webDimension("100%"),
  }),
}
