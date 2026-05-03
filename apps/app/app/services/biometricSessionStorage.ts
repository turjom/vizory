import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

import type { Session } from "../types/auth"

const ACCESS_TOKEN_KEY = "vizory_biometric_access_token"
const REFRESH_TOKEN_KEY = "vizory_biometric_refresh_token"

/** Legacy keys from password-based biometric auth — removed on clear/save. */
const LEGACY_EMAIL_KEY = "vizory_biometric_login_email"
const LEGACY_PASSWORD_KEY = "vizory_biometric_login_password"

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

function logBiometric(message: string, data?: Record<string, unknown>) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[BiometricFlow]", message, data ?? "")
  }
}

/**
 * GoTrue session refresh token for `supabase.auth.refreshSession({ refresh_token })`.
 * This is always `session.refresh_token`, never `provider_refresh_token` (OAuth provider token).
 *
 * GoTrue issues opaque refresh strings; on current Supabase projects they are often short (~12
 * characters) while `access_token` remains a long JWT — that length difference is expected.
 */
export function getGoTrueRefreshTokenFromSession(
  session: Session | null | undefined,
): string | null {
  if (!session) return null
  const rt = session.refresh_token
  if (typeof rt !== "string" || rt.length === 0) return null
  return rt
}

/**
 * When the user already has tokens in the biometric vault, keep them aligned with the active
 * Supabase session after rotation (`TOKEN_REFRESHED`) or sign-in.
 */
export async function syncBiometricVaultIfEnabled(session: Session): Promise<void> {
  if (Platform.OS === "web") return
  if (!(await hasBiometricSessionTokens())) return
  const refresh = getGoTrueRefreshTokenFromSession(session)
  if (!session.access_token || !refresh) return
  await saveBiometricSessionTokens(session.access_token, refresh)
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
  // eslint-disable-next-line no-console
  console.log("[BiometricFlow] saveBiometricSessionTokens: called", {
    platform: Platform.OS,
    accessTokenLen: typeof accessToken === "string" ? accessToken.length : -1,
    refreshTokenLen: typeof refreshToken === "string" ? refreshToken.length : -1,
  })
  if (Platform.OS === "web") {
    logBiometric("saveBiometricSessionTokens: skipped (web)")
    return
  }
  logBiometric("saveBiometricSessionTokens: writing", {
    accessTokenLen: accessToken.length,
    refreshTokenLen: refreshToken.length,
  })
  await deleteLegacyCredentialKeys()
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, secureOptions)
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, secureOptions)
  logBiometric("saveBiometricSessionTokens: done")
}

export async function hasBiometricSessionTokens(): Promise<boolean> {
  if (Platform.OS === "web") {
    logBiometric("hasBiometricSessionTokens: false (web)")
    return false
  }
  try {
    const access = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
    const has = access != null && access.length > 0
    logBiometric("hasBiometricSessionTokens", { has, accessLen: access?.length ?? 0 })
    return has
  } catch (e) {
    logBiometric("hasBiometricSessionTokens: error", { message: String(e) })
    return false
  }
}

export async function getBiometricSessionTokens(): Promise<{
  access_token: string
  refresh_token: string
} | null> {
  if (Platform.OS === "web") {
    logBiometric("getBiometricSessionTokens: null (web)")
    return null
  }
  try {
    const access_token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
    const refresh_token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
    if (!access_token || !refresh_token) {
      logBiometric("getBiometricSessionTokens: missing one or both", {
        hasAccess: !!access_token,
        hasRefresh: !!refresh_token,
      })
      return null
    }
    logBiometric("getBiometricSessionTokens: ok", {
      accessLen: access_token.length,
      refreshLen: refresh_token.length,
    })
    return { access_token, refresh_token }
  } catch (e) {
    logBiometric("getBiometricSessionTokens: error", { message: String(e) })
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
  if (Platform.OS === "web") {
    logBiometric("clearBiometricSessionTokens: skipped (web)")
    return
  }
  logBiometric("clearBiometricSessionTokens: clearing vault keys")
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
  logBiometric("clearBiometricSessionTokens: done")
}
