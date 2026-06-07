/**
 * Biometric "vault": stores email + password in Expo SecureStore (Keychain / Keystore–backed)
 * after a successful password sign-in. After LocalAuthentication, we call
 * `signInWithPassword` — no session refresh tokens, so token rotation cannot desync the vault.
 */

import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"

const EMAIL_KEY = "vizory_biometric_login_email"
const PASSWORD_KEY = "vizory_biometric_login_password"
const BIOMETRIC_ENABLED_KEY = "biometric_enabled"
const BIOMETRIC_ENROLLMENT_PROMPTED_PREFIX = "biometric_enrollment_prompted_"

export function biometricEnrollmentPromptedStorageKey(userId: string): string {
  return `${BIOMETRIC_ENROLLMENT_PROMPTED_PREFIX}${userId}`
}

/** Previous token-based vault keys — removed whenever credentials are saved or cleared. */
const LEGACY_ACCESS_TOKEN_KEY = "vizory_biometric_access_token"
const LEGACY_REFRESH_TOKEN_KEY = "vizory_biometric_refresh_token"

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

function logBiometric(message: string, data?: Record<string, unknown>) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[BiometricFlow]", message, data ?? "")
  }
}

async function clearLegacyTokenKeys(): Promise<void> {
  for (const key of [LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]) {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch {
      // ignore
    }
  }
}

/**
 * Persist login email and password for biometric sign-in (SecureStore encryption at rest).
 * Clears any legacy session-token vault keys.
 */
export async function saveBiometricLoginCredentials(
  email: string,
  password: string,
): Promise<void> {
  if (Platform.OS === "web") {
    logBiometric("saveBiometricLoginCredentials: skipped (web)")
    return
  }
  const trimmedEmail = email.trim()
  await clearLegacyTokenKeys()
  await SecureStore.setItemAsync(EMAIL_KEY, trimmedEmail, secureOptions)
  await SecureStore.setItemAsync(PASSWORD_KEY, password, secureOptions)
  logBiometric("saveBiometricLoginCredentials: done", { emailLen: trimmedEmail.length })
}

export async function hasBiometricLoginCredentials(): Promise<boolean> {
  if (Platform.OS === "web") {
    logBiometric("hasBiometricLoginCredentials: false (web)")
    return false
  }
  try {
    const email = await SecureStore.getItemAsync(EMAIL_KEY)
    const password = await SecureStore.getItemAsync(PASSWORD_KEY)
    const has = !!(email && email.length > 0 && password && password.length > 0)
    logBiometric("hasBiometricLoginCredentials", { has })
    return has
  } catch (e) {
    logBiometric("hasBiometricLoginCredentials: error", { message: String(e) })
    return false
  }
}

export async function getBiometricLoginCredentials(): Promise<{
  email: string
  password: string
} | null> {
  if (Platform.OS === "web") {
    logBiometric("getBiometricLoginCredentials: null (web)")
    return null
  }
  try {
    const email = await SecureStore.getItemAsync(EMAIL_KEY)
    const password = await SecureStore.getItemAsync(PASSWORD_KEY)
    if (!email || !password) {
      logBiometric("getBiometricLoginCredentials: missing one or both", {
        hasEmail: !!email,
        hasPassword: !!password,
      })
      return null
    }
    logBiometric("getBiometricLoginCredentials: ok", { emailLen: email.length })
    return { email, password }
  } catch (e) {
    logBiometric("getBiometricLoginCredentials: error", { message: String(e) })
    return null
  }
}

export async function clearBiometricLoginCredentials(): Promise<void> {
  if (Platform.OS === "web") {
    logBiometric("clearBiometricLoginCredentials: skipped (web)")
    return
  }
  logBiometric("clearBiometricLoginCredentials: clearing vault")
  await clearLegacyTokenKeys()
  try {
    await SecureStore.deleteItemAsync(EMAIL_KEY)
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(PASSWORD_KEY)
  } catch {
    // ignore
  }
  logBiometric("clearBiometricLoginCredentials: done")
}

/** User opt-in for showing biometric sign-in (device-wide SecureStore flag). */
export async function getBiometricEnabled(): Promise<boolean | null> {
  if (Platform.OS === "web") {
    return null
  }
  try {
    const v = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)
    if (v == null) return null
    return v === "true"
  } catch (e) {
    logBiometric("getBiometricEnabled: error", { message: String(e) })
    return null
  }
}

export async function setBiometricEnabled(value: boolean): Promise<void> {
  if (Platform.OS === "web") {
    return
  }
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, value ? "true" : "false", secureOptions)
  logBiometric("setBiometricEnabled", { value })
}

/** One-time Dashboard enrollment prompt completed (or skipped / ineligible), scoped per user. */
export async function getBiometricEnrollmentPrompted(userId: string): Promise<boolean> {
  const id = userId.trim()
  if (Platform.OS === "web") {
    // TEMP: [BiometricDiag]
    console.log("[BiometricDiag] getBiometricEnrollmentPrompted: web → treated as prompted=true")
    return true
  }
  if (!id) {
    logBiometric("getBiometricEnrollmentPrompted: empty userId → treated as prompted")
    return true
  }
  const key = biometricEnrollmentPromptedStorageKey(id)
  try {
    const v = await SecureStore.getItemAsync(key)
    const result = v === "true"
    // TEMP: [BiometricDiag] raw SecureStore value — must be exactly "true" string to count as prompted
    console.log("[BiometricDiag] getBiometricEnrollmentPrompted", {
      rawKey: key,
      rawValue: v,
      parsedPrompted: result,
    })
    return result
  } catch (e) {
    logBiometric("getBiometricEnrollmentPrompted: error", { message: String(e) })
    // TEMP: [BiometricDiag]
    console.log("[BiometricDiag] getBiometricEnrollmentPrompted: error → returning false", {
      message: String(e),
    })
    return false
  }
}

export async function setBiometricEnrollmentPrompted(
  value: boolean,
  userId: string,
): Promise<void> {
  const id = userId.trim()
  if (Platform.OS === "web") {
    return
  }
  if (!id) {
    logBiometric("setBiometricEnrollmentPrompted: skipped (empty userId)", { value })
    return
  }
  const key = biometricEnrollmentPromptedStorageKey(id)
  await SecureStore.setItemAsync(key, value ? "true" : "false", secureOptions)
  logBiometric("setBiometricEnrollmentPrompted", { value, userId: id })
}
