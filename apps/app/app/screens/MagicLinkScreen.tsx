/**
 * MagicLinkScreen - Passwordless authentication via email
 *
 * Flow:
 * 1. User enters email
 * 2. System sends OTP code to email
 * 3. User is navigated to OTP verification screen
 *
 * Works with both Supabase and Convex backends.
 */

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

import { AuthScreenLayout } from "@/components/layouts/AuthScreenLayout"
import { Spinner } from "@/components/Spinner"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { isConvex } from "@/config/env"
import { useAuth } from "@/hooks"
import { AppStackParamList } from "@/navigators/navigationTypes"
import { magicLinkSchema } from "@/schemas/authSchemas"
import { formatAuthError } from "@/utils/formatAuthError"

// =============================================================================
// TYPES
// =============================================================================

type MagicLinkFormData = z.infer<typeof magicLinkSchema>

// =============================================================================
// COMPONENT
// =============================================================================

export const MagicLinkScreen = () => {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const { signInWithMagicLink } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
    },
  })

  const onSubmit = async (data: MagicLinkFormData) => {
    setLoading(true)
    setError("")

    try {
      const { error: signInError } = await signInWithMagicLink(data.email)

      if (signInError) {
        setError(formatAuthError(signInError))
      } else {
        navigation.navigate("OTPVerification", { email: data.email, isConvex })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("magicLinkScreen:unexpectedError"))
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = handleSubmit(onSubmit)

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack()
      return
    }
    navigation.navigate("Welcome")
  }

  const handleBackToLogin = () => {
    navigation.navigate("Login")
  }

  return (
    <AuthScreenLayout
      titleTx="magicLinkScreen:title"
      subtitleTx="magicLinkScreen:subtitle"
      showCloseButton
      onClose={handleClose}
      scrollable
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.secondary }]}>
          <Ionicons name="mail-outline" size={48} color={theme.colors.primary} />
        </View>
      </View>

      {/* Email Input */}
      <View style={styles.inputContainer}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="magicLinkScreen:emailLabel"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholderTx="magicLinkScreen:emailPlaceholder"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="done"
              onSubmitEditing={handleSendCode}
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text size="sm" color="error" style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      {/* Send Code Button */}
      <TouchableOpacity
        style={[styles.primaryButton, (loading || !isValid) && styles.buttonDisabled]}
        onPress={handleSendCode}
        disabled={loading || !isValid}
        activeOpacity={0.8}
      >
        {loading ? (
          <Spinner size="sm" color="white" />
        ) : (
          <>
            <Ionicons name="paper-plane-outline" size={20} color={theme.colors.primaryForeground} />
            <Text
              weight="semiBold"
              style={styles.primaryButtonText}
              tx="magicLinkScreen:sendCode"
            />
          </>
        )}
      </TouchableOpacity>

      {/* Info text */}
      <View style={styles.infoContainer}>
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={theme.colors.foregroundSecondary}
        />
        <Text size="sm" color="secondary" style={styles.infoText} tx="magicLinkScreen:infoText" />
      </View>

      {/* Back to Login Link */}
      <TouchableOpacity onPress={handleBackToLogin} style={styles.linkButton} activeOpacity={0.6}>
        <Text color="secondary">
          <Text tx="magicLinkScreen:preferPassword" />{" "}
          <Text weight="semiBold" tx="magicLinkScreen:signInWithPassword" />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
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
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  infoText: {
    flex: 1,
    lineHeight: 20,
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
}))
