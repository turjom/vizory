import { useEffect, useCallback, useRef, useState } from "react"
import { View, Platform, ActivityIndicator, ScrollView, Pressable } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text, Container, Button } from "../components"
import { env } from "../config/env"
import type { AppStackParamList } from "../navigators/navigationTypes"
import { resetRoot } from "../navigators/navigationUtilities"
import { mockRevenueCat } from "../services/mocks/revenueCat"
import { isRevenueCatMock } from "../services/revenuecat"
import { useSubscriptionStore } from "../stores/subscriptionStore"
import type { PricingPackage } from "../types/subscription"
import { logger } from "../utils/Logger"

// Conditionally import native RevenueCat SDKs (not available on web or in mock mode)
// Note: isRevenueCatMock is imported from revenuecat service which handles the mock detection logic
type RevenueCatOfferings = { current?: unknown }
type RevenueCatPurchases = { getOfferings: () => Promise<RevenueCatOfferings> }
type RevenueCatPaywalls = {
  presentPaywall: (options: { offering: unknown }) => Promise<unknown>
}

let Purchases: RevenueCatPurchases | null = null
let Paywalls: RevenueCatPaywalls | null = null

// Only load native SDK if not web and not in mock mode
// Mock mode = dev environment without API keys
// We check isRevenueCatMock at runtime in the component, but for module-level imports
// we need to check the same conditions
const mobileApiKey = Platform.select({
  ios: env.revenueCatIosKey,
  android: env.revenueCatAndroidKey,
})
// Load SDK if: not web AND (production OR has API key)
const shouldLoadNativeSDK = Platform.OS !== "web" && (!__DEV__ || mobileApiKey)

if (shouldLoadNativeSDK) {
  try {
    Purchases = require("react-native-purchases").default
    Paywalls = require("react-native-purchases-ui").Paywalls
  } catch (e) {
    if (__DEV__) {
      logger.warn("Failed to load react-native-purchases", { error: e })
    }
  }
}

// Height of floating tab bar + its bottom margin for content padding
const TAB_BAR_HEIGHT = 80

// =============================================================================
// COMPONENT
// =============================================================================

