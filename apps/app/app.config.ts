import "tsx/cjs"

import { ExpoConfig, ConfigContext } from "@expo/config"

import withWidgetAppGroup from "./plugins/withWidgetAppGroup"

/**
 * @param config ExpoConfig coming from the static config app.json if it exists
 *
 * You can read more about Expo's Configuration Resolution Rules here:
 * https://docs.expo.dev/workflow/configuration/#configuration-resolution-rules
 */
module.exports = ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = config as ExpoConfig & { bundleIdentifier?: string }
  const existingPlugins = (baseConfig.plugins ?? []) as NonNullable<ExpoConfig["plugins"]>
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID

  // Check if widgets are enabled via feature flag
  const enableWidgets = process.env.EXPO_PUBLIC_ENABLE_WIDGETS === "true"
  const bundleIdentifier =
    baseConfig.ios?.bundleIdentifier ||
    baseConfig.bundleIdentifier ||
    baseConfig.android?.package ||
    "com.shipnative.app"
  const appGroupIdentifier = process.env.APP_GROUP_IDENTIFIER || `group.${bundleIdentifier}`

  // Conditionally add widget plugin
  const plugins: NonNullable<ExpoConfig["plugins"]> = [...existingPlugins]
  if (enableWidgets) {
    plugins.push([
      "@bittingz/expo-widgets",
      {
        ios: {
          src: "./app/widgets/ios",
          devTeamId: process.env.APPLE_TEAM_ID || "",
          mode: "production",
          useLiveActivities: false,
          frequentUpdates: false,
        },
        android: {
          src: "./app/widgets/android",
          widgets: [
            {
              name: "ExampleWidgetProvider",
              resourceName: "@xml/example_widget_info",
            },
            {
              name: "StatsWidgetProvider",
              resourceName: "@xml/stats_widget_info",
            },
          ],
        },
      },
    ])

    plugins.push([
      withWidgetAppGroup,
      {
        appGroupIdentifier,
      },
    ] as unknown as NonNullable<ExpoConfig["plugins"]>[number])
  }

  const reversedGoogleIosClientId = googleIosClientId
    ? googleIosClientId.split(".").reverse().join(".")
    : null
  const existingUrlTypes =
    (config.ios?.infoPlist?.CFBundleURLTypes as { CFBundleURLSchemes?: string[] }[]) ?? []
  const hasGoogleScheme =
    reversedGoogleIosClientId &&
    existingUrlTypes.some((entry) =>
      (entry.CFBundleURLSchemes ?? []).includes(reversedGoogleIosClientId),
    )
  const urlTypes = reversedGoogleIosClientId
    ? hasGoogleScheme
      ? existingUrlTypes
      : [
          ...existingUrlTypes,
          {
            CFBundleURLSchemes: [reversedGoogleIosClientId],
          },
        ]
    : existingUrlTypes

  return {
    ...baseConfig,
    // Pass environment variables through extra for web builds (Vercel deployment)
    // Metro doesn't inline process.env.EXPO_PUBLIC_* for web, so we need this fallback
    // Keys use snake_case to match what env.ts expects in Constants.expoConfig.extra
    extra: {
      ...baseConfig.extra,
      // Backend provider
      backend_provider: process.env.EXPO_PUBLIC_BACKEND_PROVIDER,
      app_env: process.env.EXPO_PUBLIC_APP_ENV,
      // Supabase
      supabase_url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabase_publishable_key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      // Convex
      convex_url: process.env.EXPO_PUBLIC_CONVEX_URL,
      // RevenueCat
      revenuecat_ios_key: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      revenuecat_android_key: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
      revenuecat_web_key: process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY,
      // Analytics & Monitoring
      posthog_api_key: process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
      posthog_host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
      sentry_dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      // OAuth
      google_client_id: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
      google_ios_client_id: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      apple_services_id: process.env.EXPO_PUBLIC_APPLE_SERVICES_ID,
      apple_team_id: process.env.EXPO_PUBLIC_APPLE_TEAM_ID,
      // Feature flags
      enable_widgets: process.env.EXPO_PUBLIC_ENABLE_WIDGETS,
      use_mock_notifications: process.env.EXPO_PUBLIC_USE_MOCK_NOTIFICATIONS,
      // Auth redirects
      email_redirect_url: process.env.EXPO_PUBLIC_EMAIL_REDIRECT_URL,
      password_reset_redirect_url: process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL,
    },
    // Ensure icon is preserved from app.json
    icon: config.icon || "./assets/icons/vizory_1024.png",
    ios: {
      ...config.ios,
      // Ensure bundleIdentifier is preserved
      bundleIdentifier,
      // Ensure iOS icon is preserved from app.json
      icon: config.ios?.icon || ".assets/icons/vizory_1024.png",
      infoPlist: {
        ...config.ios?.infoPlist,
        CFBundleURLTypes: urlTypes,
        // Required for Face ID (LAContext); set here so prebuild never drops it during merges
        NSFaceIDUsageDescription: "Vizory uses Face ID to sign you in securely.",
        NSCameraUsageDescription: "Vizory uses your camera to scan product barcodes.",
      },
      // This privacyManifests is to get you started.
      // See Expo's guide on apple privacy manifests here:
      // https://docs.expo.dev/guides/apple-privacy/
      // You may need to add more privacy manifests depending on your app's usage of APIs.
      // More details and a list of "required reason" APIs can be found in the Apple Developer Documentation.
      // https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"], // CA92.1 = "Access info from same app, per documentation"
          },
        ],
      },
    },
    plugins,
  }
}
