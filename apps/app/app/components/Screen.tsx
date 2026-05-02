import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type {
  KeyboardAvoidingViewProps,
  LayoutChangeEvent,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
} from "react-native"
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from "react-native"
import { useScrollToTop } from "@react-navigation/native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useUnistyles } from "react-native-unistyles"

import { ExtendedEdge, useSafeAreaInsetsStyle } from "@/utils/useSafeAreaInsetsStyle"

export const DEFAULT_BOTTOM_OFFSET = 50

/**
 * Safe-area padding applied when `safeAreaEdges` is omitted.
 * Excludes `top` so stack screens with a custom `Header` (which defaults to top inset)
 * are not double-padded. Tab roots and other headerless layouts should pass
 * `safeAreaEdges={["top", "bottom"]}` (or include `"top"` as needed).
 */
export const DEFAULT_SCREEN_SAFE_AREA_EDGES: ExtendedEdge[] = ["bottom"]

interface BaseScreenProps {
  /**
   * Children components.
   */
  children?: ReactNode
  /**
   * Style for the outer content container useful for padding & margin.
   */
  style?: StyleProp<ViewStyle>
  /**
   * Style for the inner content container useful for padding & margin.
   */
  contentContainerStyle?: StyleProp<ViewStyle>
  /**
   * Safe-area edges to pad on the outer container. Defaults to {@link DEFAULT_SCREEN_SAFE_AREA_EDGES}
   * (`["bottom"]` only) so the top inset is not stacked with navigators / {@link Header}.
   * Pass `["top", "bottom"]` for tab roots or any screen without a top-aware header.
   * Pass `[]` for full-bleed (you handle insets yourself).
   */
  safeAreaEdges?: ExtendedEdge[]
  /**
   * Background color
   */
  backgroundColor?: string
  /**
   * By how much should we offset the keyboard? Defaults to 0.
   */
  keyboardOffset?: number
  /**
   * By how much we scroll up when the keyboard is shown. Defaults to 50.
   */
  keyboardBottomOffset?: number
  /**
   * Pass any additional props directly to the KeyboardAvoidingView component.
   */
  KeyboardAvoidingViewProps?: KeyboardAvoidingViewProps
}

interface FixedScreenProps extends BaseScreenProps {
  preset?: "fixed"
}
interface ScrollScreenProps extends BaseScreenProps {
  preset?: "scroll"
  /**
   * Should keyboard persist on screen tap. Defaults to handled.
   * Only applies to scroll preset.
   */
  keyboardShouldPersistTaps?: "handled" | "always" | "never"
  /**
   * Pass any additional props directly to the ScrollView component.
   */
  ScrollViewProps?: ScrollViewProps
  /**
   * Enable pull-to-refresh functionality.
   * Only applies to scroll and auto presets.
   */
  refreshing?: boolean
  /**
   * Callback when pull-to-refresh is triggered.
   * Only applies to scroll and auto presets.
   */
  onRefresh?: () => void
}

interface AutoScreenProps extends Omit<ScrollScreenProps, "preset"> {
  preset?: "auto"
  /**
   * Threshold to trigger the automatic disabling/enabling of scroll ability.
   * Defaults to `{ percent: 0.92 }`.
   */
  scrollEnabledToggleThreshold?: { percent?: number; point?: number }
}

export type ScreenProps = ScrollScreenProps | FixedScreenProps | AutoScreenProps

const isIos = Platform.OS === "ios"
const isWeb = Platform.OS === "web"

type ScreenPreset = "fixed" | "scroll" | "auto"

/**
 * @param {ScreenPreset?} preset - The preset to check.
 * @returns {boolean} - Whether the preset is non-scrolling.
 */
function isNonScrolling(preset?: ScreenPreset) {
  return !preset || preset === "fixed"
}

/**
 * Custom hook that handles the automatic enabling/disabling of scroll ability based on the content size and screen size.
 * @param {UseAutoPresetProps} props - The props for the `useAutoPreset` hook.
 * @returns {{boolean, Function, Function}} - The scroll state, and the `onContentSizeChange` and `onLayout` functions.
 */
function useAutoPreset(props: AutoScreenProps): {
  scrollEnabled: boolean
  onContentSizeChange: (w: number, h: number) => void
  onLayout: (e: LayoutChangeEvent) => void
} {
  const { preset, scrollEnabledToggleThreshold } = props
  const { percent = 0.92, point = 0 } = scrollEnabledToggleThreshold || {}

  const scrollViewHeight = useRef<null | number>(null)
  const scrollViewContentHeight = useRef<null | number>(null)
  const [scrollEnabled, setScrollEnabled] = useState(true)

  const updateScrollState = useCallback(() => {
    if (scrollViewHeight.current === null || scrollViewContentHeight.current === null) return

    // check whether content fits the screen then toggle scroll state according to it
    const contentFitsScreen = (function () {
      if (point) {
        return scrollViewContentHeight.current < scrollViewHeight.current - point
      } else {
        return scrollViewContentHeight.current < scrollViewHeight.current * percent
      }
    })()

    const shouldScrollBeEnabled = !contentFitsScreen
    setScrollEnabled((currentState) =>
      currentState === shouldScrollBeEnabled ? currentState : shouldScrollBeEnabled,
    )
  }, [percent, point])

  /**
   * @param {number} w - The width of the content.
   * @param {number} h - The height of the content.
   */
  function onContentSizeChange(w: number, h: number) {
    // update scroll-view content height
    scrollViewContentHeight.current = h
    updateScrollState()
  }

  /**
   * @param {LayoutChangeEvent} e = The layout change event.
   */
  function onLayout(e: LayoutChangeEvent) {
    const { height } = e.nativeEvent.layout
    // update scroll-view  height
    scrollViewHeight.current = height
    updateScrollState()
  }

  useEffect(() => {
    if (preset === "auto") {
      updateScrollState()
    }
  }, [preset, updateScrollState])

  return {
    scrollEnabled: preset === "auto" ? scrollEnabled : true,
    onContentSizeChange,
    onLayout,
  }
}

