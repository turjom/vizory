import { FC } from "react"
import { View, ScrollView, Pressable, Platform, useWindowDimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import Animated, { FadeInDown } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text, Avatar, Badge, PressableCard } from "@/components"
import { ANIMATION } from "@/config/constants"
import { useAuth } from "@/hooks"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { useNotificationStore } from "@/stores"
import { webDimension } from "@/types/webStyles"
import { haptics } from "@/utils/haptics"

// =============================================================================
// TYPES
// =============================================================================

interface HomeScreenProps extends MainTabScreenProps<"Home"> {}

// =============================================================================
// CONSTANTS
// =============================================================================

const isWeb = Platform.OS === "web"
const CONTENT_MAX_WIDTH = 800

// Spring config for animations
// =============================================================================
// COMPONENT
// =============================================================================

export const HomeScreen: FC<HomeScreenProps> = function HomeScreen(_props) {
  const { navigation } = _props
  const { theme } = useUnistyles()
  const { user } = useAuth()
  const isPushEnabled = useNotificationStore((state) => state.isPushEnabled)
  const togglePush = useNotificationStore((state) => state.togglePush)
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()

  const isLargeScreen = windowWidth > 768
  const contentStyle = isLargeScreen
    ? {
        maxWidth: CONTENT_MAX_WIDTH,
        alignSelf: "center" as const,
        width: webDimension("100%"),
      }
    : {}

  const handleNavigateToComponents = () => {
    navigation.navigate("ComponentShowcase")
  }

  const handleTogglePush = () => {
    haptics.switchChange()
    togglePush()
  }

  // Use unified user object from useAuth
  const userName = user?.displayName ?? user?.email?.split("@")[0] ?? "User"
  const userInitials = userName.slice(0, 2).toUpperCase()
  const avatarUrl = user?.avatarUrl ?? undefined

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradientStart, theme.colors.gradientMiddle, theme.colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            contentStyle,
            { paddingTop: insets.top + theme.spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
            <View style={styles.headerLeft}>
              <Avatar
                source={avatarUrl ? { uri: avatarUrl } : undefined}
                fallback={userInitials}
                size="md"
              />
              <View style={styles.headerText}>
                <Text size="sm" color="secondary" tx="homeScreen:goodMorning" />
                <Text size="xl" weight="bold">
                  {userName}
                </Text>
              </View>
            </View>
            <Pressable style={styles.notificationButton} onPress={handleTogglePush}>
              <Ionicons
                name={isPushEnabled ? "notifications" : "notifications-off-outline"}
                size={24}
                color={theme.colors.foreground}
              />
              {isPushEnabled && <Badge dot variant="error" size="sm" />}
            </Pressable>
          </Animated.View>

          {/* Featured Card */}
          <PressableCard style={styles.featuredCard} delay={ANIMATION.STAGGER_DELAY}>
            <View style={styles.featuredContent}>
              <Badge tx="homeScreen:dailyChallenge" variant="info" size="sm" />
              <View style={styles.titleRow}>
                <View style={styles.featuredIconBox}>
                  <Ionicons
                    name="flower-outline"
                    size={24}
                    color={theme.colors.palette.primary600}
                  />
                </View>
                <Text
                  size="2xl"
                  weight="bold"
                  style={styles.featuredTitle}
                  tx="homeScreen:featuredTitle"
                />
              </View>
              <Text
                color="secondary"
                style={styles.featuredSubtitle}
                tx="homeScreen:featuredSubtitle"
              />
              <Pressable style={styles.startButton} onPress={() => haptics.buttonPress()}>
                <Text weight="semiBold" style={styles.startButtonText} tx="homeScreen:startNow" />
                <Ionicons name="play-circle" size={22} color={theme.colors.card} />
              </Pressable>
            </View>
          </PressableCard>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <PressableCard
              style={styles.statCard}
              containerStyle={styles.statCardContainer}
              delay={ANIMATION.STAGGER_DELAY * 2}
            >
              <View style={styles.statIconBox}>
                <Ionicons name="flame-outline" size={18} color={theme.colors.palette.accent500} />
              </View>
              <Text size="2xl" weight="bold">
                12
              </Text>
              <Text size="xs" color="secondary" tx="homeScreen:statStreak" />
            </PressableCard>
            <PressableCard
              style={styles.statCard}
              containerStyle={styles.statCardContainer}
              delay={ANIMATION.STAGGER_DELAY * 2.5}
            >
              <View style={styles.statIconBox}>
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.success} />
              </View>
              <Text size="2xl" weight="bold">
                85%
              </Text>
              <Text size="xs" color="secondary" tx="homeScreen:statCompleted" />
            </PressableCard>
            <PressableCard
              style={styles.statCard}
              containerStyle={styles.statCardContainer}
              delay={ANIMATION.STAGGER_DELAY * 3}
            >
              <View style={styles.statIconBox}>
                <Ionicons name="star-outline" size={18} color={theme.colors.warning} />
              </View>
              <Text size="2xl" weight="bold">
                4.8
              </Text>
              <Text size="xs" color="secondary" tx="homeScreen:statRating" />
            </PressableCard>
          </View>

          {/* Quick Actions */}
          <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 3.5).springify()}>
            <Text size="xl" weight="bold" style={styles.sectionTitle} tx="homeScreen:explore" />
          </Animated.View>

          <PressableCard
            style={styles.actionCard}
            onPress={handleNavigateToComponents}
            delay={ANIMATION.STAGGER_DELAY * 4}
          >
            <View style={styles.actionContent}>
              <View style={styles.actionTitleRow}>
                <View
                  style={[styles.iconBox, { backgroundColor: theme.colors.palette.primary100 }]}
                >
                  <Ionicons name="cube-outline" size={24} color={theme.colors.palette.primary600} />
                </View>
                <Text weight="semiBold" style={styles.actionTitle} tx="homeScreen:uiComponents" />
              </View>
              <Text
                size="sm"
                color="secondary"
                style={styles.actionDescription}
                tx="homeScreen:uiComponentsDescription"
              />
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.foregroundTertiary} />
          </PressableCard>

          <PressableCard
            style={styles.actionCard}
            onPress={() => navigation.navigate("Profile")}
            delay={ANIMATION.STAGGER_DELAY * 4.5}
          >
            <View style={styles.actionContent}>
              <View style={styles.actionTitleRow}>
                <View
                  style={[styles.iconBox, { backgroundColor: theme.colors.palette.secondary100 }]}
                >
                  <Ionicons
                    name="person-outline"
                    size={24}
                    color={theme.colors.palette.secondary600}
                  />
                </View>
                <Text weight="semiBold" style={styles.actionTitle} tx="homeScreen:myProfile" />
              </View>
              <Text
                size="sm"
                color="secondary"
                style={styles.actionDescription}
                tx="homeScreen:myProfileDescription"
              />
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.foregroundTertiary} />
          </PressableCard>

          <PressableCard
            style={styles.actionCard}
            onPress={() => navigation.navigate("Paywall")}
            delay={ANIMATION.STAGGER_DELAY * 5}
          >
            <View style={styles.actionContent}>
              <View style={styles.actionTitleRow}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.palette.accent100 }]}>
                  <Ionicons name="star-outline" size={24} color={theme.colors.palette.accent600} />
                </View>
                <Text
                  weight="semiBold"
                  style={styles.actionTitle}
                  tx="homeScreen:premiumFeatures"
                />
              </View>
              <Text
                size="sm"
                color="secondary"
                style={styles.actionDescription}
                tx="homeScreen:premiumFeaturesDescription"
              />
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.foregroundTertiary} />
          </PressableCard>
        </ScrollView>
      </LinearGradient>
    </View>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    // Web needs explicit height
    ...(isWeb && {
      minHeight: webDimension("100vh"),
    }),
  },
  gradient: {
    flex: 1,
    // Web needs explicit height
    ...(isWeb && {
      minHeight: webDimension("100vh"),
    }),
  },
  scrollView: {
    flex: 1,
    // Enable mouse wheel scrolling on web
    ...(isWeb && {
      overflowY: "auto" as unknown as "scroll",
    }),
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  headerText: {
    gap: 2,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.sm,
  },
  featuredCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius["3xl"],
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.xl,
  },
  featuredContent: {
    gap: theme.spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  featuredIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.palette.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredTitle: {
    flex: 1,
    lineHeight: theme.typography.lineHeights["2xl"],
    letterSpacing: -0.5,
  },
  featuredSubtitle: {
    marginBottom: theme.spacing.sm,
    lineHeight: theme.typography.lineHeights.base,
  },
  startButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.foreground,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
    minHeight: theme.sizes.button.md,
    ...theme.shadows.sm,
  },
  startButtonText: {
    color: theme.colors.card,
    fontSize: theme.typography.sizes.base,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  statCardContainer: {
    flex: 1,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.xl,
    alignItems: "center",
    gap: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xxs,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  actionContent: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  actionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  actionTitle: {
    flex: 1,
  },
  actionDescription: {
    marginLeft: 0,
  },
}))
