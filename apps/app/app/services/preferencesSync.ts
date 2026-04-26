/**
 * Preferences Sync Service
 *
 * Handles syncing user preferences (theme, notifications) between
 * local storage and the backend database.
 *
 * - Supabase: Uses profiles table for preferences, push_tokens table for tokens
 * - Convex: Preferences use Convex mutations, push tokens use convex/pushTokens.ts
 *
 * Uses fire-and-forget pattern for updates to avoid blocking UI.
 */

import { Platform } from "react-native"
import * as Device from "expo-device"
import { UnistylesRuntime } from "react-native-unistyles"

import { isSupabase } from "../config/env"
import { useNotificationStore } from "../stores/notificationStore"
import type { SupabaseDatabase, UserPreferences } from "../types/supabase"
import { logger } from "../utils/Logger"
import { storage } from "../utils/storage"
import { sentry } from "./sentry"

// Conditionally import Supabase - only when using Supabase backend
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase, isUsingMockSupabase } = isSupabase
  ? require("./supabase")
  : { supabase: null, isUsingMockSupabase: true }

// Convex removed - using Supabase only
const convexPushTokens = null

// For preferences (theme, notifications settings), skip sync for Convex (use React mutations instead)
const shouldSkipPreferenceSync = isUsingMockSupabase // Convex removed

type _ProfilesUpdate = SupabaseDatabase["public"]["Tables"]["profiles"]["Update"]
type PushTokenInsert = SupabaseDatabase["public"]["Tables"]["push_tokens"]["Insert"]

// Storage keys (must match the keys used in theme context and notification store)
const THEME_STORAGE_KEY = "shipnative.themeScheme"

/**
 * Fetch user preferences from the database
 * Returns null if using Convex, mock mode, or if fetch fails
 *
 * For Convex: Preferences are part of the user object from useQuery(api.users.me)
 */
export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  if (shouldSkipPreferenceSync) {
    logger.debug("Skipping preference fetch (Convex or mock mode)")
    return null
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "dark_mode_enabled, notifications_enabled, push_notifications_enabled, email_notifications_enabled",
      )
      .eq("id", userId)
      .single()

    if (error) {
      // Table might not exist or user has no profile yet - that's okay
      logger.debug("Failed to fetch user preferences", { error: error.message })
      return null
    }

    return data as UserPreferences
  } catch (error) {
    logger.debug("Error fetching user preferences", { error })
    return null
  }
}

/**
 * Update a single preference in the database (fire-and-forget)
 * Does not block - updates happen in background
 *
 * For Convex: Use useMutation(api.users.updatePreferences) instead
 */
export function updatePreference(
  userId: string,
  preference: keyof UserPreferences,
  value: boolean,
): void {
  if (shouldSkipPreferenceSync) {
    logger.debug(`Skipping ${preference} sync (Convex or mock mode)`)
    return
  }

  const update = {
    id: userId,
    [preference]: value,
    updated_at: new Date().toISOString(),
  } as const

  // Fire and forget - don't await
  Promise.resolve(supabase.from("profiles").upsert(update))
    .then(({ error }) => {
      if (error) {
        logger.debug(`Failed to sync ${preference} preference`, { error: error.message })
      } else {
        logger.debug(`Synced ${preference} preference to database`, { value })
      }
    })
    .catch((err: unknown) => {
      logger.error(`Error syncing ${preference} preference`, {}, err as Error)
      sentry.captureException(err as Error, {
        tags: { context: "preferences_sync", preference },
      })
    })
}

/**
 * Update dark mode preference
 */
export function syncDarkModePreference(userId: string, enabled: boolean): void {
  updatePreference(userId, "dark_mode_enabled", enabled)
}

/**
 * Update push notifications preference
 */
export function syncPushNotificationsPreference(userId: string, enabled: boolean): void {
  updatePreference(userId, "push_notifications_enabled", enabled)
}

/**
 * Update general notifications preference
 */
export function syncNotificationsPreference(userId: string, enabled: boolean): void {
  updatePreference(userId, "notifications_enabled", enabled)
}

/**
 * Update email notifications preference
 */
export function syncEmailNotificationsPreference(userId: string, enabled: boolean): void {
  updatePreference(userId, "email_notifications_enabled", enabled)
}

/**
 * Sync all preferences at once (fire-and-forget)
 *
 * For Convex: Use useMutation(api.users.updatePreferences) instead
 */
export function syncAllPreferences(userId: string, preferences: Partial<UserPreferences>): void {
  if (shouldSkipPreferenceSync) {
    logger.debug("Skipping all preferences sync (Convex or mock mode)")
    return
  }

  const update = {
    id: userId,
    ...preferences,
    updated_at: new Date().toISOString(),
  }

  Promise.resolve(supabase.from("profiles").upsert({ ...update, id: userId }))
    .then(({ error }) => {
      if (error) {
        logger.debug("Failed to sync preferences", { error: error.message })
      } else {
        logger.debug("Synced all preferences to database")
      }
    })
    .catch((err: unknown) => {
      logger.error("Error syncing preferences", {}, err as Error)
      sentry.captureException(err as Error, {
        tags: { context: "preferences_sync", preference: "all" },
      })
    })
}

/**
 * Apply fetched preferences to local storage and stores
 * Call this after successful login to sync server preferences to local state
 */
