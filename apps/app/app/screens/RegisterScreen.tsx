import { useState } from "react"
import { View, TouchableOpacity, DimensionValue } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigation } from "@react-navigation/native"
import { Controller, useForm } from "react-hook-form"
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
import { registerSchema } from "@/schemas/authSchemas"
import { formatAuthError } from "@/utils/formatAuthError"
import { analyzePasswordStrength } from "@/utils/validation"

// =============================================================================
// COMPONENT
// =============================================================================

type RegisterFormData = z.infer<typeof registerSchema>

export const RegisterScreen = () => {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const navigation = useNavigation()
  const { signUp, signInWithGoogle, signInWithApple, isLoading: authLoading } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const oauthLoading = authLoading

  const {
    control,
    handleSubmit,
    watch,
    formState: { isValid },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const passwordValue = watch("password")
  const passwordStrength = passwordValue ? analyzePasswordStrength(passwordValue) : null

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true)
    setError("")
    const last = data.lastName.trim()
    const { error: signUpError } = await signUp(
      data.email,
      data.password,
      data.firstName.trim(),
      last.length > 0 ? last : undefined,
    )
    setLoading(false)

    if (signUpError) {
      const formattedError = formatAuthError(signUpError)
      setError(formattedError)
    }
  }

  const handleRegister = handleSubmit(onSubmit)

  const handleAppleAuth = async () => {
    try {
      setError("")
      const { error } = await signInWithApple()
      if (error) setError(formatAuthError(error as Error) || t("registerScreen:appleSignInFailed"))
    } catch {
      setError(t("registerScreen:appleSignInFailed"))
    }
  }

  const handleGoogleAuth = async () => {
    try {
      setError("")
      const { error } = await signInWithGoogle()
      if (error) setError(formatAuthError(error as Error) || t("registerScreen:googleSignInFailed"))
    } catch {
      setError(t("registerScreen:googleSignInFailed"))
    }
  }

  const getStrengthStyle = () => {
    if (!passwordStrength) return styles.strengthFillDefault
    switch (passwordStrength.label) {
      case "weak":
        return styles.strengthFillWeak
      case "fair":
        return styles.strengthFillFair
      case "good":
        return styles.strengthFillGood
      case "strong":
        return styles.strengthFillStrong
      default:
        return styles.strengthFillDefault
    }
  }

  const getStrengthTextStyle = () => {
    if (!passwordStrength) return styles.strengthTextDefault
    switch (passwordStrength.label) {
      case "weak":
        return styles.strengthTextWeak
      case "fair":
        return styles.strengthTextFair
      case "good":
        return styles.strengthTextGood
      case "strong":
        return styles.strengthTextStrong
      default:
        return styles.strengthTextDefault
    }
  }

  const getStrengthWidth = (): DimensionValue => {
    if (!passwordStrength) return "0%"
    return `${(passwordStrength.score / 4) * 100}%` as DimensionValue
  }

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack()
      return
    }

    navigation.navigate("Welcome" as never)
  }

  return (
    <AuthScreenLayout
      titleTx="registerScreen:title"
      subtitleTx="registerScreen:subtitle"
      showCloseButton
      onClose={handleClose}
      scrollable
    >
      {/* First name */}
      <View style={styles.inputContainer}>
        <Controller
          control={control}
          name="firstName"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="registerScreen:firstNameLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="registerScreen:firstNamePlaceholder"
              autoCapitalize="words"
              autoComplete="name-given"
              textContentType="givenName"
              returnKeyType="next"
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />
      </View>

      {/* Last name (optional) */}
      <View style={styles.inputContainer}>
        <Controller
          control={control}
          name="lastName"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="registerScreen:lastNameLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="registerScreen:lastNamePlaceholder"
              autoCapitalize="words"
              autoComplete="name-family"
              textContentType="familyName"
              returnKeyType="next"
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />
      </View>

      {/* Email Input */}
      <View style={styles.inputContainer}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="registerScreen:emailLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="registerScreen:emailPlaceholder"
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
              labelTx="registerScreen:passwordLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="registerScreen:passwordPlaceholder"
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="next"
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />

        {/* Password Strength Indicator */}
        {passwordValue && passwordStrength && (
          <View style={styles.strengthContainer}>
            <View style={styles.strengthBar}>
              <View
                style={[
                  getStrengthStyle(),
                  {
                    width: getStrengthWidth(),
                  },
                ]}
              />
            </View>
            <Text size="xs" weight="semiBold" style={getStrengthTextStyle()}>
              {t(`registerScreen:passwordStrength.${passwordStrength.label}`)}
            </Text>
          </View>
        )}
      </View>

      {/* Confirm Password Input */}
      <View style={styles.inputContainer}>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="registerScreen:confirmPasswordLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="registerScreen:confirmPasswordPlaceholder"
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              secureTextEntry
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
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

      {/* Sign Up Button */}
      <TouchableOpacity
        style={[styles.primaryButton, (loading || !isValid) && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading || !isValid}
        activeOpacity={0.8}
      >
        {loading ? (
          <Spinner size="sm" color="white" />
        ) : (
          <Text weight="semiBold" style={styles.primaryButtonText} tx="registerScreen:signUp" />
        )}
      </TouchableOpacity>

      {/* Social Login Section */}
      {(features.enableGoogleAuth || features.enableAppleAuth) && (
        <>
          <Divider label={t("registerScreen:orContinueWith")} style={styles.divider} />

          <View style={styles.socialRow}>
            {features.enableAppleAuth && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleAppleAuth}
                activeOpacity={0.8}
                disabled={oauthLoading}
              >
                <Ionicons name="logo-apple" size={24} color={theme.colors.foreground} />
                <Text weight="semiBold" tx="registerScreen:apple" />
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
                <Text weight="semiBold" tx="registerScreen:google" />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* Login Link */}
      <TouchableOpacity
        onPress={() => navigation.navigate("Login" as never)}
        style={styles.linkButton}
        activeOpacity={0.6}
      >
        <Text color="secondary">
          <Text tx="registerScreen:hasAccount" />{" "}
          <Text weight="semiBold" tx="registerScreen:logIn" style={styles.linkAccent} />
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
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  strengthFillDefault: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },
  strengthFillWeak: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: theme.colors.error,
  },
  strengthFillFair: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: theme.colors.warning,
  },
  strengthFillGood: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: theme.colors.success,
  },
  strengthFillStrong: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: theme.colors.palette.success600,
  },
  strengthTextDefault: {
    color: theme.colors.border,
  },
  strengthTextWeak: {
    color: theme.colors.error,
  },
  strengthTextFair: {
    color: theme.colors.warning,
  },
  strengthTextGood: {
    color: theme.colors.success,
  },
  strengthTextStrong: {
    color: theme.colors.palette.success600,
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
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    color: theme.colors.accentForeground,
    fontSize: theme.typography.sizes.lg,
  },
  buttonDisabled: {
    opacity: 0.4,
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
  linkAccent: {
    color: theme.colors.accent,
  },
}))
