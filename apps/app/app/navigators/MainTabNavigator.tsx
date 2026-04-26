import { useEffect } from "react"
import type { ViewStyle, TextStyle } from "react-native"
import { View, Pressable, Platform, useWindowDimensions } from "react-native"
import { BlurView } from "expo-blur"
import { Ionicons } from "@expo/vector-icons"
import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs"
import { useTranslation } from "react-i18next"
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolate,
  interpolateColor,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StyleSheet, useUnistyles, UnistylesRuntime } from "react-native-unistyles"

import { ComponentShowcaseScreen } from "@/screens/ComponentShowcaseScreen"
import { PaywallScreen } from "@/screens/PaywallScreen"
import { ProfileScreen } from "@/screens/ProfileScreen"
import { SkuListScreen } from "@/screens/SkuListScreen"
import { designTokens } from "@/theme/designTokens"
import { haptics } from "@/utils/haptics"

import type { MainTabParamList } from "./navigationTypes"

const Tab = createBottomTabNavigator<MainTabParamList>()

// Breakpoint for showing sidebar vs bottom tabs
const DESKTOP_BREAKPOINT = 768

// Tab configuration with icons and labels
const TAB_CONFIG: Record<
  keyof MainTabParamList,
  {
    icon: keyof typeof Ionicons.glyphMap
    iconOutline: keyof typeof Ionicons.glyphMap
    labelTx: string
  }
> = {
  Home: { icon: "home", iconOutline: "home-outline", labelTx: "tabs:home" },
  Components: { icon: "cube", iconOutline: "cube-outline", labelTx: "tabs:components" },
  Paywall: { icon: "diamond", iconOutline: "diamond-outline", labelTx: "tabs:pro" },
  Profile: { icon: "person", iconOutline: "person-outline", labelTx: "tabs:profile" },
}

// Spring config for snappy animations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 180,
  mass: 0.8,
}

// =============================================================================
// ANIMATED TAB ITEM (for bottom bar)
// =============================================================================

function TabItem({
  routeName,
  isFocused,
  onPress,
  onLongPress,
  activeColor,
  inactiveColor,
  activeBackgroundColor,
}: {
  routeName: keyof MainTabParamList
  isFocused: boolean
  onPress: () => void
  onLongPress: () => void
  activeColor: string
  inactiveColor: string
  activeBackgroundColor: string
}) {
  const config = TAB_CONFIG[routeName]
  const { t } = useTranslation()
  const label = t(config.labelTx)

  // Animation values
  const focusAnim = useSharedValue(isFocused ? 1 : 0)
  const scaleAnim = useSharedValue(1)

  useEffect(() => {
    focusAnim.value = withSpring(isFocused ? 1 : 0, SPRING_CONFIG)
  }, [isFocused, focusAnim])

  // Animated styles for the container
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      focusAnim.value,
      [0, 1],
      ["transparent", activeBackgroundColor],
    )

    return {
      backgroundColor,
      transform: [{ scale: scaleAnim.value }],
    }
  })

  // Animated styles for label
  const labelAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: focusAnim.value,
      maxWidth: interpolate(focusAnim.value, [0, 1], [0, 80]),
      marginLeft: interpolate(focusAnim.value, [0, 1], [0, 8]),
    }
  })

  // Animated icon style
  const iconAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(focusAnim.value, [0, 0.5, 1], [1, 1.12, 1]) }],
    }
  })

  const handlePressIn = () => {
    scaleAnim.value = withSpring(0.9, { damping: 15, stiffness: 400 })
  }

  const handlePressOut = () => {
    scaleAnim.value = withSpring(1, { damping: 15, stiffness: 400 })
  }

  const handlePress = () => {
    haptics.tabPress()
    onPress()
  }

  const $pressableStyle: ViewStyle = {
    alignItems: "center",
    justifyContent: "center",
  }
  const $tabContainerStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    minHeight: 48,
  }
  const $labelContainerStyle: ViewStyle = {
    overflow: "hidden",
  }
  const $labelTextStyle: TextStyle = {
    fontSize: 14,
    fontWeight: "600",
    color: activeColor,
    letterSpacing: -0.3,
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={$pressableStyle}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      <Animated.View style={[$tabContainerStyle, containerAnimatedStyle]}>
        <Animated.View style={iconAnimatedStyle}>
          <Ionicons
            name={isFocused ? config.icon : config.iconOutline}
            size={24}
            color={isFocused ? activeColor : inactiveColor}
          />
        </Animated.View>

        <Animated.View style={[$labelContainerStyle, labelAnimatedStyle]}>
          <Animated.Text numberOfLines={1} style={$labelTextStyle}>
            {label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}

// =============================================================================
// SIDEBAR ITEM (for desktop web)
// =============================================================================

function SidebarItem({
  routeName,
  isFocused,
  onPress,
}: {
  routeName: keyof MainTabParamList
  isFocused: boolean
  onPress: () => void
}) {
  const config = TAB_CONFIG[routeName]
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const label = t(config.labelTx)

  // Animation values
  const scaleAnim = useSharedValue(1)

  const handlePressIn = () => {
    scaleAnim.value = withSpring(0.96, { damping: 15, stiffness: 400 })
  }

  const handlePressOut = () => {
    scaleAnim.value = withSpring(1, { damping: 15, stiffness: 400 })
  }

  const handlePress = () => {
    haptics.tabPress()
    onPress()
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }))

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={[styles.sidebarItem, isFocused && styles.sidebarItemActive, animatedStyle]}
      >
        <Ionicons
          name={isFocused ? config.icon : config.iconOutline}
          size={22}
          color={isFocused ? theme.colors.primary : theme.colors.foregroundSecondary}
        />
        <Animated.Text style={[styles.sidebarLabel, isFocused && styles.sidebarLabelActive]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  )
}

