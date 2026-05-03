import type * as Notifications from "expo-notifications"
import { Linking, Platform } from "react-native"
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

import {
  requestPermission as requestOsNotificationPermission,
  fetchNotificationPermissionStatus,
  registerForPushNotifications,
  scheduleNotification,
  cancelNotification,
  cancelAllNotifications,
  setBadgeCount as setAppBadgeCount,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  addPushTokenListener,
  getLastNotificationResponse,
  showPermissionDeniedAlert,
  type LocalNotificationInput,
} from "@/services/notifications"
import { syncPushNotificationsPreference, syncPushToken } from "@/services/preferencesSync"
import { useAuthStore } from "@/stores/auth"
import { logger } from "@/utils/Logger"
import { storage } from "@/utils/storage"

// Store listener subscriptions for cleanup
let notificationReceivedSubscription: Notifications.Subscription | null = null
let notificationResponseSubscription: Notifications.Subscription | null = null
let pushTokenSubscription: Notifications.Subscription | null = null
let isInitialized = false

export interface NotificationState {
  // Permission status
  permissionStatus: "granted" | "denied" | "undetermined" | "loading"

  // Push token
  pushToken: string | null

  // Notifications history (limited to last 50)
  notifications: Array<{
    id: string
    title: string
    body: string
    data?: Record<string, unknown>
    receivedAt: string
    read: boolean
  }>

  // Unread count
  unreadCount: number

  // Badge count
  badgeCount: number

  // Push enabled preference
  isPushEnabled: boolean

  // Actions
  initialize: () => Promise<void>
  cleanup: () => void
  /** Refresh OS permission (e.g. after returning from Settings). */
  syncPermissionFromOs: () => Promise<void>
  togglePush: (userId?: string) => Promise<void>
  requestPermission: () => Promise<boolean>
  registerForPush: () => Promise<void>
  scheduleNotification: (input: LocalNotificationInput) => Promise<string>
  cancelNotification: (id: string) => Promise<void>
  cancelAllNotifications: () => Promise<void>
  setBadgeCount: (count: number) => Promise<void>
  clearBadge: () => Promise<void>
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  addNotification: (notification: {
    id: string
    title: string
    body: string
    data?: Record<string, unknown>
  }) => void
  handleNotificationResponse: (response: Notifications.NotificationResponse) => void
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      permissionStatus: "undetermined",
      pushToken: null,
      notifications: [],
      unreadCount: 0,
      badgeCount: 0,
      isPushEnabled: false,

      initialize: async () => {
        // Prevent multiple initializations
        if (isInitialized) {
          if (__DEV__) {
            logger.debug("📬 [NotificationStore] Already initialized, skipping")
          }
          return
        }

        if (__DEV__) {
          logger.debug("📬 [NotificationStore] Initializing notification store")
        }

        // Read permission only — do not show the system dialog at app launch
        const { status } = await fetchNotificationPermissionStatus()
        set({
          permissionStatus: status,
          ...(status === "denied" ? { isPushEnabled: false } : {}),
        })

        // If granted, register for push
        if (status === "granted") {
          await get().registerForPush()
        }

        // Check if app was opened from notification
        const lastResponse = await getLastNotificationResponse()
        if (lastResponse) {
          get().handleNotificationResponse(lastResponse)
        }

        // Clean up existing listeners before adding new ones
        get().cleanup()

        // Listen for notifications while app is open
        notificationReceivedSubscription = addNotificationReceivedListener((notification) => {
          const { request } = notification
          get().addNotification({
            id: request.identifier,
            title: request.content.title || "",
            body: request.content.body || "",
            data: request.content.data,
          })
        })

        // Listen for notification taps
        notificationResponseSubscription = addNotificationResponseReceivedListener((response) => {
          get().handleNotificationResponse(response)
        })

        // Listen for push token changes (tokens can be invalidated and rolled)
        // Note: This receives native device tokens (iOS/Android), not Expo push tokens
        pushTokenSubscription = addPushTokenListener((token) => {
          if (__DEV__) {
            logger.debug("📬 [NotificationStore] Device push token changed", { token: token.data })
          }
          // Store the native device token - you may want to convert this to an Expo push token
          // For most use cases, you'll want to call registerForPushNotifications() again
          // to get an updated Expo push token when the native token changes
          // registerForPush() will also sync the new token to the backend
          void get().registerForPush()
        })

        isInitialized = true
        if (__DEV__) {
          logger.debug("📬 [NotificationStore] Initialization complete")
        }
      },

