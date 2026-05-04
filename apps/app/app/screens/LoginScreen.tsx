import { useCallback, useEffect, useState } from "react"
import { Platform, View, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { SymbolView, type SFSymbol } from "expo-symbols"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Controller, useForm } from "react-hook-form"
import * as LocalAuthentication from "expo-local-authentication"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"
import { z } from "zod"

import { Divider } from "@/components/Divider"
import { AuthScreenLayout } from "@/components/layouts/AuthScreenLayout"
import { Spinner } from "@/components/Spinner"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { features } from "@/config/features"
import { useAuth } from "@/hooks"
import type { TxKeyPath } from "@/i18n"
import { AppStackParamList } from "@/navigators/navigationTypes"
import { loginSchema } from "@/schemas/authSchemas"
import {
  clearBiometricLoginCredentials,
  getBiometricEnabled,
  getBiometricLoginCredentials,
  hasBiometricLoginCredentials,
  saveBiometricLoginCredentials,
} from "@/services/biometricSessionStorage"
import { formatAuthError } from "@/utils/formatAuthError"

// =============================================================================
// COMPONENT
// =============================================================================

type LoginFormData = z.infer<typeof loginSchema>

function biometricSignInLabelTx(types: LocalAuthentication.AuthenticationType[]): TxKeyPath {
  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ||
    types.includes(LocalAuthentication.AuthenticationType.IRIS)
  ) {
    return "loginScreen:biometricSignInFaceId"
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === "ios"
      ? "loginScreen:biometricSignInTouchId"
      : "loginScreen:biometricSignInFingerprint"
  }
  return "loginScreen:biometricSignIn"
}

function BiometricSignInIcon({
  types,
  tintColor,
}: {
  types: LocalAuthentication.AuthenticationType[]
  tintColor: string
}) {
  const fallbackPrint = <Ionicons name="finger-print" size={22} color={tintColor} />
  const fallbackFace = <Ionicons name="scan-outline" size={22} color={tintColor} />

  const hasFace =
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ||
    types.includes(LocalAuthentication.AuthenticationType.IRIS)
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)

  if (hasFace && !hasFingerprint) {
    return (
      <SymbolView
        name={"faceid" as SFSymbol}
        size={22}
        tintColor={tintColor}
        fallback={fallbackFace}
      />
    )
  }

  if (hasFingerprint && !hasFace) {
    return (
      <SymbolView
        name={"touchid" as SFSymbol}
        size={22}
        tintColor={tintColor}
        fallback={fallbackPrint}
      />
    )
  }

  if (hasFace && hasFingerprint) {
    return (
      <SymbolView
        name={"faceid" as SFSymbol}
        size={22}
        tintColor={tintColor}
        fallback={fallbackFace}
      />
    )
  }

  return fallbackPrint
}

