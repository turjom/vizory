import { FC, useState } from "react"
import { View, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { OnboardingScreenLayout } from "@/components/layouts/OnboardingScreenLayout"
import { Text } from "@/components/Text"
import { useAuth } from "@/hooks"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useNotificationStore } from "@/stores/notificationStore"
import { logger } from "@/utils/Logger"

// =============================================================================
// TYPES
// =============================================================================

interface OnboardingScreenProps extends AppStackScreenProps<"Onboarding"> {}

const TOTAL_STEPS = 2
const LAST_STEP_INDEX = 1

// =============================================================================
// COMPONENT
// =============================================================================

export const OnboardingScreen: FC<OnboardingScreenProps> = function OnboardingScreen(_props) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const navigation = useNavigation<AppStackScreenProps<"Onboarding">["navigation"]>()
  const { completeOnboarding } = useAuth()
  const togglePush = useNotificationStore((state) => state.togglePush)
  const [step, setStep] = useState(0)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)

  // Slide animations
  const handleNext = async () => {
    if (step < LAST_STEP_INDEX) {
      setStep(step + 1)
    } else {
      // Mark onboarding as complete BEFORE navigation
      // This ensures the state is saved before the navigator re-evaluates routes
      await completeOnboarding()
      navigation.replace("Main", { screen: "Home" })
    }
  }

  const handleEnableNotifications = async () => {
    if (isRequestingPermission) return

    setIsRequestingPermission(true)
    try {
      await togglePush()
    } catch (error) {
      logger.warn("📬 [Onboarding] Failed to enable notifications", { error })
    } finally {
      setIsRequestingPermission(false)
      handleNext()
    }
  }

  // Step 0: Welcome
  if (step === 0) {
    return (
      <OnboardingScreenLayout
        currentStep={0}
        totalSteps={TOTAL_STEPS}
        headerIcon="👋"
        title="Welcome to Vizory"
        subtitle="Track your stock, get low stock alerts, and never oversell again."
      >
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
          <Text weight="semiBold" style={styles.primaryButtonText} tx="onboardingScreen:letsGo" />
        </TouchableOpacity>
      </OnboardingScreenLayout>
    )
  }

  // Step 2: Notifications
  return (
    <OnboardingScreenLayout
      currentStep={1}
      totalSteps={TOTAL_STEPS}
      headerIcon="🔔"
      titleTx="onboardingScreen:notificationsTitle"
      subtitleTx="onboardingScreen:notificationsSubtitle"
    >
      {/* Notification Preview Card */}
      <View style={styles.notificationCard}>
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIcon}>
            <Ionicons name="chatbubble-ellipses" size={20} color={theme.colors.card} />
          </View>
          <View>
            <Text
              weight="semiBold"
              style={styles.notificationTitle}
              tx="onboardingScreen:notificationPreviewTitle"
            />
            <Text size="xs" color="secondary" tx="onboardingScreen:notificationPreviewTime" />
          </View>
        </View>
        <Text color="secondary" tx="onboardingScreen:notificationPreviewMessage" />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, isRequestingPermission && styles.primaryButtonDisabled]}
        onPress={handleEnableNotifications}
        activeOpacity={0.8}
        disabled={isRequestingPermission}
      >
        <Text weight="semiBold" style={styles.primaryButtonText}>
          {isRequestingPermission
            ? t("onboardingScreen:enabling")
            : t("onboardingScreen:turnOnNotifications")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={handleNext} activeOpacity={0.8}>
        <Text weight="medium" color="secondary" tx="onboardingScreen:maybeLater" />
      </TouchableOpacity>
    </OnboardingScreenLayout>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    width: "100%",
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.sizes.lg,
  },
  primaryButtonDisabled: {
    opacity: 0.8,
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  optionsContainer: {
    gap: theme.spacing.md,
    width: "100%",
  },
  optionButton: {
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  optionText: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sizes.lg,
  },
  notificationCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    width: "100%",
    ...theme.shadows.lg,
  },
  notificationHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: theme.spacing.sm,
  },
  notificationIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.error,
    borderRadius: theme.radius.sm,
    height: 32,
    justifyContent: "center",
    marginRight: theme.spacing.md,
    width: 32,
  },
  notificationTitle: {
    color: theme.colors.foreground,
  },
}))
