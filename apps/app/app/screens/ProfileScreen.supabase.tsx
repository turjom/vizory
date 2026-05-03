/**
 * ProfileScreen - Supabase Version
 *
 * This screen demonstrates proper data fetching patterns with Supabase:
 * - React Query for profile data fetching and caching
 * - Direct Supabase SDK usage for queries and mutations
 * - Optimistic updates when updating profile
 * - Pull-to-refresh for manual data refresh
 *
 * Copy this pattern for your own profile/settings screens with Supabase.
 */

import { FC, useCallback, useMemo, useState } from "react"
import {
  ScrollView,
  Switch,
  View,
  Platform,
  Pressable,
  useWindowDimensions,
  RefreshControl,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { addDays, differenceInCalendarDays, parseISO } from "date-fns"
import { useTranslation } from "react-i18next"
import Animated, { FadeInDown } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StyleSheet, useUnistyles } from "react-native-unistyles"
import { UnistylesRuntime } from "react-native-unistyles"

import { Avatar, Button, DeleteAccountModal, Text, MenuItem } from "@/components"
import { ANIMATION } from "@/config/constants"
import { features } from "@/config/features"
import { queryKeys, useAuth, useProfileQuery, type ProfileRow } from "@/hooks"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { mockRevenueCat } from "@/services/mocks/revenueCat"
import { isRevenueCatMock } from "@/services/revenuecat"
import { supabase } from "@/services/supabase"
import { useNotificationStore, useSubscriptionStore, useWidgetStore } from "@/stores"
import { webDimension } from "@/types/webStyles"
import { haptics } from "@/utils/haptics"
import { testErrors } from "@/utils/testError"

import { EditProfileModalSupabase } from "../components/EditProfileModal.supabase"

// =============================================================================
// CONSTANTS
// =============================================================================

const isWeb = Platform.OS === "web"
const CONTENT_MAX_WIDTH = 600

/** Free-trial length from `profiles.created_at` (calendar days). */
const FREE_TRIAL_DAYS = 30

// =============================================================================
// TYPES
// =============================================================================

interface ProfileScreenProps extends MainTabScreenProps<"Profile"> {}

/**
 * Update user profile
 * Uses mutation with optimistic updates
 */
const useUpdateProfile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      firstName,
      lastName,
    }: {
      userId: string
      firstName: string
      lastName: string
    }) => {
      const { data, error } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return data as unknown as ProfileRow
    },
    // Optimistic update
    onMutate: async ({ userId, firstName, lastName }) => {
      const profileKey = queryKeys.user.profile(userId)
      await queryClient.cancelQueries({ queryKey: profileKey })
      const previousProfile = queryClient.getQueryData<ProfileRow>(profileKey)

      queryClient.setQueryData<ProfileRow>(profileKey, (old) => ({
        id: userId,
        first_name: firstName,
        last_name: lastName,
        avatar_url: old?.avatar_url ?? null,
        created_at: old?.created_at ?? null,
        updated_at: new Date().toISOString(),
        preferred_currency_code: old?.preferred_currency_code ?? null,
      }))

      return { previousProfile }
    },
    onError: (_err, { userId }, context) => {
      // Rollback on error
      queryClient.setQueryData(queryKeys.user.profile(userId), context?.previousProfile)
    },
    onSettled: (_, __, { userId }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
  })
}

// =============================================================================
// COMPONENT
// =============================================================================

