import type { ReactNode } from "react"
import type { ScrollViewProps, ViewStyle } from "react-native"
import { KeyboardAvoidingView, Platform, ScrollView, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StyleSheet } from "react-native-unistyles"

// =============================================================================
// TYPES
// =============================================================================

type Presets = "fixed" | "scroll"
type SafeAreaEdges = "top" | "bottom" | "left" | "right"

export interface ContainerProps {
  /**
   * Container children
   */
  children: ReactNode
  /**
   * Container preset (fixed or scrollable)
   */
  preset?: Presets
  /**
   * Safe area edges to apply padding
   */
  safeAreaEdges?: SafeAreaEdges[]
  /**
   * Enable keyboard avoiding behavior
   */
  keyboardAvoiding?: boolean
  /**
   * Keyboard offset
   */
  keyboardOffset?: number
  /**
   * Additional container style
   */
  style?: ViewStyle
  /**
   * Content container style (for scroll preset)
   */
  contentContainerStyle?: ViewStyle
  /**
   * Additional scroll view props
   */
  ScrollViewProps?: ScrollViewProps
  /**
   * Applied to the inner `ScrollView` (scroll preset) or `View` (fixed preset) that wraps `children`.
   */
  innerStyle?: ViewStyle
  /**
   * Maximum content width (for responsive layouts)
   * Content will be centered if viewport is wider
   */
  maxContentWidth?: number
  /**
   * Whether to center content on large screens (web/tablet)
   */
  centerContent?: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

const isWeb = Platform.OS === "web"

// Default max width for centered content
const DEFAULT_MAX_WIDTH = 768

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Container component for consistent screen layouts with safe area handling.
 * Responsive for web with proper 100vh height and content centering.
 *
 * @example
 * // Fixed container with safe areas
 * <Container safeAreaEdges={["top", "bottom"]}>
 *   <Text>Fixed content</Text>
 * </Container>
 *
 * // Scrollable container
 * <Container preset="scroll">
 *   <Text>Scrollable content...</Text>
 * </Container>
 *
 * // With keyboard avoiding
 * <Container keyboardAvoiding>
 *   <TextField label="Email" />
 * </Container>
 *
 * // Centered content for web
 * <Container centerContent maxContentWidth={600}>
 *   <Text>Centered on large screens</Text>
 * </Container>
 */
export function Container(props: ContainerProps) {
  const {
    children,
    preset = "fixed",
    safeAreaEdges = [],
    keyboardAvoiding = false,
    keyboardOffset = 0,
    style,
    contentContainerStyle,
    ScrollViewProps,
    innerStyle,
    maxContentWidth = DEFAULT_MAX_WIDTH,
    centerContent = false,
  } = props

  const { style: scrollViewStyleFromProps, ...restScrollViewProps } = ScrollViewProps ?? {}

  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()

  // Calculate safe area padding
  const safeAreaStyle: ViewStyle = {
    paddingTop: safeAreaEdges.includes("top") ? insets.top : 0,
    paddingBottom: safeAreaEdges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: safeAreaEdges.includes("left") ? insets.left : 0,
    paddingRight: safeAreaEdges.includes("right") ? insets.right : 0,
  }

  // Calculate responsive styles for web
  const shouldCenter = centerContent && windowWidth > maxContentWidth
  const responsiveStyle: ViewStyle = shouldCenter
    ? {
        maxWidth: maxContentWidth,
        alignSelf: "center" as const,
        width: "100%",
      }
    : {}

  const content =
    preset === "scroll" ? (
      <ScrollView
        style={[styles.scrollView, innerStyle, scrollViewStyleFromProps]}
        contentContainerStyle={[styles.scrollContent, responsiveStyle, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...restScrollViewProps}
      >
        {children}
      </ScrollView>
    ) : (
      <View style={[styles.fixedContent, responsiveStyle, contentContainerStyle, innerStyle]}>
        {children}
      </View>
    )

  const wrappedContent = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardOffset}
      style={styles.keyboardAvoiding}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  )

  return <View style={[styles.container, safeAreaStyle, style]}>{wrappedContent}</View>
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    // Web needs explicit min-height since flex:1 doesn't work without parent height
    ...(isWeb && {
      minHeight: "100vh" as unknown as number,
    }),
  },
  keyboardAvoiding: {
    flex: 1,
  },
  fixedContent: {
    flex: 1,
    flexDirection: "column",
  },
  scrollView: {
    flex: 1,
    // Enable mouse wheel scrolling on web
    ...(isWeb && {
      overflowY: "auto" as unknown as "scroll",
    }),
  },
  scrollContent: {
    flexGrow: 1,
  },
}))
