import { useState, useEffect, useRef } from "react"
import { View, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { AuthScreenLayout } from "@/components/layouts/AuthScreenLayout"
import { Spinner } from "@/components/Spinner"
import { Text } from "@/components/Text"
import { TIMING } from "@/config/constants"
import { useAuth } from "@/hooks"
import { useEmailVerificationPolling } from "@/hooks/useEmailVerificationPolling"
import { useAuthStore } from "@/stores/auth"
import type { AuthState } from "@/stores/auth/authTypes"

// =============================================================================
// COMPONENT
// =============================================================================

export const EmailVerificationScreen = () => {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const navigation = useNavigation()
  const { isEmailVerified } = useAuth()
  // Email verification polling uses the backend abstraction layer
  const user = useAuthStore((state: AuthState) => state.user)
  const resendConfirmationEmail = useAuthStore((state: AuthState) => state.resendConfirmationEmail)
  const initialize = useAuthStore((state: AuthState) => state.initialize)
  const isEmailConfirmed = isEmailVerified

  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState("")
  const [countdown, setCountdown] = useState(0)

  // Track when resend was last called to pause polling briefly
  const resendTimestampRef = useRef<number>(0)
  const resendSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use polling hook
  const { checkingStatus } = useEmailVerificationPolling({
    isEmailConfirmed,
    user,
    initialize,
    resendTimestampRef,
  })

  const email = user?.email || ""

  // Redirect if no email - industry standard UX: don't show verification screen without email
  useEffect(() => {
    if (!email && user?.id) {
      // User exists but no email - redirect to register
      navigation.navigate("Register" as never)
      return
    }
    if (!user?.id) {
      // No user at all - redirect to login
      navigation.navigate("Login" as never)
      return
    }
  }, [email, user?.id, navigation])

  // Countdown timer for resend email
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, TIMING.SECOND_MS)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [countdown])

  useEffect(() => {
    return () => {
      if (resendSuccessTimeoutRef.current) {
        clearTimeout(resendSuccessTimeoutRef.current)
      }
    }
  }, [])

  const handleResendEmail = async () => {
    if (countdown > 0 || !email) return

    setResending(true)
    setResendError("")
    setResendSuccess(false)

    try {
      // Record timestamp to pause polling
      resendTimestampRef.current = Date.now()

      const { error } = await resendConfirmationEmail(email)

      if (error) {
        setResendError(error.message || t("emailVerificationScreen:resendError"))
      } else {
        setResendSuccess(true)
        // Start countdown
        setCountdown(TIMING.COUNTDOWN_RESEND_EMAIL)
        // Clear success message after duration
        if (resendSuccessTimeoutRef.current) {
          clearTimeout(resendSuccessTimeoutRef.current)
        }
        resendSuccessTimeoutRef.current = setTimeout(() => {
          setResendSuccess(false)
          resendSuccessTimeoutRef.current = null
        }, TIMING.SUCCESS_MESSAGE_DURATION)
      }
    } catch (err) {
      // Handle any unexpected errors
      setResendError(
        err instanceof Error ? err.message : t("emailVerificationScreen:unexpectedError"),
      )
    } finally {
      setResending(false)
    }
  }

  const handleChangeEmail = () => {
    // Navigate back to register screen
    navigation.navigate("Register" as never)
  }

  const handleBackToLogin = () => {
    // Sign out and go to login
    useAuthStore.getState().signOut()
    navigation.navigate("Login" as never)
  }

  // Don't render if no email - will redirect via useEffect
  if (!email) {
    return null
  }

  return (
    <AuthScreenLayout
      titleTx="emailVerificationScreen:title"
      subtitle={t("emailVerificationScreen:subtitle", { email })}
      showCloseButton={false}
      scrollable
    >
      {/* Email Icon */}
      <View style={styles.iconContainer}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.secondary }]}>
          <Ionicons name="mail-outline" size={64} color={theme.colors.primary} />
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.contentContainer}>
        <Text
          size="lg"
          weight="semiBold"
          style={styles.instructionText}
          tx="emailVerificationScreen:checkInbox"
        />
        <Text size="sm" color="secondary" style={styles.descriptionText}>
          {t("emailVerificationScreen:description", { email })}
        </Text>

        {/* Checking Status Indicator */}
        {checkingStatus && (
          <View style={styles.statusContainer}>
            <Spinner size="sm" />
            <Text
              size="sm"
              color="secondary"
              style={styles.statusText}
              tx="emailVerificationScreen:checkingStatus"
            />
          </View>
        )}

        {/* Success Message */}
        {resendSuccess && (
          <View
            style={[styles.messageContainer, { backgroundColor: theme.colors.successBackground }]}
          >
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text
              size="sm"
              color="success"
              style={styles.messageText}
              tx="emailVerificationScreen:resendSuccess"
            />
          </View>
        )}

        {/* Error Message */}
        {resendError && (
          <View
            style={[styles.messageContainer, { backgroundColor: theme.colors.errorBackground }]}
          >
            <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
            <Text size="sm" color="error" style={styles.messageText}>
              {resendError}
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            countdown > 0 && styles.primaryButtonDisabled,
            {
              backgroundColor: countdown > 0 ? theme.colors.secondary : theme.colors.accent,
            },
          ]}
          onPress={handleResendEmail}
          disabled={resending || countdown > 0}
          activeOpacity={0.8}
        >
          {resending ? (
            <Spinner size="sm" color="white" />
          ) : countdown > 0 ? (
            <>
              <Ionicons name="time-outline" size={20} color={theme.colors.foreground} />
              <Text
                weight="semiBold"
                style={[styles.primaryButtonText, styles.primaryButtonTextDisabled]}
              >
                {t("emailVerificationScreen:resendIn", { seconds: countdown })}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="refresh" size={20} color={theme.colors.accentForeground} />
              <Text
                weight="semiBold"
                style={styles.primaryButtonText}
                tx="emailVerificationScreen:resendEmail"
              />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleChangeEmail}
          activeOpacity={0.6}
        >
          <Text style={styles.linkAccent}>
            <Text tx="emailVerificationScreen:wrongEmail" />{" "}
            <Text weight="semiBold" tx="emailVerificationScreen:changeIt" />
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={handleBackToLogin} activeOpacity={0.6}>
          <Text style={styles.linkAccent}>
            <Text tx="emailVerificationScreen:alreadyConfirmed" />{" "}
            <Text weight="semiBold" tx="emailVerificationScreen:signIn" />
          </Text>
        </TouchableOpacity>
      </View>
    </AuthScreenLayout>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  iconContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
  },
  instructionText: {
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  descriptionText: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  statusText: {
    marginLeft: theme.spacing.xs,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    width: "100%",
  },
  messageText: {
    flex: 1,
  },
  actionsContainer: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    color: theme.colors.accentForeground,
    fontSize: theme.typography.sizes.lg,
  },
  primaryButtonDisabled: {
    // No opacity reduction - keep button fully visible
  },
  primaryButtonTextDisabled: {
    color: theme.colors.foreground,
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  linkAccent: {
    color: theme.colors.accent,
  },
}))
