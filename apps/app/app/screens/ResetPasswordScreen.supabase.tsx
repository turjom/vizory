/**
 * ResetPasswordScreen - Supabase Version
 *
 * Handles password reset flow with Supabase Auth:
 * - Verifies reset token from email link (code or token_hash)
 * - Creates authenticated session from recovery token
 * - Updates password using Supabase Auth API
 *
 * Flow:
 * 1. User clicks reset link in email
 * 2. App opens with code/token in URL params
 * 3. Screen verifies token and creates session
 * 4. User enters new password
 * 5. Password is updated via supabase.auth.updateUser()
 */

import { useEffect, useState } from "react"
import { View, TouchableOpacity } from "react-native"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { StyleSheet } from "react-native-unistyles"
import { z } from "zod"

import { AuthScreenLayout } from "@/components/layouts/AuthScreenLayout"
import { Spinner } from "@/components/Spinner"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { AppStackParamList, AppStackScreenProps } from "@/navigators/navigationTypes"
import { resetPasswordSchema } from "@/schemas/authSchemas"
import { supabase } from "@/services/supabase"
import { useAuthStore } from "@/stores/auth"
import { formatAuthError } from "@/utils/formatAuthError"

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

export const ResetPasswordScreen = () => {
  const navigation = useNavigation<AppStackScreenProps<"ResetPassword">["navigation"]>()
  const route = useRoute<RouteProp<AppStackParamList, "ResetPassword">>()
  const { t } = useTranslation()
  const [verifying, setVerifying] = useState(true)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  const code = route.params?.code
  const token = route.params?.token

  // ============================================================
  // SUPABASE TOKEN VERIFICATION
  // Verify the reset token and create an authenticated session
  // ============================================================
  useEffect(() => {
    let isMounted = true
    const verifyLink = async () => {
      setVerifying(true)
      setVerificationError(null)

      try {
        if (code) {
          // Exchange OAuth-style code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            throw error
          }
          if (data.session) {
            useAuthStore.getState().setSession(data.session)
          }
        } else if (token) {
          // Verify OTP token hash (from email magic link)
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: "recovery",
          })
          if (error) {
            throw error
          }
          if (data.session) {
            useAuthStore.getState().setSession(data.session)
          }
        } else {
          throw new Error(t("resetPasswordScreen:missingToken"))
        }

        if (isMounted) {
          setVerifying(false)
        }
      } catch (error) {
        if (isMounted) {
          const resolvedError = error instanceof Error ? error : new Error(String(error))
          setVerificationError(formatAuthError(resolvedError))
          setVerifying(false)
        }
      }
    }

    void verifyLink()

    return () => {
      isMounted = false
    }
  }, [code, token, t])

  // ============================================================
  // SUPABASE PASSWORD UPDATE
  // Update password using the authenticated session
  // ============================================================
  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      // Add timeout to prevent hanging - Supabase updateUser can hang but still succeed
      const timeoutMs = 10000
      const updatePromise = supabase.auth.updateUser({ password: data.password })
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Please try again.")), timeoutMs),
      )

      const { error } = await Promise.race([updatePromise, timeoutPromise])
      if (error) {
        throw error
      }
      setSuccess(true)
    } catch (error) {
      const resolvedError = error instanceof Error ? error : new Error(String(error))
      setVerificationError(formatAuthError(resolvedError))
    }
  }

  const handleResetPassword = handleSubmit(onSubmit)

  const handleBackToLogin = () => {
    navigation.navigate("Login" as never)
  }

  // Verifying state
  if (verifying) {
    return (
      <AuthScreenLayout
        headerIcon="🔒"
        title={t("resetPasswordScreen:verifyingTitle")}
        subtitle={t("resetPasswordScreen:verifyingSubtitle")}
        scrollable
      >
        <View style={styles.loadingContainer}>
          <Spinner size="lg" />
        </View>
      </AuthScreenLayout>
    )
  }

  // Success state
  if (success) {
    return (
      <AuthScreenLayout
        headerIcon="✅"
        title={t("resetPasswordScreen:successTitle")}
        subtitle={t("resetPasswordScreen:successSubtitle")}
        scrollable
      >
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleBackToLogin}
          activeOpacity={0.8}
        >
          <Text
            weight="semiBold"
            style={styles.primaryButtonText}
            tx="resetPasswordScreen:backToLogin"
          />
        </TouchableOpacity>
      </AuthScreenLayout>
    )
  }

  // Password form state
  return (
    <AuthScreenLayout
      headerIcon="🔐"
      title={t("resetPasswordScreen:title")}
      subtitle={t("resetPasswordScreen:subtitle")}
      showBackButton
      onBack={() => navigation.goBack()}
      scrollable
    >
      {verificationError ? (
        <View style={styles.errorContainer}>
          <Text size="sm" color="error" style={styles.errorText}>
            {verificationError}
          </Text>
        </View>
      ) : null}

      <View style={styles.inputContainer}>
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="resetPasswordScreen:passwordLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="resetPasswordScreen:passwordPlaceholder"
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              returnKeyType="next"
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />
      </View>

      <View style={styles.inputContainer}>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="resetPasswordScreen:confirmLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="resetPasswordScreen:confirmPlaceholder"
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleResetPassword}
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !isValid && styles.buttonDisabled]}
        onPress={handleResetPassword}
        disabled={!isValid}
        activeOpacity={0.8}
      >
        <Text weight="semiBold" style={styles.primaryButtonText} tx="resetPasswordScreen:submit" />
      </TouchableOpacity>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create((theme) => ({
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.lg,
  },
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
}))