export const ProfileScreen: FC<ProfileScreenProps> = ({ navigation }) => {
  const { t } = useTranslation()
  const { user, signOut, userId } = useAuth()
  const isPro = useSubscriptionStore((state) => state.isPro)
  const checkProStatus = useSubscriptionStore((state) => state.checkProStatus)
  const isPushEnabled = useNotificationStore((state) => state.isPushEnabled)
  const permissionStatus = useNotificationStore((state) => state.permissionStatus)
  const syncPermissionFromOs = useNotificationStore((state) => state.syncPermissionFromOs)
  const togglePush = useNotificationStore((state) => state.togglePush)
  const isWidgetsEnabled = useWidgetStore((state) => state.isWidgetsEnabled)
  const userWidgetsEnabled = useWidgetStore((state) => state.userWidgetsEnabled)
  const toggleWidgets = useWidgetStore((state) => state.toggleWidgets)
  const syncStatus = useWidgetStore((state) => state.syncStatus)
  const insets = useSafeAreaInsets()
  const { theme } = useUnistyles()
  const { width: windowWidth } = useWindowDimensions()

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  // ============================================================
  // SUPABASE DATA FETCHING
  // Uses React Query for caching and refetching
  // ============================================================
  const {
    data: profile,
    isLoading: _profileLoading,
    refetch: refetchProfile,
    isRefetching,
  } = useProfileQuery()

  const updateProfile = useUpdateProfile()

  useFocusEffect(
    useCallback(() => {
      void syncPermissionFromOs()
    }, [syncPermissionFromOs]),
  )

  const notificationsSwitchValue = permissionStatus === "granted" && isPushEnabled

  const isLargeScreen = windowWidth > 768
  const contentStyle = isLargeScreen
    ? {
        maxWidth: CONTENT_MAX_WIDTH,
        alignSelf: "center" as const,
        width: webDimension("100%"),
      }
    : {}

  // Prefer `profiles.first_name` (and last when present); only then email local-part.
  const fn = profile?.first_name?.trim() ?? ""
  const ln = profile?.last_name?.trim() ?? ""
  const displayName =
    fn.length > 0 ? (ln.length > 0 ? `${fn} ${ln}` : fn) : user?.email?.split("@")[0] || "User"

  const trialStartIso = profile?.created_at ?? user?.createdAt ?? null
  const freeTrialDaysRemaining = useMemo(() => {
    if (!trialStartIso) return FREE_TRIAL_DAYS
    const trialEnd = addDays(parseISO(trialStartIso), FREE_TRIAL_DAYS)
    return Math.max(0, differenceInCalendarDays(trialEnd, new Date()))
  }, [trialStartIso])

  const userInitials = displayName.slice(0, 2).toUpperCase()
  const avatarUrl = profile?.avatar_url ?? undefined

  const toggleThemeMode = () => {
    haptics.switchChange()
    const newTheme = UnistylesRuntime.themeName === "dark" ? "light" : "dark"
    UnistylesRuntime.setTheme(newTheme)
  }

  const handleTogglePush = () => {
    haptics.switchChange()
    togglePush(userId ?? undefined)
  }

  const handleToggleWidgets = () => {
    haptics.switchChange()
    toggleWidgets()
  }

  const handleSignOut = async () => {
    haptics.buttonPress()
    await signOut()
  }

  const handleMockToggleSubscription = () => {
    haptics.switchChange()
    mockRevenueCat.setProStatus(!isPro)
    checkProStatus()
  }

  const handleProfileUpdate = async (firstName: string, lastName: string) => {
    if (!userId) return { error: new Error("Not authenticated") }

    try {
      await updateProfile.mutateAsync({ userId, firstName, lastName })
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const handleRefresh = async () => {
    await refetchProfile()
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.gradient}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            contentStyle,
            { paddingTop: theme.spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
            <Text style={styles.screenTitle} tx="profileScreen:title" />
          </Animated.View>

          {/* Profile Card */}
          <Animated.View
            entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY).springify()}
            style={styles.profileCard}
          >
            <View style={styles.profileCardInner}>
              <Avatar
                source={avatarUrl ? { uri: avatarUrl } : undefined}
                fallback={userInitials}
                size="xl"
              />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                {isPro ? (
                  <View style={styles.proBadge}>
                    <Ionicons name="diamond" size={12} color={theme.colors.background} />
                    <Text style={styles.proText} tx="profileScreen:proBadge" />
                    {isRevenueCatMock && <Text style={styles.mockBadge}> (Mock)</Text>}
                  </View>
                ) : freeTrialDaysRemaining === 0 ? (
                  <Pressable
                    onPress={() => {
                      haptics.buttonPress()
                      navigation.navigate("Paywall")
                    }}
                    style={({ pressed }) => [
                      styles.subscribeButton,
                      pressed && styles.subscribeButtonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t("profileScreen:subscribe")}
                  >
                    <Text style={styles.subscribeButtonText} tx="profileScreen:subscribe" />
                  </Pressable>
                ) : (
                  <Text
                    style={styles.trialText}
                    tx={
                      freeTrialDaysRemaining === 1
                        ? "profileScreen:trialDayRemaining"
                        : "profileScreen:trialDaysRemaining"
                    }
                    txOptions={{ count: freeTrialDaysRemaining }}
                  />
                )}
              </View>
            </View>
          </Animated.View>

          {/* Settings Section */}
          <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 2).springify()}>
            <Text style={styles.sectionTitle} tx="profileScreen:settingsTitle" />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 2.5).springify()}
            style={styles.menuGroup}
          >
            <MenuItem
              icon="person-outline"
              title={t("profileScreen:personalInfo")}
              subtitle={t("profileScreen:personalInfoSubtitle")}
              onPress={() => setEditModalVisible(true)}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="notifications-outline"
              title={t("profileScreen:notifications")}
              subtitle={t("profileScreen:notificationsSubtitle")}
              rightElement={
                <Switch
                  value={notificationsSwitchValue}
                  onValueChange={handleTogglePush}
                  trackColor={{ false: theme.colors.borderSecondary, true: theme.colors.primary }}
                  thumbColor={theme.colors.card}
                />
              }
            />
            <View style={styles.divider} />
            <MenuItem
              icon="moon-outline"
              title={t("profileScreen:darkMode")}
              rightElement={
                <Switch
                  value={UnistylesRuntime.themeName === "dark"}
                  onValueChange={toggleThemeMode}
                  trackColor={{ false: theme.colors.borderSecondary, true: theme.colors.primary }}
                  thumbColor={theme.colors.card}
                />
              }
            />
            {isWidgetsEnabled && (
              <>
                <View style={styles.divider} />
                <MenuItem
                  icon="apps-outline"
                  title={t("profileScreen:widgets")}
                  subtitle={
                    syncStatus === "syncing"
                      ? t("profileScreen:widgetsSyncing")
                      : userWidgetsEnabled
                        ? t("profileScreen:widgetsEnabled")
                        : t("profileScreen:widgetsDisabled")
                  }
                  rightElement={
                    <Switch
                      value={userWidgetsEnabled}
                      onValueChange={handleToggleWidgets}
                      trackColor={{
                        false: theme.colors.borderSecondary,
                        true: theme.colors.primary,
                      }}
                      thumbColor={theme.colors.card}
                      disabled={syncStatus === "syncing"}
                    />
                  }
                />
              </>
            )}
          </Animated.View>

          {/* Support Section */}
          <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 3).springify()}>
            <Text style={styles.sectionTitle} tx="profileScreen:supportTitle" />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 3.5).springify()}
            style={styles.menuGroup}
          >
            <MenuItem icon="help-circle-outline" title={t("profileScreen:helpCenter")} />
            <View style={styles.divider} />
            <MenuItem icon="shield-checkmark-outline" title={t("profileScreen:privacyPolicy")} />
          </Animated.View>

          {/* Development Section - Only visible in dev mode */}
          {features.enableDebugLogging && (
            <>
              <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 3.8).springify()}>
                <Text style={styles.sectionTitle} tx="profileScreen:developmentTitle" />
              </Animated.View>
              <Animated.View
                entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 4).springify()}
                style={styles.menuGroup}
              >
                {isRevenueCatMock && (
                  <>
                    <MenuItem
                      icon="diamond-outline"
                      title={isPro ? "Unsubscribe (Mock)" : "Subscribe (Mock)"}
                      subtitle={
                        isPro
                          ? "Toggle off mock Pro subscription"
                          : "Toggle on mock Pro subscription"
                      }
                      rightElement={
                        <Switch
                          value={isPro}
                          onValueChange={handleMockToggleSubscription}
                          trackColor={{
                            false: theme.colors.borderSecondary,
                            true: theme.colors.palette.success500,
                          }}
                          thumbColor={theme.colors.card}
                        />
                      }
                    />
                    <View style={styles.divider} />
                  </>
                )}
                <MenuItem
                  icon="bug-outline"
                  title={t("profileScreen:testSentryError")}
                  subtitle={t("profileScreen:testSentryErrorSubtitle")}
                  onPress={() => {
                    haptics.buttonPress()
                    testErrors.testSimpleError()
                  }}
                />
                <View style={styles.divider} />
                <MenuItem
                  icon="warning-outline"
                  title={t("profileScreen:testWarning")}
                  subtitle={t("profileScreen:testWarningSubtitle")}
                  onPress={() => {
                    haptics.buttonPress()
                    testErrors.testWarningMessage()
                  }}
                />
                <View style={styles.divider} />
                <MenuItem
                  icon="information-circle-outline"
                  title={t("profileScreen:testInfoMessage")}
                  subtitle={t("profileScreen:testInfoMessageSubtitle")}
                  onPress={() => {
                    haptics.buttonPress()
                    testErrors.testInfoMessage()
                  }}
                />
                <View style={styles.divider} />
                <MenuItem
                  icon="code-outline"
                  title={t("profileScreen:testErrorWithContext")}
                  subtitle={t("profileScreen:testErrorWithContextSubtitle")}
                  onPress={() => {
                    haptics.buttonPress()
                    testErrors.testErrorWithContext()
                  }}
                />
              </Animated.View>
            </>
          )}

          <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 4).springify()}>
            <Text style={styles.sectionTitle} tx="profileScreen:accountTitle" />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 4.5).springify()}
            style={styles.dangerCard}
          >
            <MenuItem
              icon="log-out-outline"
              title={t("profileScreen:signOut")}
              subtitle={t("profileScreen:signOutSubtitle")}
              onPress={handleSignOut}
            />
            <View style={styles.divider} />
            <View style={styles.dangerHeader}>
              <View style={styles.dangerCopy}>
                <Text style={styles.dangerTitle} tx="profileScreen:deleteAccount" />
                <Text style={styles.dangerSubtitle} tx="profileScreen:deleteAccountSubtitle" />
              </View>
              <View style={styles.dangerBadge}>
                <Ionicons name="shield-half-outline" size={16} color={theme.colors.error} />
                <Text style={styles.dangerBadgeText} tx="profileScreen:deleteAccountPrivacy" />
              </View>
            </View>

            <View style={styles.dangerBullets}>
              <View style={styles.dangerBullet}>
                <View style={styles.dangerIcon}>
                  <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                </View>
                <Text style={styles.dangerBulletText} tx="profileScreen:deleteAccountBullet1" />
              </View>
              <View style={styles.dangerBullet}>
                <View style={styles.dangerIcon}>
                  <Ionicons name="receipt-outline" size={16} color={theme.colors.error} />
                </View>
                <Text style={styles.dangerBulletText} tx="profileScreen:deleteAccountBullet2" />
              </View>
              <View style={styles.dangerBullet}>
                <View style={styles.dangerIcon}>
                  <Ionicons name="log-out-outline" size={16} color={theme.colors.error} />
                </View>
                <Text style={styles.dangerBulletText} tx="profileScreen:deleteAccountBullet3" />
              </View>
            </View>

            <Button
              tx="profileScreen:deleteMyAccount"
              variant="danger"
              onPress={() => {
                haptics.delete()
                setDeleteModalVisible(true)
              }}
              style={styles.dangerButton}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 5.2).springify()}>
            <Text
              style={styles.versionText}
              tx="profileScreen:version"
              txOptions={{ version: "1.0.0", build: "12" }}
            />
          </Animated.View>
        </ScrollView>
      </View>

      {/* Edit Profile Modal - Supabase version with React Query */}
      <EditProfileModalSupabase
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        profile={profile}
        onUpdate={handleProfileUpdate}
        isUpdating={updateProfile.isPending}
      />
      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
      />
    </View>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    ...(isWeb && {
      minHeight: webDimension("100vh"),
    }),
  },
  gradient: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    ...(isWeb && {
      minHeight: webDimension("100vh"),
    }),
  },
  scrollView: {
    flex: 1,
    ...(isWeb && {
      overflowY: "auto" as unknown as "scroll",
    }),
  },
  scrollContent: {
    paddingBottom: 120,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl,
  },
  screenTitle: {
    alignSelf: "stretch",
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.bold,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    textAlign: "left",
  },
  profileCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius["3xl"],
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  profileCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.lg,
  },
  profileInfo: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  profileName: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.xl,
    lineHeight: theme.typography.lineHeights.xl,
  },
  profileEmail: {
    color: theme.colors.foregroundSecondary,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
    marginBottom: theme.spacing.xs,
  },
  proBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.foreground,
    borderRadius: theme.radius.lg,
    flexDirection: "row",
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  proText: {
    color: theme.colors.background,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: 12,
    lineHeight: 14,
  } as const,
  mockBadge: {
    color: theme.colors.background,
    fontFamily: theme.typography.fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    opacity: 0.7,
  } as const,
  trialText: {
    color: theme.colors.foregroundSecondary,
    fontFamily: theme.typography.fonts.medium,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
  },
  subscribeButton: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    marginTop: theme.spacing.xxs,
  },
  subscribeButtonPressed: {
    opacity: 0.9,
  },
  subscribeButtonText: {
    color: theme.colors.accentForeground,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
  },
  sectionTitle: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.bold,
    fontSize: theme.typography.sizes.lg,
    lineHeight: theme.typography.lineHeights.lg,
    marginBottom: theme.spacing.md,
    marginLeft: theme.spacing.xxs,
  },
  menuGroup: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius["2xl"],
    borderWidth: 1,
    gap: theme.spacing.xxs,
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  divider: {
    backgroundColor: theme.colors.separator,
    height: 1,
    marginLeft: 56,
    opacity: 0.6,
  },
  dangerCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.errorBackground,
    borderRadius: theme.radius["2xl"],
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.md,
  },
  dangerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  dangerCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  dangerTitle: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.lg,
    lineHeight: theme.typography.lineHeights.lg,
  },
  dangerSubtitle: {
    color: theme.colors.foregroundSecondary,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
  },
  dangerBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.errorBackground,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
  },
  dangerBadgeText: {
    color: theme.colors.error,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.xs,
  },
  dangerBullets: {
    gap: theme.spacing.sm,
  },
  dangerBullet: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  dangerIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.errorBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBulletText: {
    flex: 1,
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.base,
    lineHeight: theme.typography.lineHeights.base,
  },
  dangerButton: {
    marginTop: theme.spacing.xs,
  },
  versionText: {
    color: theme.colors.foregroundTertiary,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.xs,
    lineHeight: theme.typography.lineHeights.xs,
    marginBottom: theme.spacing.xl,
    textAlign: "center",
  },
}))