      cleanup: () => {
        // Clean up all listeners to prevent memory leaks
        if (notificationReceivedSubscription) {
          notificationReceivedSubscription.remove()
          notificationReceivedSubscription = null
        }
        if (notificationResponseSubscription) {
          notificationResponseSubscription.remove()
          notificationResponseSubscription = null
        }
        if (pushTokenSubscription) {
          pushTokenSubscription.remove()
          pushTokenSubscription = null
        }
        isInitialized = false
        if (__DEV__) {
          logger.debug("📬 [NotificationStore] Listeners cleaned up")
        }
      },

      syncPermissionFromOs: async () => {
        const { status } = await fetchNotificationPermissionStatus()
        set({
          permissionStatus: status,
          ...(status === "denied" ? { isPushEnabled: false } : {}),
        })
      },

      togglePush: async (userId?: string) => {
        const { isPushEnabled } = get()

        if (isPushEnabled) {
          set({ isPushEnabled: false })
          if (userId) syncPushNotificationsPreference(userId, false)
          return
        }

        const { status: osStatus } = await fetchNotificationPermissionStatus()
        set({ permissionStatus: osStatus })

        if (osStatus === "denied") {
          if (Platform.OS !== "web") {
            await Linking.openSettings()
          }
          return
        }

        if (osStatus === "granted") {
          set({ isPushEnabled: true })
          await get().registerForPush()
          if (userId) syncPushNotificationsPreference(userId, true)
          return
        }

        set({ permissionStatus: "loading" })
        const { status } = await requestOsNotificationPermission()
        set({ permissionStatus: status })

        if (status === "granted") {
          set({ isPushEnabled: true })
          await get().registerForPush()
          if (userId) syncPushNotificationsPreference(userId, true)
        } else if (status === "denied" && Platform.OS !== "web") {
          await Linking.openSettings()
        }
      },

      requestPermission: async () => {
        set({ permissionStatus: "loading" })
        const { status } = await requestOsNotificationPermission()
        set({ permissionStatus: status })

        if (status === "granted") {
          await get().registerForPush()
          return true
        }

        // Show alert only if explicitly denied (not undetermined)
        if (status === "denied") {
          showPermissionDeniedAlert()
        }

        return false
      },

      registerForPush: async () => {
        const token = await registerForPushNotifications()
        set({ pushToken: token })

        // Sync token to backend if user is authenticated
        if (token) {
          const userId = useAuthStore.getState().user?.id
          if (userId) {
            syncPushToken(userId, token)
          }
        }
      },

      scheduleNotification: async (input: LocalNotificationInput) => {
        return await scheduleNotification(input)
      },

      cancelNotification: async (id: string) => {
        await cancelNotification(id)
      },

      cancelAllNotifications: async () => {
        await cancelAllNotifications()
      },

      setBadgeCount: async (count: number) => {
        await setAppBadgeCount(count)
        set({ badgeCount: count })
      },

      clearBadge: async () => {
        await get().setBadgeCount(0)
      },

      markAsRead: (id: string) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          )
          const unreadCount = notifications.filter((n) => !n.read).length
          return { notifications, unreadCount }
        })

        // Update badge
        get().setBadgeCount(get().unreadCount)
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }))
        get().clearBadge()
      },

      addNotification: (notification) => {
        set((state) => {
          // Add new notification
          const newNotification = {
            ...notification,
            receivedAt: new Date().toISOString(),
            read: false,
          }

          // Keep only last 50 notifications
          const notifications = [newNotification, ...state.notifications].slice(0, 50)
          const unreadCount = notifications.filter((n) => !n.read).length

          return { notifications, unreadCount }
        })

        // Update badge
        get().setBadgeCount(get().unreadCount)
      },

      handleNotificationResponse: (response) => {
        const { notification } = response
        const { request } = notification
        const data = request.content.data

        // Mark as read
        get().markAsRead(request.identifier)

        // Handle deep linking (if data.screen is provided)
        if (data?.screen) {
          logger.debug("📬 [Notifications] Deep linking to screen", { screen: data.screen })
          // Deep linking will be handled by navigation listener
        }
      },
    }),
    {
      name: "notification-storage",
      storage: createJSONStorage(() => ({
        getItem: (key) => storage.getString(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      })),
      partialize: (state) => ({
        // Don't persist listeners
        permissionStatus: state.permissionStatus,
        pushToken: state.pushToken,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        badgeCount: state.badgeCount,
        isPushEnabled: state.isPushEnabled,
      }),
    },
  ),
)