export const LoginScreen = () => {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const { signIn, signInWithGoogle, signInWithApple, isLoading: authLoading } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showBiometricOption, setShowBiometricOption] = useState(false)
  const [biometricLabelTx, setBiometricLabelTx] = useState<TxKeyPath>("loginScreen:biometricSignIn")
  const [biometricAuthTypes, setBiometricAuthTypes] = useState<LocalAuthentication.AuthenticationType[]>([])
  const oauthLoading = authLoading

  useEffect(() => {
    if (Platform.OS === "web") {
      return undefined
    }
    let cancelled = false
    void (async () => {
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
        if (!cancelled) {
          setBiometricAuthTypes(types)
        }
      } catch {
        /* leave default [] */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshBiometricAvailability = useCallback(async () => {
    if (Platform.OS === "web") {
      setShowBiometricOption(false)
      return
    }
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[BiometricFlow] refreshBiometricAvailability: start")
    }
    try {
      const [hasCreds, enabledFlag, hasHardware, enrolled] = await Promise.all([
        hasBiometricLoginCredentials(),
        getBiometricEnabled(),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ])
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[BiometricFlow] refreshBiometricAvailability: gates", {
          hasCreds,
          enabledFlag,
          hasHardware,
          enrolled,
        })
      }
      if (!hasCreds || !hasHardware || !enrolled || enabledFlag !== true) {
        setShowBiometricOption(false)
        return
      }
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
      setBiometricAuthTypes(types)
      setBiometricLabelTx(biometricSignInLabelTx(types))
      setShowBiometricOption(true)
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[BiometricFlow] refreshBiometricAvailability: show biometric row", {
          types,
        })
      }
    } catch (e) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[BiometricFlow] refreshBiometricAvailability: error", e)
      }
      setShowBiometricOption(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void refreshBiometricAvailability()
    }, [refreshBiometricAvailability]),
  )

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true)
    setError("")
    const { error: signInError, session: signInSession } = await signIn(data.email, data.password)
    setLoading(false)

    if (signInError) {
      const formattedError = formatAuthError(signInError)
      if (formattedError === "") {
        setError("")
      } else {
        setError(formattedError)
      }
      return
    }

    try {
      const enabled = await getBiometricEnabled()
      if (enabled !== false) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log("[BiometricFlow] onSubmit: saving biometric login credentials to SecureStore", {
            hasSession: !!signInSession,
            emailLen: data.email.trim().length,
          })
        }
        await saveBiometricLoginCredentials(data.email, data.password)
      }
      await refreshBiometricAvailability()
    } catch (e) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[BiometricFlow] onSubmit: SecureStore / biometric setup failed", e)
      }
      // Secure Store unavailable — manual sign-in still succeeded
    }
  }

  const handleLogin = handleSubmit(onSubmit)

  const handleBiometricLogin = async () => {
    setError("")
    try {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[BiometricFlow] handleBiometricLogin: showing LocalAuthentication prompt")
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Sign in to Vizory",
        cancelLabel: t("common:cancel"),
        disableDeviceFallback: true,
      })
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(
          "[BiometricFlow] handleBiometricLogin: LA result",
          result.success ? { success: true as const } : { success: false as const, error: result.error },
        )
      }
      if (!result.success) return

      const creds = await getBiometricLoginCredentials()
      if (!creds) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[BiometricFlow] handleBiometricLogin: no stored credentials after successful LA")
        }
        return
      }

      setLoading(true)
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[BiometricFlow] handleBiometricLogin: calling signInWithPassword after LA", {
          emailLen: creds.email.length,
        })
      }
      const { error: signInError } = await signIn(creds.email, creds.password)
      setLoading(false)

      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[BiometricFlow] handleBiometricLogin: signIn finished", {
          hasError: !!signInError,
          errorMessage: signInError?.message,
        })
      }

      if (signInError) {
        const code = (signInError as { code?: string }).code
        const msg = (signInError.message ?? "").toLowerCase()
        const invalidCreds =
          code === "invalid_credentials" ||
          msg.includes("invalid login credentials") ||
          msg.includes("invalid email or password")
        if (invalidCreds) {
          await clearBiometricLoginCredentials()
        }
        const formattedError = formatAuthError(signInError as Error)
        if (formattedError === "") {
          setError("")
        } else {
          setError(formattedError)
        }
      }
    } catch (e) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[BiometricFlow] handleBiometricLogin: unexpected error", e)
      }
      setLoading(false)
    }
  }

  const handleAppleAuth = async () => {
    try {
      setError("")
      const { error } = await signInWithApple()
      if (error) {
        setError(formatAuthError(error as Error) || t("loginScreen:appleSignInFailed"))
      }
    } catch {
      setError(t("loginScreen:appleSignInFailed"))
    }
  }

  const handleGoogleAuth = async () => {
    try {
      setError("")
      const { error } = await signInWithGoogle()
      if (error) {
        setError(formatAuthError(error as Error) || t("loginScreen:googleSignInFailed"))
      }
    } catch {
      setError(t("loginScreen:googleSignInFailed"))
    }
  }

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack()
      return
    }

    navigation.navigate("Login")
  }

  return (
    <AuthScreenLayout
      titleTx="loginScreen:title"
      subtitleTx="loginScreen:subtitle"
      showCloseButton
      onClose={handleClose}
      scrollable
    >
      {/* Email Input */}
      <View style={styles.inputContainer}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="loginScreen:emailLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="loginScreen:emailPlaceholder"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              spellCheck={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />
      </View>

      {/* Password Input */}
      <View style={styles.inputContainer}>
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="loginScreen:passwordLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="loginScreen:passwordPlaceholder"
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />
      </View>

      {/* Global Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text size="sm" color="error" style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      {/* Sign In Button */}
      <TouchableOpacity
        style={[styles.primaryButton, (loading || !isValid) && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading || !isValid}
        activeOpacity={0.8}
      >
        {loading ? (
          <Spinner size="sm" color="white" />
        ) : (
          <Text weight="semiBold" style={styles.primaryButtonText} tx="loginScreen:signIn" />
        )}
      </TouchableOpacity>

      {showBiometricOption && (
        <TouchableOpacity
          style={[styles.biometricButton, loading && styles.buttonDisabled]}
          onPress={() => void handleBiometricLogin()}
          disabled={loading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t(biometricLabelTx)}
        >
          <BiometricSignInIcon types={biometricAuthTypes} tintColor={theme.colors.foreground} />
          <Text weight="semiBold" tx={biometricLabelTx} style={styles.biometricButtonText} />
        </TouchableOpacity>
      )}

      {/* Forgot Password Link */}
      <TouchableOpacity
        onPress={() => navigation.navigate("ForgotPassword")}
        style={styles.forgotButton}
        activeOpacity={0.6}
      >
        <Text size="sm" weight="medium" tx="loginScreen:forgotPassword" style={styles.linkAccent} />
      </TouchableOpacity>

      {/* Social Login Section */}
      {(features.enableGoogleAuth || features.enableAppleAuth) && (
        <>
          <Divider label={t("loginScreen:orContinueWith")} style={styles.divider} />

          <View style={styles.socialRow}>
            {features.enableAppleAuth && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleAppleAuth}
                activeOpacity={0.8}
                disabled={oauthLoading}
              >
                <Ionicons name="logo-apple" size={24} color={theme.colors.foreground} />
                <Text weight="semiBold" tx="loginScreen:apple" />
              </TouchableOpacity>
            )}

            {features.enableGoogleAuth && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleAuth}
                activeOpacity={0.8}
                disabled={oauthLoading}
              >
                <Ionicons name="logo-google" size={24} color={theme.colors.foreground} />
                <Text weight="semiBold" tx="loginScreen:google" />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* Sign Up Link */}
      <TouchableOpacity
        onPress={() => navigation.navigate("Register")}
        style={styles.linkButton}
        activeOpacity={0.6}
      >
        <Text color="secondary">
          <Text tx="loginScreen:noAccount" />{" "}
          <Text weight="semiBold" tx="loginScreen:signUp" style={styles.linkAccent} />
        </Text>
      </TouchableOpacity>
    </AuthScreenLayout>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  errorContainer: {
    backgroundColor: theme.colors.errorBackground,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  errorText: {
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    color: theme.colors.accentForeground,
    fontSize: theme.typography.sizes.lg,
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  biometricButtonText: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sizes.base,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  forgotButton: {
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  linkAccent: {
    color: theme.colors.accent,
  },
  divider: {
    marginVertical: theme.spacing.lg,
  },
  socialRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
}))
