import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

const ACCESS_TOKEN_KEY = "vizory_biometric_access_token"
const REFRESH_TOKEN_KEY = "vizory_biometric_refresh_token"

/** Legacy keys from password-based biometric auth — removed on clear/save. */
const LEGACY_EMAIL_KEY = "vizory_biometric_login_email"
const LEGACY_PASSWORD_KEY = "vizory_biometric_login_password"

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

async function deleteLegacyCredentialKeys(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LEGACY_EMAIL_KEY)
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(LEGACY_PASSWORD_KEY)
  } catch {
    // ignore
  }
}

export async function saveBiometricSessionTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  if (Platform.OS === "web") return
  await deleteLegacyCredentialKeys()
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, secureOptions)
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, secureOptions)
}

export async function hasBiometricSessionTokens(): Promise<boolean> {
  if (Platform.OS === "web") return false
  try {
    const access = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
    return access != null && access.length > 0
  } catch {
    return false
  }
}

export async function getBiometricSessionTokens(): Promise<{
  access_token: string
  refresh_token: string
} | null> {
  if (Platform.OS === "web") return null
  try {
    const access_token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
    const refresh_token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
    if (!access_token || !refresh_token) return null
    return { access_token, refresh_token }
  } catch {
    return null
  }
}

/**
 * True when `setSession` failed because the stored refresh token is invalid,
 * revoked, or missing (safe to clear SecureStore and prompt for password sign-in).
 */
export function isRevokedOrInvalidStoredRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as { code?: string; message?: string }
  const code = (e.code ?? "").toLowerCase()
  const msg = (e.message ?? "").toLowerCase()

  const codes = [
    "refresh_token_not_found",
    "invalid_refresh_token",
    "invalid_grant",
    "session_not_found",
  ]
  if (codes.some((c) => code === c)) return true

  if (msg.includes("refresh token") && (msg.includes("not found") || msg.includes("invalid") || msg.includes("revoked"))) {
    return true
  }
  if (msg.includes("invalid refresh token")) return true

  return false
}

export async function clearBiometricSessionTokens(): Promise<void> {
  if (Platform.OS === "web") return
  await deleteLegacyCredentialKeys()
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
  } catch {
    // ignore
  }
}
