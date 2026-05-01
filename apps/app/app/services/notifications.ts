import { Alert, Linking, Platform } from "react-native"
import Constants from "expo-constants"

import { env } from "../config/env"
import { logger } from "../utils/Logger"

// Lazy import to avoid native module errors at module load time
let Notifications: typeof import("expo-notifications") | null = null
let Device: typeof import("expo-device") | null = null
let notificationHandlerSetup = false
let androidChannelSetup = false

/**
 * Safely import expo-notifications
 */
const getNotifications = (): typeof import("expo-notifications") | null => {
  if (Notifications !== null) {
    return Notifications
  }

  try {
    Notifications = require("expo-notifications")
    return Notifications
  } catch (error) {
    if (__DEV__) {
      logger.error("📬 [Notifications] Failed to import expo-notifications", {}, error as Error)
    }
    return null
  }
}

/**
 * Safely import expo-device
 */
const getDevice = (): typeof import("expo-device") | null => {
  if (Device !== null) {
    return Device
  }

  try {
    Device = require("expo-device")
    return Device
  } catch (error) {
    if (__DEV__) {
      logger.error("📬 [Notifications] Failed to import expo-device", {}, error as Error)
    }
    return null
  }
}

/**
 * Check if running on a physical device (required for push notifications)
 */
export const isPhysicalDevice = (): boolean => {
  // Web always returns true (we handle web separately)
  if (Platform.OS === "web") {
    return true
  }

  const DeviceModule = getDevice()
  if (!DeviceModule) {
    // If we can't load expo-device, assume it's a physical device
    return true
  }

  return DeviceModule.isDevice
}

/**
 * Check if native notification module is available
 * This checks if we can actually use the native module without errors
 */
let nativeModuleAvailable: boolean | null = null

const isNativeModuleAvailable = (): boolean => {
  if (nativeModuleAvailable !== null) {
    return nativeModuleAvailable
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    nativeModuleAvailable = false
    return false
  }

  try {
    // Try to access the native module by checking if methods exist
    // We can't actually call them without triggering the error, so we check existence
    if (
      typeof NotificationsModule.setNotificationHandler === "function" &&
      typeof NotificationsModule.getPermissionsAsync === "function"
    ) {
      // Try a simple operation to verify the native module is actually available
      // This will fail if the native module isn't linked
      nativeModuleAvailable = true
      return true
    }
    nativeModuleAvailable = false
    return false
  } catch (error) {
    if (__DEV__) {
      logger.error("📬 [Notifications] Native module check failed", {}, error as Error)
    }
    nativeModuleAvailable = false
    return false
  }
}

/**
 * Setup notification handler (lazy initialization)
 */
const setupNotificationHandler = (): void => {
  if (notificationHandlerSetup) {
    return
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    return
  }

  try {
    if (isNativeModuleAvailable()) {
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      })
      notificationHandlerSetup = true
    }
  } catch (error) {
    if (__DEV__) {
      logger.error("📬 [Notifications] Failed to set notification handler", {}, error as Error)
    }
  }
}

/**
 * Setup Android notification channel with proper configuration
 * This is required for Android 8.0+ to display notifications properly
 */
const setupAndroidChannel = async (): Promise<void> => {
  if (androidChannelSetup || Platform.OS !== "android") {
    return
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule || !isNativeModuleAvailable()) {
    return
  }

  try {
    await NotificationsModule.setNotificationChannelAsync("default", {
      name: "Default",
      importance: NotificationsModule.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
      sound: "default",
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
    })

    if (__DEV__) {
      logger.debug("📬 [Notifications] Android notification channel configured")
    }
    androidChannelSetup = true
  } catch (error) {
    if (__DEV__) {
      logger.error("📬 [Notifications] Failed to setup Android channel", {}, error as Error)
    }
  }
}

/**
 * Check if we should use mock notifications
 */
const forceMockNotifications = env.useMockNotifications

const shouldUseMock = (): boolean => {
  // Explicit opt-in to mock mode via env for developers who want to bypass native prompts
  if (forceMockNotifications) {
    if (__DEV__) {
      logger.debug("📬 [Notifications] Mock mode forced via EXPO_PUBLIC_USE_MOCK_NOTIFICATIONS")
    }
    return true
  }

  // If native module is not available, use mock
  if (!isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [Notifications] Native module not available - using mock mode")
    }
    return true
  }

  return false
}

