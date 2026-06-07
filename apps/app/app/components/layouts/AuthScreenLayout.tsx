/**
 * AuthScreenLayout - Consistent layout for authentication screens
 *
 * Use this layout for:
 * - Login, Register, ForgotPassword screens
 * - Welcome/Get Started screens
 * - Any authentication-related modal-style screens
 *
 * Features:
 * - Gradient background (theme-aware for dark mode)
 * - Modal card that slides up from bottom (mobile) or centered (web/tablet)
 * - Consistent spacing, typography, and styling
 * - Keyboard avoiding behavior
 * - Safe area handling
 *
 * @example
 * ```tsx
 * <AuthScreenLayout
 *   title="Welcome Back"
 *   subtitle="Sign in to continue"
 *   showCloseButton
 *   onClose={() => navigation.goBack()}
 * >
 *   <TextField label="Email" />
 *   <Button title="Sign In" />
 * </AuthScreenLayout>
 * ```
 */

import type { ReactNode } from "react"
import { Children } from "react"
import type { ViewStyle } from "react-native"
import {
  View,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import type { TOptions } from "i18next"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { TxKeyPath } from "@/i18n"

import { ScrollView } from "../ScrollView"
import { Text } from "../Text"

// =============================================================================
// TYPES
// =============================================================================

export interface AuthScreenLayoutProps {
  /** Main heading text */
  title?: string
  /** i18n translation key for title */
  titleTx?: TxKeyPath
  /** i18n translation options for title */
  titleTxOptions?: TOptions
  /** Subtitle/description below the title */
  subtitle?: string
  /** i18n translation key for subtitle */
  subtitleTx?: TxKeyPath
  /** i18n translation options for subtitle */
  subtitleTxOptions?: TOptions
  /** Screen content (form fields, buttons, etc.) */
  children: ReactNode
  /** Show close/back button in top right */
  showCloseButton?: boolean
  /** Handler for close button */
  onClose?: () => void
  /** Show back arrow button in top left */
  showBackButton?: boolean
  /** Handler for back button */
  onBack?: () => void
  /** Optional emoji/icon to display above title */
  headerIcon?: string
  /** Whether content should be scrollable (default: true) */
  scrollable?: boolean
  /** Additional style for the card container */
  cardStyle?: ViewStyle
  /** Whether to center content vertically in the card (default: false) */
  centerContent?: boolean
  /**
   * When true, use a solid white background instead of the default gradient (e.g. Get Started).
   */
  plainBackground?: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MODAL_MAX_WIDTH = 480
const BREAKPOINT_TABLET = 768

// =============================================================================
// COMPONENT
// =============================================================================

export const AuthScreenLayout = ({
  title,
  titleTx,
  titleTxOptions,
  subtitle,
  subtitleTx,
  subtitleTxOptions,
  children,
  showCloseButton = false,
  onClose,
  showBackButton = false,
  onBack,
  headerIcon,
  scrollable = true,
  cardStyle,
  centerContent = false,
  plainBackground = false,
}: AuthScreenLayoutProps) => {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  // Web can complain if a View receives a raw string/number child. Normalize children so
  // any stray whitespace or primitive nodes are filtered out before rendering.
  const safeChildren = Children.toArray(children).filter(
    (child) => typeof child !== "string" && typeof child !== "number",
  )

  // Responsive layout
  const isTabletOrLarger = windowWidth >= BREAKPOINT_TABLET
  const isWeb = Platform.OS === "web"
  const isMobile = Platform.OS !== "web"

  // Content wrapper - either ScrollView or View
  const ContentWrapper = scrollable ? ScrollView : View

  const contentWrapperProps = scrollable
    ? {
        style: [styles.scrollArea, isWeb && styles.scrollAreaWeb],
        contentContainerStyle: [
          styles.scrollContent,
          centerContent && styles.centeredContent,
          { paddingBottom: Math.max(insets.bottom, theme.spacing.xl) },
        ],
        keyboardShouldPersistTaps: "handled" as const,
        showsVerticalScrollIndicator: false,
      }
    : {
        style: [
          styles.staticContent,
          centerContent && styles.centeredContent,
          { paddingBottom: Math.max(insets.bottom, theme.spacing.xl) },
        ],
      }

  const keyboardAndCard = (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        styles.keyboardView,
        isWeb && isTabletOrLarger && styles.keyboardViewCentered,
        isMobile && styles.keyboardViewMobile,
      ]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View
        style={[
          styles.modalCard,
          // On mobile, use centered card style like Welcome screen
          !isWeb && styles.modalCardMobile,
          isWeb && isTabletOrLarger && styles.modalCardCentered,
          { paddingBottom: Math.max(insets.bottom, theme.spacing.xl) },
          cardStyle,
        ]}
      >
        {/* Close Button (top right) - positioned outside ScrollView for fixed position */}
        {showCloseButton && onClose && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("authScreenLayout:closeButton")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.closeButtonCircle}>
              <Ionicons name="close" size={20} color={theme.colors.foreground} />
            </View>
          </TouchableOpacity>
        )}

        {/* Back Button (top left) - positioned outside ScrollView for fixed position */}
        {showBackButton && onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("authScreenLayout:backButton")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.backButtonCircle}>
              <Ionicons name="arrow-back" size={20} color={theme.colors.foreground} />
            </View>
          </TouchableOpacity>
        )}

        <ContentWrapper {...contentWrapperProps}>
          {/* Header Icon */}
          {headerIcon && (
            <View style={styles.headerIconContainer}>
              <Text style={styles.headerIcon}>{headerIcon}</Text>
            </View>
          )}

          {/* Title */}
          {(title || titleTx) && (
            <Text
              size="3xl"
              weight="bold"
              style={styles.title}
              text={title}
              tx={titleTx}
              txOptions={titleTxOptions}
            />
          )}

          {/* Subtitle */}
          {(subtitle || subtitleTx) && (
            <Text
              color="secondary"
              style={styles.subtitle}
              text={subtitle}
              tx={subtitleTx}
              txOptions={subtitleTxOptions}
            />
          )}

          {/* Content */}
          <View style={styles.content}>{safeChildren}</View>
        </ContentWrapper>
      </View>
    </KeyboardAvoidingView>
  )

  return (
    <View style={styles.container}>
      {plainBackground ? (
        <View style={[styles.gradient, { backgroundColor: theme.colors.palette.white }]}>
          {keyboardAndCard}
        </View>
      ) : (
        <LinearGradient
          colors={[
            theme.colors.gradientStart,
            theme.colors.gradientMiddle,
            theme.colors.gradientEnd,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {keyboardAndCard}
        </LinearGradient>
      )}
    </View>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    ...(Platform.OS === "web" && {
      minHeight: "100vh" as unknown as number,
      height: "100vh" as unknown as number,
      width: "100%" as unknown as number,
    }),
  },
  gradient: {
    flex: 1,
    ...(Platform.OS === "web" && {
      height: "100vh" as unknown as number,
      width: "100%" as unknown as number,
    }),
  },
  keyboardView: {
    flex: 1,
    justifyContent: Platform.OS === "web" ? "center" : "flex-end",
    // On mobile, position card at bottom
    ...(Platform.OS !== "web" && {
      minHeight: 0,
      paddingBottom: theme.spacing.lg,
    }),
    ...(Platform.OS === "web" && {
      minHeight: "100vh" as unknown as number,
      height: "100vh" as unknown as number,
      width: "100%" as unknown as number,
    }),
  },
  keyboardViewMobile: {
    // Mobile: position card at bottom
    justifyContent: "flex-end",
    paddingTop: theme.spacing["3xl"],
  },
  keyboardViewCentered: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  modalCard: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing["2xl"],
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.colors.border,
    ...theme.shadows.xl,
    width: "100%",
  },
  modalCardMobile: {
    // On mobile, card slides up from bottom with rounded top corners only
    maxWidth: "100%",
    width: "100%",
    // Allow card to grow naturally, but prevent overflow beyond viewport
    maxHeight: "92%",
    // flex: 1 allows the card to expand and give ScrollView a height to work with
    flex: 1,
  },
  modalCardCentered: {
    borderRadius: 36,
    borderWidth: 1,
    borderBottomWidth: 1,
    maxWidth: MODAL_MAX_WIDTH,
    width: "100%",
    // Size to fit content with reasonable limits
    minHeight: 420,
    maxHeight: "85%",
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  staticContent: {
    width: "100%",
  },
  scrollArea: {
    width: "100%",
    // Use flexGrow to allow ScrollView to expand within percentage-based containers
    // flexShrink: 0 ensures the ScrollView doesn't collapse when parent has no fixed height
    flexGrow: 1,
    flexShrink: 0,
  },
  scrollAreaWeb: {
    width: "100%",
    minHeight: 0,
  },
  centeredContent: {
    justifyContent: "center",
  },
  closeButton: {
    position: "absolute",
    right: theme.spacing.md,
    top: theme.spacing.md,
    zIndex: 10,
  },
  closeButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    left: theme.spacing.md,
    top: theme.spacing.md,
    zIndex: 10,
  },
  backButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconContainer: {
    marginBottom: theme.spacing.lg,
    alignItems: "center",
  },
  headerIcon: {
    fontSize: 56,
    lineHeight: 64,
    textAlign: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: theme.spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: theme.spacing["2xl"],
    letterSpacing: 0.1,
  },
  content: {
    // No flex constraint - let content size naturally
  },
}))
