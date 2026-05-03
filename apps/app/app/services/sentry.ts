/**
 * Sentry Error Tracking Service
 *
 * Handles error tracking and performance monitoring across web and mobile platforms.
 * Falls back to mock service when DSN is missing.
 */

import { Platform } from "react-native"

import { env } from "../config/env"
import type {
  ErrorTrackingService,
  ErrorTrackingConfig,
  ErrorContext,
  UserContext,
  Breadcrumb,
  ErrorLevel,
} from "../types/errorTracking"
import { logger } from "../utils/Logger"
import { mockSentry } from "./mocks/sentry"

type SentryModule = {
  init: (options: Record<string, unknown>) => void
  captureException: (error: Error, context?: Record<string, unknown>) => string | undefined
  captureMessage: (message: string, options?: Record<string, unknown>) => string | undefined
  setUser: (user: UserContext | null) => void
  setContext: (key: string, value: Record<string, unknown>) => void
  setTag: (key: string, value: string) => void
  setTags: (tags: Record<string, string>) => void
  setExtra: (key: string, value: unknown) => void
  setExtras: (extras: Record<string, unknown>) => void
  addBreadcrumb: (breadcrumb: Record<string, unknown>) => void
  withScope: (callback: (scope: Record<string, unknown>) => void) => void
  startTransaction?: (payload: { name: string; op?: string }) => unknown
  close: (timeout?: number) => Promise<boolean>
}

// Sentry SDKs (platform-specific)
let SentryRN: SentryModule | null = null // React Native

const loadSentryRN = (): SentryModule | null => {
  if (SentryRN) return SentryRN
  try {
    // Lazy-load SDK to avoid import side effects in tests and non-Sentry environments.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SentryRN = require("@sentry/react-native")
    return SentryRN
  } catch (error) {
    logger.error(
      "Sentry React Native SDK not available. Make sure @sentry/react-native is installed",
      {},
      error as Error,
    )
    return null
  }
}

const dsn = env.sentryDsn || ""

// Use mock if DSN is missing in development
const useMock = __DEV__ && !dsn

class SentryService implements ErrorTrackingService {
  platform = "sentry" as const
  private initialized = false
  private Sentry: SentryModule | null = null

  initialize(config: ErrorTrackingConfig): void {
    if (this.initialized) return

    const sentryDsn = config.dsn || dsn

    if (!sentryDsn) {
      logger.warn("Sentry DSN not provided")
      return
    }

    // Initialize Sentry for all platforms (iOS/Android/Web)
    // Note: Sentry supports React 19 - see https://docs.sentry.io/platforms/javascript/guides/react/
    // @sentry/react-native works on web via React Native Web, but for production web-only apps,
    // consider using @sentry/react for better web-specific features
    const sdk = loadSentryRN()
    if (!sdk) {
      return
    }

    try {
      const isWeb = Platform.OS === "web"

      sdk.init({
        dsn: sentryDsn,
        environment: config.environment || (__DEV__ ? "development" : "production"),
        release: config.release,
        dist: config.dist,
        enableInExpoDevelopment: config.enableInDevelopment ?? false,
        tracesSampleRate: config.tracesSampleRate ?? 1.0,
        beforeSend: config.beforeSend,

        // Performance monitoring (per Sentry best practices)
        enableAutoPerformanceTracing: config.enableAutoPerformanceTracing ?? true,
        enableAppStartTracking: config.enableAppStartTracking ?? true,
        // Native-specific performance tracking (ignored on web by SDK)
        enableNativeFramesTracking: isWeb ? false : (config.enableNativeFramesTracking ?? true),
        enableStallTracking: isWeb ? false : (config.enableStallTracking ?? true),

        // Error attachments — default off on RN: screenshot pipeline can hit
        // FileReader + Blob bridge ("Unable to resolve data for blob"), especially on device.
        attachScreenshot: config.attachScreenshot ?? false,
        attachViewHierarchy: config.attachViewHierarchy ?? false, // Can be expensive

        // Native configuration (ignored on web by SDK, but set conditionally for clarity)
        enableNative: isWeb ? false : (config.enableNative ?? true),
        enableNativeCrashHandling: isWeb ? false : (config.enableNativeCrashHandling ?? true),
        enableNdk: isWeb ? false : (config.enableNdk ?? true),
      })

      this.Sentry = sdk
      this.initialized = true

      if (__DEV__) {
        const platform = Platform.OS === "web" ? "web" : "mobile"
        logger.debug(`🐛 [Sentry] Initialized for ${platform} with performance monitoring`)
      }
    } catch (error) {
      logger.error("Failed to initialize Sentry", {}, error as Error)
    }
  }