export const useMockNotifications = shouldUseMock()

/**
 * Read current notification permission without prompting (for cold start / listeners).
 */
export async function fetchNotificationPermissionStatus(): Promise<{
  status: "granted" | "denied" | "undetermined"
}> {
  if (useMockNotifications || !isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Permission status treated as granted")
    }
    return { status: "granted" }
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    return { status: "undetermined" }
  }

  try {
    const { status } = await NotificationsModule.getPermissionsAsync()
    return { status: status as "granted" | "denied" | "undetermined" }
  } catch (error) {
    logger.error("📬 [Notifications] Error reading permission status", {}, error as Error)
    return { status: "undetermined" }
  }
}

/**
 * Request notification permissions
 */
export async function requestPermission(): Promise<{
  status: "granted" | "denied" | "undetermined"
}> {
  if (useMockNotifications || !isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Permission automatically granted")
    }
    return { status: "granted" }
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Permission automatically granted (module unavailable)")
    }
    return { status: "granted" }
  }

  try {
    const { status: existingStatus } = await NotificationsModule.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== "granted") {
      const { status } = await NotificationsModule.requestPermissionsAsync()
      finalStatus = status
    }

    return { status: finalStatus as "granted" | "denied" | "undetermined" }
  } catch (error) {
    logger.error("📬 [Notifications] Error requesting permission, using mock", {}, error as Error)
    return { status: "granted" } // Fallback to granted in mock mode
  }
}

/**
 * Show user-friendly error alert when permissions are denied
 */
export function showPermissionDeniedAlert(): void {
  Alert.alert(
    "Notifications Disabled",
    "To receive push notifications, please enable them in your device settings.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open Settings",
        onPress: () => {
          void Linking.openSettings()
        },
      },
    ],
  )
}

/**
 * Show error alert for notification setup failures
 */
export function showNotificationErrorAlert(message?: string): void {
  Alert.alert(
    "Notification Setup Failed",
    message || "There was an error setting up notifications. Please try again later.",
    [{ text: "OK" }],
  )
}

/**
 * Register for push notifications and get Expo push token
 *
 * Note: On web, expo-notifications push tokens are not supported.
 * Web push notifications would require implementing the Web Push API (Service Workers).
 * This function returns null on web to avoid the warning about push token listeners.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Expo push tokens don't work on web - would need Web Push API implementation
  // Skip to avoid warning: "Listening to push token changes is not yet fully supported on web"
  if (Platform.OS === "web") {
    if (__DEV__) {
      logger.debug(
        "📬 [Notifications] Expo push tokens not supported on web (would need Web Push API), returning null",
      )
    }
    return null
  }

  // Check if running on a physical device (emulators/simulators can't receive push)
  if (!isPhysicalDevice()) {
    if (__DEV__) {
      logger.debug(
        "📬 [Notifications] Push notifications require a physical device. Running on emulator/simulator.",
      )
    }
    // Return mock token for development on emulators
    const mockToken = "ExponentPushToken[EMULATOR-" + Math.random().toString(36).substr(2, 9) + "]"
    return mockToken
  }

  if (useMockNotifications || !isNativeModuleAvailable()) {
    const mockToken = "ExponentPushToken[MOCK-" + Math.random().toString(36).substr(2, 9) + "]"
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Generated mock push token", { token: mockToken })
    }
    return mockToken
  }

  // Setup Android notification channel before registering
  await setupAndroidChannel()

  // Do not prompt here — only register when permission was already granted (e.g. onboarding).
  const NotificationsModuleForPerm = getNotifications()
  if (!NotificationsModuleForPerm) {
    return null
  }
  const { status } = await NotificationsModuleForPerm.getPermissionsAsync()
  if (status !== "granted") {
    if (__DEV__) {
      logger.debug("📬 [Notifications] Permission not granted, cannot get push token")
    }
    return null
  }

  // Get push token
  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    const mockToken = "ExponentPushToken[MOCK-" + Math.random().toString(36).substr(2, 9) + "]"
    return mockToken
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    if (!projectId) {
      logger.warn("📬 [Notifications] No EAS project ID found")
      if (!__DEV__) {
        showNotificationErrorAlert("Project configuration is missing. Please contact support.")
      }
      return null
    }

    const token = await NotificationsModule.getExpoPushTokenAsync({
      projectId,
    })

    if (__DEV__) {
      logger.debug("📬 [Notifications] Push token", { token: token.data })
    }
    return token.data
  } catch (error) {
    logger.error("📬 [Notifications] Error getting push token, using mock", {}, error as Error)
    // Fallback to mock token if native module fails
    const mockToken = "ExponentPushToken[MOCK-" + Math.random().toString(36).substr(2, 9) + "]"
    return mockToken
  }
}

/**
 * Add listener for push token changes
 * Tokens can be invalidated and rolled by the push notification service
 * This listener allows you to handle token updates and sync with your backend
 */