export function applyUserPreferences(preferences: UserPreferences): void {
  // Apply dark mode preference
  if (preferences.dark_mode_enabled !== null) {
    const themeValue = preferences.dark_mode_enabled ? "dark" : "light"
    storage.set(THEME_STORAGE_KEY, themeValue)
    // Update Unistyles runtime
    UnistylesRuntime.setAdaptiveThemes(false)
    UnistylesRuntime.setTheme(themeValue)
    logger.debug("Applied dark mode preference from database", {
      value: preferences.dark_mode_enabled,
    })
  }

  // Apply push notifications preference
  if (preferences.push_notifications_enabled !== null) {
    // Get the notification store state and update it
    const notificationState = useNotificationStore.getState()
    if (notificationState.isPushEnabled !== preferences.push_notifications_enabled) {
      useNotificationStore.setState({ isPushEnabled: preferences.push_notifications_enabled })
      logger.debug("Applied push notification preference from database", {
        value: preferences.push_notifications_enabled,
      })
    }
  }
}

/**
 * Fetch and apply user preferences on login
 * Returns true if preferences were successfully fetched and applied
 */
export async function fetchAndApplyUserPreferences(userId: string): Promise<boolean> {
  const preferences = await fetchUserPreferences(userId)

  if (preferences) {
    applyUserPreferences(preferences)
    return true
  }

  return false
}

// =====================================================================
// PUSH TOKEN SYNC
// =====================================================================

/**
 * Get a unique device identifier
 * Uses a combination of device info to create a stable ID
 */
function getDeviceId(): string {
  // Create a pseudo-unique device ID from available device info
  const parts = [Platform.OS, Device.modelName ?? "unknown", Device.osVersion ?? "unknown"]
  return parts.join("-").toLowerCase().replace(/\s+/g, "-")
}

/**
 * Get a human-readable device name
 */
function getDeviceName(): string {
  if (Platform.OS === "web") {
    return "Web Browser"
  }
  return Device.modelName ?? `${Platform.OS} Device`
}

/**
 * Get the platform type for the database
 */
function getPlatform(): "ios" | "android" | "web" {
  if (Platform.OS === "ios") return "ios"
  if (Platform.OS === "android") return "android"
  return "web"
}

/**
 * Sync push token to the database
 * Uses upsert to handle both new tokens and updates
 *
 * Works with both Supabase and Convex backends.
 *
 * @param userId - The authenticated user's ID (ignored for Convex, uses auth context)
 * @param token - The Expo push token (e.g., ExponentPushToken[xxx])
 */
export function syncPushToken(userId: string, token: string): void {
  if (!token) {
    logger.debug("No push token to sync")
    return
  }

  // Use Convex push token service if available
  // Convex push tokens removed

  // Skip if mock mode (no Supabase)
  if (isUsingMockSupabase) {
    logger.debug("Skipping push token sync (mock mode)")
    return
  }

  const tokenData: PushTokenInsert = {
    user_id: userId,
    token,
    device_id: getDeviceId(),
    device_name: getDeviceName(),
    platform: getPlatform(),
    is_active: true,
    last_used_at: new Date().toISOString(),
  }

  // Fire and forget - use upsert with unique constraint on (user_id, token)
  Promise.resolve(supabase.from("push_tokens").upsert(tokenData, { onConflict: "user_id,token" }))
    .then(({ error }) => {
      if (error) {
        logger.debug("Failed to sync push token", { error: error.message })
      } else {
        logger.debug("Push token synced to database", {
          platform: tokenData.platform,
          deviceName: tokenData.device_name,
        })
      }
    })
    .catch((err: unknown) => {
      logger.error("Error syncing push token", {}, err as Error)
      sentry.captureException(err as Error, {
        tags: { context: "preferences_sync", preference: "push_token" },
      })
    })
}

/**
 * Deactivate push token when user logs out or disables notifications
 * Instead of deleting, we mark as inactive to maintain history
 *
 * Works with both Supabase and Convex backends.
 *
 * @param userId - The authenticated user's ID (ignored for Convex, uses auth context)
 * @param token - The Expo push token to deactivate
 */
export function deactivatePushToken(userId: string, token: string): void {
  if (!token) {
    return
  }

  // Use Convex push token service if available
  // Convex push tokens removed

  // Skip if mock mode (no Supabase)
  if (isUsingMockSupabase) {
    return
  }

  Promise.resolve(
    supabase
      .from("push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("token", token),
  )
    .then(({ error }) => {
      if (error) {
        logger.debug("Failed to deactivate push token", { error: error.message })
      } else {
        logger.debug("Push token deactivated")
      }
    })
    .catch((err: unknown) => {
      logger.error("Error deactivating push token", {}, err as Error)
      sentry.captureException(err as Error, {
        tags: { context: "preferences_sync", preference: "deactivate_token" },
      })
    })
}

/**
 * Deactivate all push tokens for a user (e.g., on logout)
 *
 * Works with both Supabase and Convex backends.
 *
 * @param userId - The authenticated user's ID (ignored for Convex, uses auth context)
 */
export function deactivateAllPushTokens(userId: string): void {
  // Use Convex push token service if available
  // Convex push tokens removed

  // Skip if mock mode (no Supabase)
  if (isUsingMockSupabase) {
    return
  }

  Promise.resolve(
    supabase
      .from("push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId),
  )
    .then(({ error }) => {
      if (error) {
        logger.debug("Failed to deactivate all push tokens", { error: error.message })
      } else {
        logger.debug("All push tokens deactivated for user")
      }
    })
    .catch((err: unknown) => {
      logger.error("Error deactivating all push tokens", {}, err as Error)
      sentry.captureException(err as Error, {
        tags: { context: "preferences_sync", preference: "deactivate_all_tokens" },
      })
    })
}
