/**
 * One-time prompt after first Dashboard visit: opt into biometric login.
 */

import type { FC } from "react"
import { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import {
  clearBiometricLoginCredentials,
  hasBiometricLoginCredentials,
  saveBiometricLoginCredentials,
  setBiometricEnabled,
  setBiometricEnrollmentPrompted,
} from "@/services/biometricSessionStorage"
import { haptics } from "@/utils/haptics"

import { Text } from "./Text"
import { TextField } from "./TextField"

export interface BiometricEnrollmentModalProps {
  visible: boolean
  /** Supabase auth user id — scopes enrollment prompted flag in SecureStore */
  userId: string
  userEmail: string | null
  onClose: () => void
}

export const BiometricEnrollmentModal: FC<BiometricEnrollmentModalProps> = ({
  visible,
  userId,
  userEmail,
  onClose,
}) => {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const [password, setPassword] = useState("")
  const [needsPassword, setNeedsPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const resetTransient = useCallback(() => {
    setPassword("")
    setNeedsPassword(false)
    setError("")
    setBusy(false)
  }, [])

  useEffect(() => {
    // TEMP: [BiometricDiag] remove after fixing biometric enrollment visibility
    console.log("[BiometricDiag] BiometricEnrollmentModal props", {
      visible,
      userId: userId || null,
      hasUserEmail: !!userEmail?.trim(),
    })
    if (visible) resetTransient()
  }, [visible, resetTransient, userEmail, userId])

  const handleClose = useCallback(() => {
    resetTransient()
    onClose()
  }, [onClose, resetTransient])

  const handleSkip = useCallback(async () => {
    haptics.buttonPress()
    setBusy(true)
    try {
      await clearBiometricLoginCredentials()
      await setBiometricEnabled(false)
      await setBiometricEnrollmentPrompted(true, userId)
      handleClose()
    } finally {
      setBusy(false)
    }
  }, [handleClose, userId])

  const handleEnable = useCallback(async () => {
    haptics.buttonPress()
    const email = userEmail?.trim() ?? ""
    if (!email) {
      setError(t("biometricEnrollment:noEmail"))
      return
    }

    setBusy(true)
    setError("")
    try {
      const alreadyStored = await hasBiometricLoginCredentials()
      if (alreadyStored) {
        await setBiometricEnabled(true)
        await setBiometricEnrollmentPrompted(true, userId)
        handleClose()
        return
      }

      if (!needsPassword) {
        setNeedsPassword(true)
        setBusy(false)
        return
      }

      if (!password.trim()) {
        setError(t("biometricEnrollment:passwordRequired"))
        setBusy(false)
        return
      }

      await saveBiometricLoginCredentials(email, password)
      await setBiometricEnabled(true)
      await setBiometricEnrollmentPrompted(true, userId)
      handleClose()
    } catch {
      setError(t("biometricEnrollment:enableFailed"))
    } finally {
      setBusy(false)
    }
  }, [userEmail, userId, needsPassword, password, handleClose, t])

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="finger-print-outline" size={48} color="#F97316" />
          </View>
          <Text style={[styles.title, { color: theme.colors.foreground }]} tx="biometricEnrollment:title" />
          <Text
            style={[styles.subtitle, { color: theme.colors.foregroundSecondary }]}
            tx="biometricEnrollment:subtitle"
          />

          {needsPassword ? (
            <TextField
              labelTx="biometricEnrollment:passwordLabel"
              placeholderTx="biometricEnrollment:passwordPlaceholder"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              containerStyle={styles.passwordField}
            />
          ) : null}

          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]} text={error} />
          ) : null}

          <Pressable
            style={[styles.enableButton, busy && styles.buttonDisabled]}
            onPress={() => void handleEnable()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.enableButtonText} tx="biometricEnrollment:enable" />
            )}
          </Pressable>

          <Pressable style={styles.skipPressable} onPress={() => void handleSkip()} disabled={busy}>
            <Text style={[styles.skipText, { color: theme.colors.foregroundTertiary }]} tx="biometricEnrollment:skip" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 24,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  passwordField: {
    marginBottom: 8,
  },
  error: {
    fontSize: 13,
    marginBottom: 8,
    textAlign: "center",
  },
  enableButton: {
    backgroundColor: "#F97316",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  enableButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  skipPressable: {
    paddingVertical: 14,
    alignItems: "center",
  },
  skipText: {
    fontSize: 16,
    fontWeight: "500",
  },
})