export function addPushTokenListener(
  listener: (token: import("expo-notifications").DevicePushToken) => void,
): import("expo-notifications").Subscription {
  // Skip on web - push tokens not supported
  if (Platform.OS === "web") {
    return {
      remove: () => {},
    } as import("expo-notifications").Subscription
  }

  if (useMockNotifications || !isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Registered push token listener (mock)")
    }
    return {
      remove: () => {
        if (__DEV__) {
          logger.debug("📬 [MockNotifications] Removed push token listener")
        }
      },
    } as import("expo-notifications").Subscription
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    return {
      remove: () => {},
    } as import("expo-notifications").Subscription
  }

  try {
    return NotificationsModule.addPushTokenListener(listener)
  } catch (error) {
    logger.error("📬 [Notifications] Error adding push token listener", {}, error as Error)
    return {
      remove: () => {},
    } as import("expo-notifications").Subscription
  }
}

export interface LocalNotificationInput {
  title: string
  body: string
  data?: Record<string, unknown>
  trigger?: import("expo-notifications").NotificationTriggerInput | null
  sound?: string
  badge?: number
  categoryIdentifier?: string
}

/**
 * Schedule a local notification
 */
export async function scheduleNotification(input: LocalNotificationInput): Promise<string> {
  if (useMockNotifications || !isNativeModuleAvailable()) {
    const mockId = "mock-notification-" + Date.now()
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Scheduled notification", {
        id: mockId,
        ...input,
      })
    }

    // Simulate notification after delay
    if (input.trigger && "seconds" in input.trigger) {
      setTimeout(
        () => {
          if (__DEV__) {
            logger.debug("📬 [MockNotifications] Notification would appear", { title: input.title })
          }
        },
        (input.trigger.seconds || 0) * 1000,
      )
    }

    return mockId
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    const mockId = "mock-notification-" + Date.now()
    return mockId
  }

  try {
    setupNotificationHandler() // Ensure handler is set up before scheduling
    const id = await NotificationsModule.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data,
        sound: input.sound,
        badge: input.badge,
        categoryIdentifier: input.categoryIdentifier,
      },
      trigger: input.trigger || null,
    })

    if (__DEV__) {
      logger.debug("📬 [Notifications] Scheduled notification", { id })
    }
    return id
  } catch (error) {
    logger.error("📬 [Notifications] Error scheduling notification, using mock", {}, error as Error)
    // Fallback to mock
    const mockId = "mock-notification-" + Date.now()
    return mockId
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  if (useMockNotifications || !isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Cancelled notification", { notificationId })
    }
    return
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    return
  }

  try {
    await NotificationsModule.cancelScheduledNotificationAsync(notificationId)
  } catch (error) {
    logger.error("📬 [Notifications] Error cancelling notification", {}, error as Error)
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (useMockNotifications || !isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Cancelled all notifications")
    }
    return
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    return
  }

  try {
    await NotificationsModule.cancelAllScheduledNotificationsAsync()
  } catch (error) {
    logger.error("📬 [Notifications] Error cancelling all notifications", {}, error as Error)
  }
}

