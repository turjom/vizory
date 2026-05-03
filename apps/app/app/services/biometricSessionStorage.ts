/**
 * Biometric "vault": stores email + password in Expo SecureStore (Keychain / Keystore–backed)
 * after a successful password sign-in. After LocalAuthentication, we call
 * `signInWithPassword` — no session refresh tokens, so token rotation cannot desync the vault.
 */

import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

const EMAIL_KEY = "vizory_biometric_login_email"
const PASSWORD_KEY = "vizory_biometric_login_password"

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
export async function saveBiometricLoginCredentials(email: string, password: string): Promise<void> {
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