// =============================================================================
// DESKTOP SIDEBAR
// =============================================================================

function DesktopSidebar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useUnistyles()
  const { top } = useSafeAreaInsets()

  return (
    <View style={[styles.sidebar, { paddingTop: top + 24 }]}>
      {/* Logo / Brand */}
      <View style={styles.sidebarHeader}>
        <View style={styles.logoContainer}>
          <Ionicons name="rocket" size={28} color={theme.colors.primary} />
        </View>
        <Animated.Text style={styles.brandText}>Shipnative</Animated.Text>
      </View>

      {/* Navigation Items */}
      <View style={styles.sidebarNav}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            })

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params)
            }
          }

          return (
            <SidebarItem
              key={route.key}
              routeName={route.name as keyof MainTabParamList}
              isFocused={isFocused}
              onPress={onPress}
            />
          )
        })}
      </View>

      {/* Footer */}
      <View style={styles.sidebarFooter}>
        <Animated.Text style={styles.versionText}>v1.0.0</Animated.Text>
      </View>
    </View>
  )
}

// =============================================================================
// MOBILE TAB BAR
// =============================================================================

function MobileTabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets()
  const { theme } = useUnistyles()
  const isDark = UnistylesRuntime.themeName === "dark"

  // Invert nav background for contrast: dark pill on light theme, light pill on dark theme
  const navBackground = theme.colors.palette.neutral900
  const activeColor = isDark
    ? theme.colors.palette.primary300
    : theme.colors.palette.primary300 || designTokens.colors.primary
  const inactiveColor = isDark ? theme.colors.palette.neutral400 : "rgba(255, 255, 255, 0.65)"
  const activeBackgroundColor = isDark ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.14)"
  const borderColor = isDark ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.2)"
  const containerStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: borderColor,
    gap: 2,
    overflow: "hidden" as const,
    // Use Unistyles theme shadow as base, with custom adjustments for tab bar
    ...theme.shadows.xl,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.select({
      web: isDark ? 0.12 : 0.2,
      default: isDark ? 0.2 : 0.35,
    }),
    shadowRadius: 18,
    elevation: 16,
  }

  const $tabBarContainer: ViewStyle = {
    position: "absolute",
    bottom: Math.max(bottom, 20) + 8,
    left: 16,
    right: 16,
    alignItems: "center",
  }

  return (
    <View style={$tabBarContainer}>
      {false && Platform.OS === "ios" ? (
        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={containerStyle}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              })

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params)
              }
            }

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              })
            }

            return (
              <TabItem
                key={route.key}
                routeName={route.name as keyof MainTabParamList}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                activeBackgroundColor={activeBackgroundColor}
              />
            )
          })}
        </BlurView>
      ) : (
        <View
          style={[
            containerStyle,
            {
              backgroundColor: navBackground,
            },
          ]}
        >
          {state.routes.map((route, index) => {
            const isFocused = state.index === index

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              })

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params)
              }
            }

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              })
            }

            return (
              <TabItem
                key={route.key}
                routeName={route.name as keyof MainTabParamList}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                activeBackgroundColor={activeBackgroundColor}
              />
            )
          })}
        </View>
      )}
    </View>
  )
}