/**
 * @param {ScreenProps} props - The props for the `ScreenWithoutScrolling` component.
 * @returns {JSX.Element} - The rendered `ScreenWithoutScrolling` component.
 */
function ScreenWithoutScrolling(props: ScreenProps) {
  const { style, contentContainerStyle, children, preset } = props
  return (
    <View style={[$outerStyle, style]}>
      <View style={[$innerStyle, preset === "fixed" && $justifyFlexEnd, contentContainerStyle]}>
        {children}
      </View>
    </View>
  )
}

/**
 * @param {ScreenProps} props - The props for the `ScreenWithScrolling` component.
 * @returns {JSX.Element} - The rendered `ScreenWithScrolling` component.
 */
function ScreenWithScrolling(props: ScreenProps) {
  const {
    children,
    keyboardShouldPersistTaps = "handled",
    keyboardBottomOffset = DEFAULT_BOTTOM_OFFSET,
    contentContainerStyle,
    ScrollViewProps,
    style,
    refreshing,
    onRefresh,
  } = props as ScrollScreenProps

  const { theme } = useUnistyles()
  const ref = useRef<ScrollView>(null)

  const { scrollEnabled, onContentSizeChange, onLayout } = useAutoPreset(props as AutoScreenProps)

  // Add native behavior of pressing the active tab to scroll to the top of the content
  // More info at: https://reactnavigation.org/docs/use-scroll-to-top/
  useScrollToTop(ref)

  // Web needs explicit overflow styles and height for scrolling
  const webScrollStyle = isWeb
    ? ({
        overflowY: "auto" as unknown as "scroll",
        height: "100%" as unknown as number,
      } as ViewStyle)
    : {}

  // Create refresh control if onRefresh is provided
  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing ?? false}
      onRefresh={onRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.background}
    />
  ) : undefined

  return (
    <KeyboardAwareScrollView
      bottomOffset={keyboardBottomOffset}
      {...{ keyboardShouldPersistTaps, scrollEnabled, ref }}
      {...ScrollViewProps}
      refreshControl={refreshControl}
      onLayout={(e) => {
        onLayout(e)
        ScrollViewProps?.onLayout?.(e)
      }}
      onContentSizeChange={(w: number, h: number) => {
        onContentSizeChange(w, h)
        ScrollViewProps?.onContentSizeChange?.(w, h)
      }}
      style={[$outerStyle, webScrollStyle, ScrollViewProps?.style, style]}
      contentContainerStyle={[
        $innerStyle,
        ScrollViewProps?.contentContainerStyle,
        contentContainerStyle,
      ]}
    >
      {children}
    </KeyboardAwareScrollView>
  )
}

/**
 * Represents a screen component that provides a consistent layout and behavior for different screen presets.
 * The `Screen` component can be used with different presets such as "fixed", "scroll", or "auto".
 * It handles safe area insets, keyboard avoiding behavior, and scrollability based on the preset.
 *
 * **Safe area:** When `safeAreaEdges` is omitted, only the bottom inset is applied by default
 * (see {@link DEFAULT_SCREEN_SAFE_AREA_EDGES}). Screens that use `Header` get top inset from
 * the header; omit top on `Screen` to avoid doubling. Screens without that header should set
 * `safeAreaEdges` to include `"top"` explicitly.
 * @param {ScreenProps} props - The props for the `Screen` component.
 * @returns {JSX.Element} The rendered `Screen` component.
 */
export function Screen(props: ScreenProps) {
  const { theme } = useUnistyles()
  const { backgroundColor, KeyboardAvoidingViewProps, keyboardOffset = 0, safeAreaEdges } = props

  const resolvedSafeAreaEdges = safeAreaEdges ?? DEFAULT_SCREEN_SAFE_AREA_EDGES
  const $containerInsets = useSafeAreaInsetsStyle(resolvedSafeAreaEdges)

  return (
    <View
      style={[
        $containerStyle,
        { backgroundColor: backgroundColor || theme.colors.background },
        $containerInsets,
      ]}
    >
      <KeyboardAvoidingView
        behavior={isIos ? "padding" : "height"}
        keyboardVerticalOffset={keyboardOffset}
        {...KeyboardAvoidingViewProps}
        style={[$flex1, KeyboardAvoidingViewProps?.style]}
      >
        {isNonScrolling(props.preset) ? (
          <ScreenWithoutScrolling {...props} />
        ) : (
          <ScreenWithScrolling {...props} />
        )}
      </KeyboardAvoidingView>
    </View>
  )
}

const $containerStyle: ViewStyle = {
  flex: 1,
  height: "100%",
  width: "100%",
}

const $outerStyle: ViewStyle = {
  flex: 1,
  height: "100%",
  width: "100%",
  // Web needs explicit min-height for proper scrolling
  ...(isWeb && {
    minHeight: "100vh" as unknown as number,
  }),
}

const $justifyFlexEnd: ViewStyle = {
  justifyContent: "flex-end",
}

const $innerStyle: ViewStyle = {
  justifyContent: "flex-start",
  alignItems: "stretch",
}

const $flex1: ViewStyle = {
  flex: 1,
}