export const PaywallScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const { bottom } = useSafeAreaInsets()
  const isPro = useSubscriptionStore((state) => state.isPro)
  const packages = useSubscriptionStore((state) => state.packages)
  const fetchPackages = useSubscriptionStore((state) => state.fetchPackages)
  const purchasePackage = useSubscriptionStore((state) => state.purchasePackage)
  const subscriptionLoading = useSubscriptionStore((state) => state.loading)
  const isWeb = Platform.OS === "web"
  const isMock = isRevenueCatMock
  const isMockMode = isMock || !Purchases || !Paywalls
  const [isPresenting, setIsPresenting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAutoPresented, setHasAutoPresented] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const restoreMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [restoreMessage, setRestoreMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const loadErrorMessage = t("paywallScreen:loadFailed")
  const purchaseErrorMessage = t("paywallScreen:purchaseFailed")
  const noWebOfferingMessage = t("paywallScreen:noWebOfferingError")
  const noPackagesMessage = t("paywallScreen:noPackagesError")
  const sdkUnavailableMessage = t("paywallScreen:sdkUnavailableError")

  // Calculate bottom padding to account for floating tab bar
  const bottomPadding = Math.max(bottom, 20) + TAB_BAR_HEIGHT

  const scheduleRestoreMessageClear = useCallback(() => {
    if (restoreMessageTimeoutRef.current) {
      clearTimeout(restoreMessageTimeoutRef.current)
    }
    restoreMessageTimeoutRef.current = setTimeout(() => {
      setRestoreMessage(null)
      restoreMessageTimeoutRef.current = null
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (restoreMessageTimeoutRef.current) {
        clearTimeout(restoreMessageTimeoutRef.current)
      }
    }
  }, [])

  /** Leave paywall: back if stacked, otherwise land on Main. */
  const leavePaywall = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      resetRoot({
        index: 0,
        routes: [{ name: "Main" }],
      })
    }
  }, [navigation])

  // Reset mock subscription state (DEV only)
  const handleResetMock = useCallback(() => {
    if (__DEV__ && isMock) {
      mockRevenueCat.reset()
      // Force refresh subscription store
      useSubscriptionStore.getState().checkProStatus()
      logger.info("[Paywall] Mock subscription state reset")
    }
  }, [isMock])

  // Present RevenueCat Paywall
  const presentPaywall = useCallback(async () => {
    // Web path or Mock mode - use subscription store packages
    if (isWeb || isMockMode) {
      try {
        setIsPresenting(true)
        setError(null)

        // Ensure packages are loaded
        if (!useSubscriptionStore.getState().packages.length) {
          await fetchPackages()
        }

        if (!useSubscriptionStore.getState().packages.length) {
          throw new Error(isWeb ? noWebOfferingMessage : noPackagesMessage)
        }

        // Auto-select annual package if available
        const pkgs = useSubscriptionStore.getState().packages
        const annualPkg = pkgs.find(
          (p) =>
            p.identifier.toLowerCase().includes("annual") ||
            p.identifier.toLowerCase().includes("year"),
        )
        setSelectedPackage(annualPkg?.identifier || pkgs[0]?.identifier || null)
      } catch (err) {
        logger.error("Failed to load paywall", { error: err })
        setError(err instanceof Error ? err.message : loadErrorMessage)
      } finally {
        setIsPresenting(false)
      }
      return
    }

    // Native path (iOS/Android) with real RevenueCat SDK
    if (!Purchases || !Paywalls) {
      logger.error("RevenueCat native SDK not available")
      setError(sdkUnavailableMessage)
      return
    }

    try {
      setIsPresenting(true)
      setError(null)

      // Get the current offering
      const offerings = await Purchases.getOfferings()
      const currentOffering = offerings.current

      if (!currentOffering) {
        throw new Error(t("paywallScreen:noOfferingError"))
      }

      // Present the paywall configured in RevenueCat dashboard
      const result = await Paywalls.presentPaywall({
        offering: currentOffering,
      })

      // Normalize result shape from SDK
      const resultValue =
        typeof result === "string" ? result : (result as { result?: string } | null)?.result

      // If the SDK returned fresh customer info (e.g., "Test Valid Purchase"/restore),
      // apply it immediately so the Pro state updates without waiting on a fetch.
      // Refresh subscription status after paywall is dismissed (authoritative fetch)
      const service = useSubscriptionStore.getState().getActiveService()
      const subscriptionInfo = await service.getSubscriptionInfo()
      const { platform } = useSubscriptionStore.getState()

      if (platform === "revenuecat-web") {
        useSubscriptionStore.getState().setWebSubscriptionInfo(subscriptionInfo)
      } else {
        useSubscriptionStore.getState().setCustomerInfo(subscriptionInfo)
      }

      if (resultValue === "PURCHASED" || resultValue === "RESTORED") {
        leavePaywall()
      }

      // Log unexpected results for debugging
      if (resultValue && resultValue !== "PURCHASED" && resultValue !== "RESTORED") {
        logger.info("[Paywall] Unexpected paywall result", { result: resultValue })
      }
    } catch (err) {
      logger.error("Failed to present paywall", { error: err })
      setError(err instanceof Error ? err.message : loadErrorMessage)
    } finally {
      setIsPresenting(false)
    }
  }, [
    fetchPackages,
    isWeb,
    isMockMode,
    loadErrorMessage,
    leavePaywall,
    noPackagesMessage,
    noWebOfferingMessage,
    sdkUnavailableMessage,
    t,
  ])

  // Handle purchase flow (web or mock mode)
  const handlePackagePurchase = useCallback(
    async (pkg: PricingPackage) => {
      try {
        setError(null)

        const result = await purchasePackage(pkg)

        if (result.error) {
          throw result.error
        }

        leavePaywall()
      } catch (err) {
        logger.error("Purchase failed", { error: err })
        setError(err instanceof Error ? err.message : purchaseErrorMessage)
      }
    },
    [purchaseErrorMessage, purchasePackage, leavePaywall],
  )

  // Auto-present paywall when screen loads (if not Pro)
  useEffect(() => {
    if (!isPro && !isPresenting && !hasAutoPresented) {
      setHasAutoPresented(true)
      presentPaywall()
    }
  }, [isPro, isPresenting, presentPaywall, hasAutoPresented])

  // Auto-dismiss if user is already Pro (e.g. restored subscription while screen is open)
  useEffect(() => {
    if (isPro) {
      const timer = setTimeout(() => {
        leavePaywall()
      }, 500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [isPro, leavePaywall])

  // Handle manual paywall presentation (for retry or if auto-present failed)
  const handlePresentPaywall = useCallback(() => {
    presentPaywall()
  }, [presentPaywall])

  // Handle skip/continue (only shown if paywall failed to present)
  const handleSkip = useCallback(() => {
    leavePaywall()
  }, [leavePaywall])

  // Get selected package for purchase
  const getSelectedPkg = () => packages.find((p) => p.identifier === selectedPackage)

  // Handle restore purchases
  const handleRestorePurchases = useCallback(async () => {
    try {
      setIsRestoring(true)
      setRestoreMessage(null)

      const result = await useSubscriptionStore.getState().restorePurchases()

      if (result.error) {
        setRestoreMessage({ type: "error", text: t("paywallScreen:restoreFailed") })
      } else {
        const isPro = useSubscriptionStore.getState().isPro
        if (isPro) {
          setRestoreMessage({ type: "success", text: t("paywallScreen:restoreSuccess") })
        } else {
          setRestoreMessage({ type: "error", text: t("paywallScreen:noPurchasesFound") })
        }
      }

      // Auto-hide message after 3 seconds
      scheduleRestoreMessageClear()
    } catch (err) {
      logger.error("Restore purchases failed", { error: err })
      setRestoreMessage({ type: "error", text: t("paywallScreen:restoreFailed") })
      scheduleRestoreMessageClear()
    } finally {
      setIsRestoring(false)
    }
  }, [scheduleRestoreMessageClear, t])

  return (
    <Container safeAreaEdges={["top"]}>
      {isPro ? (
        // User is already Pro - show success message
        <View style={[styles.centeredContainer, { paddingBottom: bottomPadding }]}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>Pro</Text>
          </View>
          <Text preset="heading" style={styles.title} tx="paywallScreen:welcomeTitle" />
          <Text style={styles.description} tx="paywallScreen:welcomeDescription" />
        </View>
      ) : isPresenting ? (
        // Loading state while presenting paywall
        <View style={[styles.centeredContainer, { paddingBottom: bottomPadding }]}>
          <ActivityIndicator size="large" color={theme.colors.tint} />
          <Text style={styles.loadingText} tx="paywallScreen:loadingPaywall" />
        </View>
      ) : isWeb || isMockMode ? (
        // Web billing or Mock mode - use packages + custom UI instead of native paywall
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {/* DEV-only mock mode warning banner */}
          {__DEV__ && isMock && (
            <View style={styles.mockBanner}>
              <Text style={styles.mockBannerText}>MOCK MODE</Text>
              <Text style={styles.mockBannerSubtext}>
                Purchases are simulated. Add EXPO_PUBLIC_REVENUECAT_IOS_KEY to .env for real
                purchases.
              </Text>
              <Pressable style={styles.mockResetButton} onPress={handleResetMock}>
                <Text style={styles.mockResetButtonText}>Reset Subscription</Text>
              </Pressable>
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <Text preset="heading" style={styles.title} tx="paywallScreen:unlockPro" />
            <Text style={styles.subtitle} tx="paywallScreen:unlockProDescription" />
          </View>

          {/* Features list */}
          <View style={styles.featuresContainer}>
            {[
              { titleKey: "paywallScreen:featureUnlimitedProjects" as const, descKey: "paywallScreen:featureUnlimitedProjectsDesc" as const },
              { titleKey: "paywallScreen:featurePrioritySupport" as const, descKey: "paywallScreen:featurePrioritySupportDesc" as const },
              { titleKey: "paywallScreen:featureAdvancedAnalytics" as const, descKey: "paywallScreen:featureAdvancedAnalyticsDesc" as const },
              { titleKey: "paywallScreen:featureNoWatermarks" as const, descKey: "paywallScreen:featureNoWatermarksDesc" as const },
            ].map((feature, idx) => (
              <View key={idx} style={styles.featureRow}>
                <View style={styles.featureCheck}>
                  <Text style={styles.featureCheckText}>✓</Text>
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{t(feature.titleKey)}</Text>
                  <Text style={styles.featureDesc}>{t(feature.descKey)}</Text>
                </View>
              </View>
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Package selection */}
          <View style={styles.packageSection}>
            <Text style={styles.sectionTitle} tx="paywallScreen:choosePlan" />

            {packages.length === 0 ? (
              <Text style={styles.errorText}>
                {isWeb ? noWebOfferingMessage : noPackagesMessage}
              </Text>
            ) : (
              <View style={styles.packageList}>
                {packages.map((pricingPkg) => {
                  const isAnnual =
                    pricingPkg.identifier.toLowerCase().includes("annual") ||
                    pricingPkg.identifier.toLowerCase().includes("year")
                  const isSelected = selectedPackage === pricingPkg.identifier
                  const displayPrice = pricingPkg.priceString || `$${pricingPkg.price.toFixed(2)}`

                  return (
                    <Pressable
                      key={pricingPkg.identifier}
                      style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                      onPress={() => setSelectedPackage(pricingPkg.identifier)}
                    >
                      {isAnnual && (
                        <View style={styles.bestValueBadge}>
                          <Text style={styles.bestValueText} tx="paywallScreen:bestValue" />
                        </View>
                      )}
                      <View style={styles.packageRadio}>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                      </View>
                      <View style={styles.packageInfo}>
                        <Text style={styles.packageName}>{isAnnual ? t("paywallScreen:annual") : t("paywallScreen:monthly")}</Text>
                        <Text style={styles.packagePrice}>{displayPrice}</Text>
                        {isAnnual && (
                          <Text style={styles.packageSavings}>
                            {t("paywallScreen:savingsPerMonth", { price: (pricingPkg.price / 12).toFixed(2) })}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>

          {/* CTA Button */}
          <Button
            tx={isMock ? "paywallScreen:simulatePurchase" : "paywallScreen:continue"}
            onPress={() => {
              const pkg = getSelectedPkg()
              if (pkg) handlePackagePurchase(pkg)
            }}
            variant="filled"
            style={styles.ctaButton}
            disabled={subscriptionLoading || isPresenting || !selectedPackage}
            loading={subscriptionLoading}
          />

          {/* Trust signals */}
          <View style={styles.trustSignals}>
            <Text style={styles.trustText} tx="paywallScreen:cancelAnytime" />
            <Text style={styles.trustDot}>•</Text>
            <Text style={styles.trustText} tx="paywallScreen:secureCheckout" />
            <Text style={styles.trustDot}>•</Text>
            <Text style={styles.trustText} tx="paywallScreen:instantAccess" />
          </View>

          <Button
            text={t("paywallScreen:continueWithFree")}
            onPress={handleSkip}
            variant="ghost"
            style={styles.skipButton}
            disabled={subscriptionLoading || isPresenting}
          />

          {/* Restore purchases */}
          <View style={styles.restoreContainer}>
            {restoreMessage && (
              <View
                style={[
                  styles.restoreMessageBanner,
                  restoreMessage.type === "success"
                    ? styles.restoreMessageSuccess
                    : styles.restoreMessageError,
                ]}
              >
                <Text
                  style={[
                    styles.restoreMessageText,
                    restoreMessage.type === "success"
                      ? styles.restoreMessageTextSuccess
                      : styles.restoreMessageTextError,
                  ]}
                >
                  {restoreMessage.text}
                </Text>
              </View>
            )}
            <Button
              tx={isRestoring ? "paywallScreen:restoring" : "paywallScreen:restorePurchases"}
              onPress={handleRestorePurchases}
              variant="ghost"
              style={styles.restoreButton}
              disabled={isRestoring || subscriptionLoading}
              loading={isRestoring}
            />
          </View>
        </ScrollView>
      ) : error ? (
        // Error state - show error and retry option
        <View style={[styles.centeredContainer, { paddingBottom: bottomPadding }]}>
          <Text preset="heading" style={styles.title} tx="paywallScreen:unableToLoadTitle" />
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.buttonContainer}>
            <Button
              text={t("paywallScreen:tryAgain")}
              onPress={handlePresentPaywall}
              variant="filled"
              style={styles.retryButton}
            />
            <Button
              text={t("paywallScreen:continueWithFree")}
              onPress={handleSkip}
              variant="ghost"
              style={styles.skipButton}
            />
          </View>
        </View>
      ) : (
        // Fallback - should not reach here, but show option to present paywall
        <View style={[styles.centeredContainer, { paddingBottom: bottomPadding }]}>
          <Text preset="heading" style={styles.title} tx="paywallScreen:upgradeTitle" />
          <Text style={styles.description} tx="paywallScreen:upgradeDescription" />
          <Button
            text={t("paywallScreen:viewPlans")}
            onPress={handlePresentPaywall}
            variant="filled"
            style={styles.presentButton}
          />
          <Button
            text={t("paywallScreen:continueWithFree")}
            onPress={handleSkip}
            variant="ghost"
            style={styles.skipButton}
          />
        </View>
      )}
    </Container>
  )
}

const styles = StyleSheet.create((theme) => ({
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: "center",
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  title: {
    color: theme.colors.foreground,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: theme.colors.foregroundSecondary,
    fontSize: 16,
    lineHeight: 22,
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  description: {
    color: theme.colors.foregroundSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
    textAlign: "center",
  },
  // Features
  featuresContainer: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 16,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  featureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.palette.success500,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCheckText: {
    color: theme.colors.palette.white,
    fontSize: 14,
    fontWeight: "700",
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: theme.colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  featureDesc: {
    color: theme.colors.foregroundSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  // Package selection
  packageSection: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.foreground,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: theme.spacing.md,
  },
  packageList: {
    gap: theme.spacing.sm,
  },
  packageCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  packageCardSelected: {
    borderColor: theme.colors.tint,
    backgroundColor: theme.colors.palette.primary100,
  },
  bestValueBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: theme.colors.palette.success500,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  bestValueText: {
    color: theme.colors.palette.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  packageRadio: {
    marginRight: theme.spacing.md,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: theme.colors.tint,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.tint,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    color: theme.colors.foreground,
    fontSize: 16,
    fontWeight: "600",
  },
  packagePrice: {
    color: theme.colors.foreground,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  packageSavings: {
    color: theme.colors.palette.success600,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  // CTA
  ctaButton: {
    marginBottom: theme.spacing.md,
  },
  // Trust signals
  trustSignals: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  trustText: {
    color: theme.colors.foregroundTertiary,
    fontSize: 12,
    fontWeight: "500",
  },
  trustDot: {
    color: theme.colors.foregroundTertiary,
    fontSize: 12,
  },
  // Other
  loadingText: {
    color: theme.colors.foregroundSecondary,
    fontSize: 14,
    marginTop: theme.spacing.md,
    textAlign: "center",
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
    textAlign: "center",
  },
  buttonContainer: {
    alignItems: "center",
    gap: theme.spacing.md,
    width: "100%",
  },
  presentButton: {
    width: "100%",
  },
  retryButton: {
    width: "100%",
  },
  skipButton: {
    marginBottom: theme.spacing.sm,
  },
  restoreContainer: {
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  restoreButton: {
    minWidth: 160,
  },
  restoreMessageBanner: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  restoreMessageSuccess: {
    backgroundColor: theme.colors.palette.success100,
    borderWidth: 1,
    borderColor: theme.colors.palette.success500,
  },
  restoreMessageError: {
    backgroundColor: theme.colors.palette.error100,
    borderWidth: 1,
    borderColor: theme.colors.palette.error500,
  },
  restoreMessageText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  restoreMessageTextSuccess: {
    color: theme.colors.palette.success700,
  },
  restoreMessageTextError: {
    color: theme.colors.palette.error700,
  },
  // Mock banner
  mockBanner: {
    backgroundColor: theme.colors.palette.warning100,
    borderColor: theme.colors.palette.warning500,
    borderWidth: 1,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    alignItems: "center",
  },
  mockBannerText: {
    color: theme.colors.palette.warning700,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  mockBannerSubtext: {
    color: theme.colors.palette.warning600,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  mockResetButton: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.palette.warning500,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 6,
  },
  mockResetButtonText: {
    color: theme.colors.palette.white,
    fontSize: 12,
    fontWeight: "600",
  },
  // Success state
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  successIconText: {
    color: theme.colors.palette.white,
    fontSize: 18,
    fontWeight: "800",
  },
}))
