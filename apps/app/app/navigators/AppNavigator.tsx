/**
 * The app navigator (formerly "AppNavigator" and "MainNavigator") is used for the primary
 * navigation flows of your app.
 * Generally speaking, it will contain an auth flow (registration, login, forgot password)
 * and a "main" flow which the user will use once logged in.
 */
import { useEffect, useRef } from "react"
import { Platform } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { UnistylesRuntime, useUnistyles } from "react-native-unistyles"

import { Spinner } from "@/components/Spinner"
import Config from "@/config"
import * as Screens from "@/screens"
import { ErrorBoundary } from "@/screens/ErrorScreen/ErrorBoundary"
import { useAuthStore } from "@/stores"
import type { AuthState } from "@/stores/auth/authTypes"
import { webDimension } from "@/types/webStyles"

import { MainTabNavigator } from "./MainTabNavigator"
import type { AppStackParamList, NavigationProps } from "./navigationTypes"
import { navigationRef, resetRoot, useBackButtonHandler } from "./navigationUtilities"

/**
 * This is a list of all the route names that will exit the app if the back button
 * is pressed while in that screen. Only affects Android.
 */
const exitRoutes = Config.exitRoutes

// Documentation: https://reactnavigation.org/docs/stack-navigator/
const Stack = createNativeStackNavigator<AppStackParamList>()

const AppStack = () => {
  const user = useAuthStore((state: AuthState) => state.user)
  const loading = useAuthStore((state: AuthState) => state.loading)
  const isAuthenticated = useAuthStore((state: AuthState) => state.isAuthenticated)
  const isEmailConfirmed = useAuthStore((state: AuthState) => state.isEmailConfirmed)
  const hasCompletedOnboarding = useAuthStore((state: AuthState) => state.hasCompletedOnboarding)
  const shouldShowOnboarding = !!user && isAuthenticated && !hasCompletedOnboarding
  const needsEmailVerification = !!user && !isEmailConfirmed
  const isWeb = Platform.OS === "web"
  const { theme } = useUnistyles()
  const navigationBarColor = theme.colors.palette.neutral900
  const statusBarStyle = UnistylesRuntime.themeName === "dark" ? "light" : "dark"

  // Track previous state to detect transitions
  const prevNeedsEmailVerificationRef = useRef(needsEmailVerification)
  const prevIsAuthenticatedRef = useRef(isAuthenticated)

  // Handle navigation when state changes (e.g., login with unverified email, sign out)
  // MUST be called before any early returns to comply with React Hooks rules
  useEffect(() => {
    // Only navigate if state actually changed (not on initial render)
    const wasNeedingVerification = prevNeedsEmailVerificationRef.current
    const wasAuthenticated = prevIsAuthenticatedRef.current

    // If we transitioned to needing email verification, navigate to that screen
    if (needsEmailVerification && !wasNeedingVerification && navigationRef.isReady()) {
      resetRoot({
        index: 0,
        routes: [{ name: "EmailVerification" }],
      })
    }

    // If user signed out (was authenticated, now not), reset to Welcome screen
    if (
      wasAuthenticated &&
      !isAuthenticated &&
      !needsEmailVerification &&
      navigationRef.isReady()
    ) {
      resetRoot({
        index: 0,
        routes: [{ name: "Welcome" }],
      })
    }

    // Update refs for next render
    prevNeedsEmailVerificationRef.current = needsEmailVerification
    prevIsAuthenticatedRef.current = isAuthenticated
  }, [needsEmailVerification, isAuthenticated])

  if (loading) {
    return <Spinner fullScreen />
  }

  // Determine initial route
  let initialRouteName: keyof AppStackParamList = "Welcome"
  if (user) {
    if (needsEmailVerification) {
      initialRouteName = "EmailVerification"
    } else if (isAuthenticated) {
      initialRouteName = hasCompletedOnboarding ? "Main" : "Onboarding"
    }
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        navigationBarColor,
        statusBarStyle,
        contentStyle: {
          flex: 1,
          backgroundColor: theme.colors.background,
          ...(isWeb && {
            minHeight: webDimension("100vh"),
            height: webDimension("100vh"),
            width: webDimension("100vw"),
            maxWidth: webDimension("100vw"),
          }),
        },
        animation: "default",
      }}
      initialRouteName={initialRouteName}
    >
      {needsEmailVerification ? (
        // ------------------------------------------------------------------
        // EMAIL VERIFICATION (USER EXISTS BUT EMAIL NOT CONFIRMED)
        // ------------------------------------------------------------------
        <>
          <Stack.Screen
            name="EmailVerification"
            component={Screens.EmailVerificationScreen}
            options={{
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="Register"
            component={Screens.RegisterScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="Login"
            component={Screens.LoginScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
        </>
      ) : shouldShowOnboarding ? (
        // ------------------------------------------------------------------
        // ONBOARDING (AUTHENTICATED AND EMAIL CONFIRMED)
        // ------------------------------------------------------------------
        <>
          <Stack.Screen name="Onboarding" component={Screens.OnboardingScreen} />
          <Stack.Screen
            name="Paywall"
            component={Screens.PaywallScreen}
            options={{
              gestureEnabled: false,
            }}
          />
        </>
      ) : isAuthenticated ? (
        // ------------------------------------------------------------------
        // AUTHENTICATED STACK (EMAIL CONFIRMED)
        // ------------------------------------------------------------------
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen
            name="Paywall"
            component={Screens.PaywallScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="DataDemo"
            component={Screens.DataDemoScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="ComponentShowcase"
            component={Screens.ComponentShowcaseScreen}
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AddSku"
            component={Screens.AddSkuScreen}
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="SkuDetail"
            component={Screens.SkuDetailScreen}
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="InventoryAdjustment"
            component={Screens.InventoryAdjustmentScreen}
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="StockTake"
            component={Screens.StockTakeScreen}
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />
        </>
      ) : (
        // ------------------------------------------------------------------
        // UNAUTHENTICATED STACK (Welcome, Login, Register)
        // ------------------------------------------------------------------
        <>
          <Stack.Screen
            name="Welcome"
            component={Screens.WelcomeScreen}
            options={{
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="Login"
            component={Screens.LoginScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="Register"
            component={Screens.RegisterScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={Screens.ForgotPasswordScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="ResetPassword"
            component={Screens.ResetPasswordScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="AuthCallback"
            component={Screens.AuthCallbackScreen}
            options={{
              animation: "fade",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="EmailVerification"
            component={Screens.EmailVerificationScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="MagicLink"
            component={Screens.MagicLinkScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="OTPVerification"
            component={Screens.OTPVerificationScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  )
}

export const AppNavigator = (props: NavigationProps) => {
  const { theme } = useUnistyles()

  // Map Unistyles theme to React Navigation theme
  const navigationTheme = {
    dark: UnistylesRuntime.themeName === "dark",
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.foreground,
      border: theme.colors.border,
      notification: theme.colors.primary,
    },
    fonts: {
      regular: {
        fontFamily: theme.typography.fonts.regular,
        fontWeight: "400" as const,
      },
      medium: {
        fontFamily: theme.typography.fonts.medium,
        fontWeight: "500" as const,
      },
      bold: {
        fontFamily: theme.typography.fonts.bold,
        fontWeight: "700" as const,
      },
      heavy: {
        fontFamily: theme.typography.fonts.bold,
        fontWeight: "900" as const,
      },
    },
  }

  useBackButtonHandler((routeName) => exitRoutes.includes(routeName))

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} {...props}>
      <ErrorBoundary catchErrors={Config.catchErrors}>
        <AppStack />
      </ErrorBoundary>
    </NavigationContainer>
  )
}
