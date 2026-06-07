/**
 * OTPVerificationScreen - Enter OTP code sent via email
 *
 * Features:
 * - 6-digit OTP input with auto-focus and paste support
 * - Auto-submit when code is complete
 * - Resend code with countdown timer
 * - Works with both Supabase and Convex backends
 * - Loading states and error handling
 *
 * For Convex: Uses useAuthActions() hook directly
 * For Supabase: Uses useAuth().verifyOtp()
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { View, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { AuthScreenLayout } from "@/components/layouts/AuthScreenLayout"
import { OTPInput } from "@/components/OTPInput"
import { Spinner } from "@/components/Spinner"
import { Text } from "@/components/Text"
import { TIMING } from "@/config/constants"
import { isConvex } from "@/config/env"
import { useAuth } from "@/hooks"
import { AppStackParamList } from "@/navigators/navigationTypes"
import { formatAuthError } from "@/utils/formatAuthError"

// =============================================================================
// TYPES
// =============================================================================

type OTPVerificationRouteProp = RouteProp<AppStackParamList, "OTPVerification">

// OTP lengths by provider
const OTP_LENGTH_SUPABASE = 6
const OTP_LENGTH_CONVEX = 8

// =============================================================================
// COMPONENT
// =============================================================================

export const OTPVerificationScreen = () => {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const route = useRoute<OTPVerificationRouteProp>()
  const { verifyOtp, signInWithMagicLink, initialize } = useAuth()

  const { email, isConvex: routeIsConvex } = route.params || {}
  const useConvexAuth = routeIsConvex ?? isConvex

  // Determine OTP length based on backend
  const otpLength = useConvexAuth ? OTP_LENGTH_CONVEX : OTP_LENGTH_SUPABASE

  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Track if we've already attempted verification to prevent double-submit
  const verificationAttempted = useRef(false)
  const resendSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Redirect if no email provided
  useEffect(() => {
    if (!email) {
      navigation.navigate("MagicLink")
    }
  }, [email, navigation])

  // Countdown timer for resend
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

  // Handle OTP verification
  const handleVerify = useCallback(
    async (otpCode: string) => {
      if (verificationAttempted.current || loading || !email) return
      verificationAttempted.current = true

      setLoading(true)
      setError("")

      try {
        const { error: verifyError } = await verifyOtp(email, otpCode)

        if (verifyError) {
          setError(formatAuthError(verifyError))
          verificationAttempted.current = false
        } else {
          await initialize()
          // Navigation will be handled by AppNavigator based on auth state
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("otpVerificationScreen:unexpectedError"))
        verificationAttempted.current = false
      } finally {
        setLoading(false)
      }
    },
    [email, verifyOtp, initialize, loading, t],
  )

  // Handle code completion (auto-submit)
  const handleCodeComplete = useCallback(
    (completeCode: string) => {
      handleVerify(completeCode)
    },
    [handleVerify],
  )

  // Handle resend code
  const handleResend = async () => {
    if (countdown > 0 || resending || !email) return

    setResending(true)
    setError("")
    setResendSuccess(false)

    try {
      const { error: resendError } = await signInWithMagicLink(email)

      if (resendError) {
        setError(formatAuthError(resendError))
      } else {
        setResendSuccess(true)
        setCountdown(TIMING.COUNTDOWN_RESEND_EMAIL)
        // Clear code for new attempt
        setCode("")
        verificationAttempted.current = false
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
      setError(err instanceof Error ? err.message : t("otpVerificationScreen:unexpectedError"))
    } finally {
      setResending(false)
    }
  }

  // Handle code change
  const handleCodeChange = (newCode: string) => {
    setCode(newCode)
    setError("")
    // Reset verification flag when user changes code
    if (newCode.length < otpLength) {
      verificationAttempted.current = false
    }
  }

  const handleBack = () => {
    navigation.goBack()
  }

  const handleChangeEmail = () => {
    navigation.navigate("MagicLink")
  }

  if (!email) {
    return null
  }

  return (
    <AuthScreenLayout
      titleTx="otpVerificationScreen:title"
      subtitle={t("otpVerificationScreen:subtitle", { email })}
      showBackButton
      onBack={handleBack}
      scrollable
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.secondary }]}>
          <Ionicons name="keypad-outline" size={48} color={theme.colors.accent} />
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text
          size="sm"
          color="secondary"
          style={styles.instructionsText}
          tx="otpVerificationScreen:instructions"
          txOptions={{ length: otpLength }}
        />
      </View>

      {/* OTP Input */}
      <View style={styles.otpContainer}>
        <OTPInput
          length={otpLength}
          value={code}
          onChange={handleCodeChange}
          onComplete={handleCodeComplete}
          error={error}
          disabled={loading}
          autoFocus
        />
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <Spinner size="sm" />
          <Text
            size="sm"
            color="secondary"
            style={styles.loadingText}
            tx="otpVerificationScreen:verifying"
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
            tx="otpVerificationScreen:resendSuccess"
          />
        </View>
      )}

      {/* Resend Button */}
      <TouchableOpacity
        style={[
          styles.resendButton,
          countdown > 0 && styles.resendButtonDisabled,
          {
            backgroundColor: countdown > 0 ? theme.colors.secondary : theme.colors.accent,
          },
        ]}
        onPress={handleResend}
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
              style={[styles.resendButtonText, styles.resendButtonTextDisabled]}
            >
              {t("otpVerificationScreen:resendIn", { seconds: countdown })}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="refresh" size={20} color={theme.colors.accentForeground} />
            <Text
              weight="semiBold"
              style={styles.resendButtonText}
              tx="otpVerificationScreen:resendCode"
            />
          </>
        )}
      </TouchableOpacity>

      {/* Change Email Link */}
      <TouchableOpacity onPress={handleChangeEmail} style={styles.linkButton} activeOpacity={0.6}>
        <Text color="secondary">
          <Text tx="otpVerificationScreen:wrongEmail" />{" "}
          <Text weight="semiBold" tx="otpVerificationScreen:changeIt" style={styles.linkAccent} />
        </Text>
      </TouchableOpacity>

      {/* Back to Login Link */}
      <TouchableOpacity
        onPress={() => navigation.navigate("Login")}
        style={styles.linkButton}
        activeOpacity={0.6}
      >
        <Text color="secondary">
          <Text tx="otpVerificationScreen:preferPassword" />{" "}
          <Text
            weight="semiBold"
            tx="otpVerificationScreen:signInWithPassword"
            style={styles.linkAccent}
          />
        </Text>
      </TouchableOpacity>
    </AuthScreenLayout>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  iconContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionsContainer: {
    marginBottom: theme.spacing.lg,
  },
  instructionsText: {
    textAlign: "center",
    lineHeight: 22,
  },
  otpContainer: {
    marginBottom: theme.spacing.xl,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  loadingText: {
    marginLeft: theme.spacing.xs,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  messageText: {
    flex: 1,
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  resendButtonText: {
    color: theme.colors.accentForeground,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.lg,
  },
  resendButtonDisabled: {
    // Button stays visible but styled differently
  },
  resendButtonTextDisabled: {
    color: theme.colors.foreground,
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  linkAccent: {
    color: theme.colors.accent,
  },
}))
