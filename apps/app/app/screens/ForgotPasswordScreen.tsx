import { useState } from "react"
import { View, TouchableOpacity } from "react-native"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigation } from "@react-navigation/native"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { StyleSheet } from "react-native-unistyles"
import { z } from "zod"

import { AuthScreenLayout } from "@/components/layouts/AuthScreenLayout"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAuth } from "@/hooks"
import { forgotPasswordSchema } from "@/schemas/authSchemas"
import { formatAuthError } from "@/utils/formatAuthError"

// =============================================================================
// COMPONENT
// =============================================================================

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export const ForgotPasswordScreen = () => {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { resetPassword } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    formState: { isValid },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
    },
  })

  const emailValue = watch("email")

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setLoading(true)
    setError("")
    setSuccess(false)

    const { error: resetError } = await resetPassword(data.email)
    setLoading(false)

    if (resetError) {
      setError(formatAuthError(resetError as Error))
    } else {
      setSuccess(true)
    }
  }

  const handleResetPassword = handleSubmit(onSubmit)

  const handleBackToLogin = () => {
    navigation.navigate("Login" as never)
  }

  // Success State
  if (success) {
    return (
      <AuthScreenLayout
        headerIcon="✉️"
        titleTx="forgotPasswordScreen:successTitle"
        subtitle={t("forgotPasswordScreen:successSubtitle", { email: emailValue })}
        scrollable
      >
        <Text
          color="secondary"
          style={styles.successSubtext}
          tx="forgotPasswordScreen:successDescription"
        />

        {/* Back to Login Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleBackToLogin}
          activeOpacity={0.8}
        >
          <Text
            weight="semiBold"
            style={styles.primaryButtonText}
            tx="forgotPasswordScreen:backToLogin"
          />
        </TouchableOpacity>
      </AuthScreenLayout>
    )
  }

  // Default Form State
  return (
    <AuthScreenLayout
      headerIcon="🔑"
      titleTx="forgotPasswordScreen:title"
      subtitleTx="forgotPasswordScreen:subtitle"
      showBackButton
      onBack={() => navigation.goBack()}
      scrollable
    >
      {/* Email Input */}
      <View style={styles.inputContainer}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="forgotPasswordScreen:emailLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="forgotPasswordScreen:emailPlaceholder"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="done"
              onSubmitEditing={handleResetPassword}
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />
      </View>

      {/* Global Error Message */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text size="sm" color="error" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      {/* Reset Password Button */}
      <TouchableOpacity
        style={[styles.primaryButton, (loading || !isValid) && styles.buttonDisabled]}
        onPress={handleResetPassword}
        disabled={loading || !isValid}
        activeOpacity={0.8}
      >
        <Text weight="semiBold" style={styles.primaryButtonText}>
          {loading ? t("forgotPasswordScreen:sending") : t("forgotPasswordScreen:sendResetLink")}
        </Text>
      </TouchableOpacity>

      {/* Back to Login Link */}
      <TouchableOpacity onPress={handleBackToLogin} style={styles.linkButton} activeOpacity={0.6}>
        <Text color="secondary">
          <Text tx="forgotPasswordScreen:rememberPassword" />{" "}
          <Text weight="semiBold" tx="forgotPasswordScreen:backToLogin" />
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
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.sizes.lg,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  successSubtext: {
    textAlign: "center",
    marginBottom: theme.spacing.xl,
  },
}))