// =============================================================================
// RESPONSIVE TAB BAR (switches between desktop sidebar and mobile tabs)
// =============================================================================

function ResponsiveTabBar(props: BottomTabBarProps) {
  const { width } = useWindowDimensions()
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT

  // Safety check - only render if props are valid
  if (!props || !props.state || !props.navigation) {
    return null
  }

  // For desktop, sidebar is rendered as a flex sibling, not inside tab bar
  // We return null here and render the sidebar separately
  if (isDesktop) {
    return <DesktopSidebar {...props} />
  }

  return <MobileTabBar {...props} />
}

// =============================================================================
// MAIN NAVIGATOR
// =============================================================================

/**
 * MainTabNavigator - Responsive Navigation
 *
 * Features:
 * - Desktop (web): Sidebar navigation on the left
 * - Mobile/Tablet: Floating pill-shaped bottom tab bar
 * - Animated tab transitions with expanding labels
 * - Press feedback with spring animations
 * - Haptic feedback on tab press
 * - Accessible (proper roles and labels)
 * - Automatic dark mode support via theme system
 */
export function MainTabNavigator() {
  const { width } = useWindowDimensions()
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT

  // For desktop: fixed sidebar on left, content with left margin
  // For mobile: floating bottom tab bar

  return (
    <View style={[styles.navigatorContainer, isDesktop && styles.navigatorContainerDesktop]}>
      <View style={[styles.screenContainer, isDesktop && styles.screenContainerDesktop]}>
        <Tab.Navigator
          tabBar={(props) => <ResponsiveTabBar {...props} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tab.Screen name="Home" component={SkuListScreen} />
          <Tab.Screen name="Components" component={ComponentShowcaseScreen} />
          <Tab.Screen name="Paywall" component={PaywallScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </View>
    </View>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  navigatorContainer: {
    flex: 1,
    // Web needs explicit height and overflow for scrolling
    ...(Platform.OS === "web" && {
      height: "100vh" as unknown as number,
      width: "100vw" as unknown as number,
      overflow: "hidden" as unknown as "visible",
    }),
  },
  navigatorContainerDesktop: {
    flexDirection: "row",
  },
  screenContainer: {
    flex: 1,
    // Web needs overflow auto to allow inner screens to scroll
    ...(Platform.OS === "web" && {
      height: "100%" as unknown as number,
      overflow: "auto" as unknown as "visible",
    }),
  },
  screenContainerDesktop: {
    // Account for fixed sidebar width
    marginLeft: 240,
  },
  sidebarPlaceholder: {
    width: 240,
  },

  // Sidebar styles - NOT position absolute, it's a flex child
  sidebar: {
    width: 240,
    backgroundColor: theme.colors.card,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    // Web explicit height
    ...(Platform.OS === "web" && {
      height: "100vh" as unknown as number,
      position: "fixed" as unknown as "absolute",
      left: 0,
      top: 0,
      zIndex: 100,
    }),
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing["2xl"],
    paddingHorizontal: theme.spacing.sm,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: theme.typography.sizes.xl,
    fontFamily: theme.typography.fonts.bold,
    color: theme.colors.foreground,
  },
  sidebarNav: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  sidebarItemActive: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  sidebarLabel: {
    fontSize: theme.typography.sizes.base,
    fontFamily: theme.typography.fonts.medium,
    color: theme.colors.foregroundSecondary,
  },
  sidebarLabelActive: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.semiBold,
  },
  sidebarFooter: {
    paddingVertical: theme.spacing.lg,
    alignItems: "center",
  },
  versionText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.foregroundTertiary,
  },
}))
