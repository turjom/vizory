import { FC } from "react"
import { View, TouchableOpacity, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Divider } from "@/components/Divider"
import { AuthScreenLayout } from "@/components/layouts/AuthScreenLayout"
import { Text } from "@/components/Text"
import { features } from "@/config/features"
import { useAuth } from "@/hooks"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"

// =============================================================================
// TYPES
// =============================================================================

interface WelcomeScreenProps extends AppStackScreenProps<"Welcome"> {}

// =============================================================================
// COMPONENT
// =============================================================================

export const WelcomeScreen: FC<WelcomeScreenProps> = function WelcomeScreen(_props) {
  const { navigation } = _props
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { signInWithGoogle, signInWithApple, isLoading } = useAuth()

  const handleGoToLogin = () => {
    navigation.navigate("Login" as never)
  }

  const handleGoToRegister = () => {
    navigation.navigate("Register" as never)
  }

  const handleAppleAuth = async () => {
    try {
      const { error } = await signInWithApple()
      if (error) {
        Alert.alert(t("welcomeScreen:signInError"), error.message)
      }
    } catch {
      Alert.alert(t("welcomeScreen:signInError"), t("welcomeScreen:appleSignInFailed"))
    }
  }

  const handleGoogleAuth = async () => {
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        Alert.alert(t("welcomeScreen:signInError"), error.message)
      }
    } catch {
      Alert.alert(t("welcomeScreen:signInError"), t("welcomeScreen:googleSignInFailed"))
    }
  }

  return (
    <AuthScreenLayout
      titleTx="welcomeScreen:getStarted"
      subtitleTx="welcomeScreen:subtitle"
      scrollable={false}
      centerContent
      plainBackground
    >
      {/* Primary Button - Register */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleGoToRegister}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        <Text weight="semiBold" style={styles.primaryButtonText} tx="welcomeScreen:createAccount" />
      </TouchableOpacity>

      {/* Secondary Button - Login */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleGoToLogin}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        <Text weight="semiBold" style={styles.secondaryButtonText} tx="welcomeScreen:signIn" />
      </TouchableOpacity>

      {/* Social Login Section - Only show if at least one social auth is enabled */}
      {(features.enableGoogleAuth || features.enableAppleAuth) && (
        <>
          <Divider label={t("welcomeScreen:orContinueWith")} style={styles.divider} />

          {/* Social Buttons Row */}
          <View style={styles.socialRow}>
            {features.enableAppleAuth && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleAppleAuth}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={24} color={theme.colors.foreground} />
                <Text weight="semiBold" tx="welcomeScreen:apple" />
              </TouchableOpacity>
            )}

            {features.enableGoogleAuth && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleAuth}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                <Ionicons name="logo-google" size={24} color={theme.colors.foreground} />
                <Text weight="semiBold" tx="welcomeScreen:google" />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </AuthScreenLayout>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    color: theme.colors.accentForeground,
    fontSize: theme.typography.sizes.lg,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  secondaryButtonText: {
    color: theme.colors.accent,
    fontSize: theme.typography.sizes.lg,
  },
  divider: {
    marginVertical: theme.spacing.lg,
  },
  socialRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
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
}))
