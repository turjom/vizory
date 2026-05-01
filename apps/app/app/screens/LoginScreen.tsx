import { useState } from "react"
import { View, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
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
import { AppStackParamList } from "@/navigators/navigationTypes"
import { loginSchema } from "@/schemas/authSchemas"
import { formatAuthError } from "@/utils/formatAuthError"

// =============================================================================
// COMPONENT
// =============================================================================

type LoginFormData = z.infer<typeof loginSchema>

export const LoginScreen = () => {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const { signIn, signInWithGoogle, signInWithApple, isLoading: authLoading } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const oauthLoading = authLoading

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
    const { error: signInError } = await signIn(data.email, data.password)
    setLoading(false)

    if (signInError) {
      const formattedError = formatAuthError(signInError)
      // Empty string means email not confirmed - AppNavigator will handle navigation
      if (formattedError === "") {
        setError("")
      } else {
        setError(formattedError)
      }
    }
  }

  const handleLogin = handleSubmit(onSubmit)

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

    navigation.navigate("Welcome")
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