  captureException(error: Error, context?: ErrorContext): string | undefined {
    if (!this.Sentry) return undefined

    try {
      return this.Sentry.captureException(error, {
        tags: context?.tags,
        extra: context?.extra,
        level: context?.level,
        fingerprint: context?.fingerprint,
        user: context?.user,
      })
    } catch (err) {
      logger.error("Sentry captureException error", {}, err as Error)
      return undefined
    }
  }

  captureMessage(message: string, level?: ErrorLevel, context?: ErrorContext): string | undefined {
    if (!this.Sentry) return undefined

    try {
      return this.Sentry.captureMessage(message, {
        level: level || "info",
        tags: context?.tags,
        extra: context?.extra,
        fingerprint: context?.fingerprint,
        user: context?.user,
      })
    } catch (error) {
      logger.error("Sentry captureMessage error", {}, error as Error)
      return undefined
    }
  }

  setUser(user: UserContext | null): void {
    if (!this.Sentry) return

    try {
      this.Sentry.setUser(user)

      if (__DEV__ && user) {
        logger.debug("🐛 [Sentry] Set user", { userId: user.id || user.email })
      }
    } catch (error) {
      logger.error("Sentry setUser error", {}, error as Error)
    }
  }

  setContext(key: string, value: unknown): void {
    if (!this.Sentry) return

    try {
      this.Sentry.setContext(key, value as Record<string, unknown>)
    } catch (error) {
      logger.error("Sentry setContext error", {}, error as Error)
    }
  }

  setTag(key: string, value: string): void {
    if (!this.Sentry) return

    try {
      this.Sentry.setTag(key, value)
    } catch (error) {
      logger.error("Sentry setTag error", {}, error as Error)
    }
  }

  setTags(tags: Record<string, string>): void {
    if (!this.Sentry) return

    try {
      this.Sentry.setTags(tags)
    } catch (error) {
      logger.error("Sentry setTags error", {}, error as Error)
    }
  }

  setExtra(key: string, value: unknown): void {
    if (!this.Sentry) return

    try {
      this.Sentry.setExtra(key, value)
    } catch (error) {
      logger.error("Sentry setExtra error", {}, error as Error)
    }
  }

  setExtras(extras: Record<string, unknown>): void {
    if (!this.Sentry) return

    try {
      this.Sentry.setExtras(extras)
    } catch (error) {
      logger.error("Sentry setExtras error", {}, error as Error)
    }
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    if (!this.Sentry) return

    try {
      this.Sentry.addBreadcrumb({
        type: breadcrumb.type,
        category: breadcrumb.category,
        message: breadcrumb.message,
        data: breadcrumb.data,
        level: breadcrumb.level,
        timestamp: breadcrumb.timestamp,
      })
    } catch (error) {
      logger.error("Sentry addBreadcrumb error", {}, error as Error)
    }
  }

  withScope(callback: (scope: Record<string, unknown>) => void): void {
    if (!this.Sentry) return

    try {
      this.Sentry.withScope(callback)
    } catch (error) {
      logger.error("Sentry withScope error", {}, error as Error)
    }
  }

  startTransaction(name: string, op?: string): unknown {
    if (!this.Sentry) return null

    try {
      return this.Sentry.startTransaction?.({
        name,
        op: op || "custom",
      })
    } catch (error) {
      logger.error("Sentry startTransaction error", {}, error as Error)
      return null
    }
  }

  async close(timeout?: number): Promise<boolean> {
    if (!this.Sentry) return true

    try {
      return await this.Sentry.close(timeout)
    } catch (error) {
      logger.error("Sentry close error", {}, error as Error)
      return false
    }
  }
}

// Export singleton instance
export const sentry: ErrorTrackingService = useMock ? mockSentry : new SentryService()

// Export initialization function
export const initSentry = () => {
  if (useMock) {
    if (__DEV__) {
      logger.warn("⚠️  Sentry DSN not found - using mock error tracking")
      logger.info("💡 Add EXPO_PUBLIC_SENTRY_DSN to .env to use real Sentry")
    }
    return
  }

  sentry.initialize({
    dsn,
    environment: __DEV__ ? "development" : "production",
    enableInDevelopment: false,
  })

  // Log mock mode status during initialization (when logger is ready)
  if (useMock && __DEV__) {
    logger.warn("⚠️  Sentry running in mock mode")
    return
  }

  // Note: @sentry/react-native automatically sets up global error handlers
  // No need for manual setup - Sentry captures unhandled errors automatically
  if (__DEV__) {
    logger.debug("🐛 [Sentry] Initialized - automatic error capture enabled")
  }
}