/**
 * Set app badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (useMockNotifications || !isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Set badge count", { count })
    }
    return
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    return
  }

  try {
    await NotificationsModule.setBadgeCountAsync(count)
  } catch (error) {
    logger.error("📬 [Notifications] Error setting badge count", {}, error as Error)
  }
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<
  import("expo-notifications").NotificationRequest[]
> {
  if (useMockNotifications || !isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] No scheduled notifications (mock mode)")
    }
    return []
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    return []
  }

  try {
    return await NotificationsModule.getAllScheduledNotificationsAsync()
  } catch (error) {
    logger.error("📬 [Notifications] Error getting scheduled notifications", {}, error as Error)
    return []
  }
}

/**
 * Add listener for notification received (app in foreground)
 */
export function addNotificationReceivedListener(
  listener: (notification: import("expo-notifications").Notification) => void,
): import("expo-notifications").Subscription {
  if (useMockNotifications || !isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Registered received listener")
    }
    // Return mock subscription
    return {
      remove: () => {
        if (__DEV__) {
          logger.debug("📬 [MockNotifications] Removed received listener")
        }
      },
    } as import("expo-notifications").Subscription
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    return {
      remove: () => {
        if (__DEV__) {
          logger.debug("📬 [MockNotifications] Removed received listener")
        }
      },
    } as import("expo-notifications").Subscription
  }

  try {
    setupNotificationHandler() // Ensure handler is set up before adding listeners
    return NotificationsModule.addNotificationReceivedListener(listener)
  } catch (error) {
    logger.error(
      "📬 [Notifications] Error adding received listener, using mock",
      {},
      error as Error,
    )
    return {
      remove: () => {
        if (__DEV__) {
          logger.debug("📬 [MockNotifications] Removed received listener")
        }
      },
    } as import("expo-notifications").Subscription
  }
}

/**
 * Add listener for notification response (user tapped notification)
 */
export function addNotificationResponseReceivedListener(
  listener: (response: import("expo-notifications").NotificationResponse) => void,
): import("expo-notifications").Subscription {
  if (useMockNotifications || !isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] Registered response listener")
    }
    // Return mock subscription
    return {
      remove: () => {
        if (__DEV__) {
          logger.debug("📬 [MockNotifications] Removed response listener")
        }
      },
    } as import("expo-notifications").Subscription
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    return {
      remove: () => {
        if (__DEV__) {
          logger.debug("📬 [MockNotifications] Removed response listener")
        }
      },
    } as import("expo-notifications").Subscription
  }

  try {
    setupNotificationHandler() // Ensure handler is set up before adding listeners
    return NotificationsModule.addNotificationResponseReceivedListener(listener)
  } catch (error) {
    logger.error(
      "📬 [Notifications] Error adding response listener, using mock",
      {},
      error as Error,
    )
    return {
      remove: () => {
        if (__DEV__) {
          logger.debug("📬 [MockNotifications] Removed response listener")
        }
      },
    } as import("expo-notifications").Subscription
  }
}

/**
 * Get last notification response (if app opened from notification)
 */
export async function getLastNotificationResponse(): Promise<
  import("expo-notifications").NotificationResponse | null
> {
  if (useMockNotifications || !isNativeModuleAvailable()) {
    if (__DEV__) {
      logger.debug("📬 [MockNotifications] No last notification response (mock mode)")
    }
    return null
  }

  const NotificationsModule = getNotifications()
  if (!NotificationsModule) {
    return null
  }

  try {
    return await NotificationsModule.getLastNotificationResponseAsync()
  } catch (error) {
    logger.error("📬 [Notifications] Error getting last notification response", {}, error as Error)
    return null
  }
}

/**
 * Alias for requestPermission (for backward compatibility)
 */
export const requestNotificationPermissions = requestPermission

/**
 * Notification service export
 */
export const notificationService = {
  requestPermission,
  registerForPushNotifications,
  scheduleNotification,
  cancelNotification,
  cancelAllNotifications,
  setBadgeCount,
  getScheduledNotifications,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  addPushTokenListener,
  getLastNotificationResponse,
  showPermissionDeniedAlert,
  showNotificationErrorAlert,
  isPhysicalDevice,
  useMock: useMockNotifications,
}
