import type { ComponentType, ReactNode } from "react"
import { Children, useMemo } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { ActivityIndicator, View } from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import Animated from "react-native-reanimated"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { usePressableGesture } from "@/hooks/usePressableGesture"

import { Text, TextProps } from "./Text"

// =============================================================================
// TYPES
// =============================================================================

type Variants = "filled" | "outlined" | "ghost" | "secondary" | "danger"
type Sizes = "sm" | "md" | "lg"

export interface ButtonAccessoryProps {
  variant: Variants
  size: Sizes
  disabled: boolean
  pressed: boolean
  style?: ViewStyle
}

export interface ButtonProps {
  /**
   * Button text
   */
  text?: string
  /**
   * i18n translation key
   */
  tx?: TextProps["tx"]
  /**
   * i18n translation options
   */
  txOptions?: TextProps["txOptions"]
  /**
   * Button variant style
   */
  variant?: Variants
  /**
   * Button size
   */
  size?: Sizes
  /**
   * Show loading spinner
   */
  loading?: boolean
  /**
   * Button children (alternative to text)
   */
  children?: ReactNode
  /**
   * Left side accessory component
   */
  LeftAccessory?: ComponentType<ButtonAccessoryProps>
  /**
   * Right side accessory component
   */
  RightAccessory?: ComponentType<ButtonAccessoryProps>
  /**
   * Additional text props
   */
  TextProps?: Omit<TextProps, "text" | "tx" | "txOptions">
  /**
   * Press handler
   */
  onPress?: () => void
  /**
   * Long press handler
   */
  onLongPress?: () => void
  /**
   * Disabled state
   */
  disabled?: boolean
  /**
   * Enable haptic feedback (default: true)
   */
  haptic?: boolean
  /**
   * Make button take full container width
   */
  fullWidth?: boolean
  /**
   * Additional style
   */
  style?: StyleProp<ViewStyle>
  /**
   * Accessibility label
   */
  accessibilityLabel?: string
  /**
   * Test ID for testing
   */
  testID?: string
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * A customizable button component with multiple variants and sizes.
 * Includes haptic feedback and smooth microanimations.
 *
 * @example
 * // Basic filled button
 * <Button text="Press Me" onPress={() => {}} />
 *
 * // Outlined button
 * <Button text="Outlined" variant="outlined" />
 *
 * // Button with icon
 * <Button
 *   text="With Icon"
 *   LeftAccessory={({ variant }) => <Icon name="star" />}
 * />
 *
 * // Loading state
 * <Button text="Loading" loading />
 *
 * // Different sizes
 * <Button text="Small" size="sm" />
 * <Button text="Large" size="lg" />
 *
 * // Full width button
 * <Button text="Continue" fullWidth />
 */
export function Button(props: ButtonProps) {
  const {
    text,
    tx,
    txOptions,
    variant = "filled",
    size = "md",
    loading = false,
    disabled,
    children,
    LeftAccessory,
    RightAccessory,
    TextProps,
    onPress,
    onLongPress,
    haptic = true,
    fullWidth = false,
    style,
    accessibilityLabel,
    testID,
  } = props

  const { theme } = useUnistyles()
  const isDisabled = disabled || loading

  // Apply variants to styles
  styles.useVariants({ variant, size })

  const textColor = useMemo(() => {
    switch (variant) {
      case "filled":
      case "danger":
        return theme.colors.primaryForeground
      case "outlined":
      case "ghost":
        return theme.colors.foreground
      case "secondary":
        return theme.colors.foreground
    }
  }, [variant, theme])

  const spinnerColor = textColor

  const accessoryProps: ButtonAccessoryProps = {
    variant,
    size,
    disabled: isDisabled,
    pressed: false,
  }

  // Use shared pressable gesture hook
  const { gesture, animatedStyle } = usePressableGesture({
    onPress,
    onLongPress,
    disabled: isDisabled,
    haptic,
    hapticType: "buttonPress",
    pressScale: 0.96,
    longPressScale: 0.94,
    animateOpacity: true,
  })

  const renderLabel = useMemo(() => {
    if (children !== null && children !== undefined) {
      const childArray = Children.toArray(children)
      const allTextChildren = childArray.every(
        (child) => typeof child === "string" || typeof child === "number",
      )

      if (allTextChildren) {
        return (
          <Text weight="semiBold" {...TextProps} style={[{ color: textColor }, TextProps?.style]}>
            {childArray.join("")}
          </Text>
        )
      }

      return children
    }

    return (
      <Text
        text={text}
        tx={tx}
        txOptions={txOptions}
        weight="semiBold"
        {...TextProps}
        style={[{ color: textColor }, TextProps?.style]}
      />
    )
  }, [TextProps, children, text, textColor, tx, txOptions])

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.container,
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
          animatedStyle,
          style,
        ]}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: isDisabled }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColor} style={styles.spinner} />
        ) : (
          <>
            {LeftAccessory && (
              <View style={styles.leftAccessory}>
                <LeftAccessory {...accessoryProps} pressed={false} />
              </View>
            )}

            {renderLabel}

            {RightAccessory && (
              <View style={styles.rightAccessory}>
                <RightAccessory {...accessoryProps} pressed={false} />
              </View>
            )}
          </>
        )}
      </Animated.View>
    </GestureDetector>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    variants: {
      variant: {
        filled: {
          backgroundColor: theme.colors.primary,
          // Subtle inner shadow effect via border
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.1)",
          ...theme.shadows.md,
        },
        outlined: {
          backgroundColor: theme.colors.transparent,
          borderWidth: 1.5,
          borderColor: theme.colors.borderSecondary,
        },
        ghost: {
          backgroundColor: theme.colors.transparent,
        },
        secondary: {
          backgroundColor: theme.colors.secondary,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        danger: {
          // Explicit destructive red (not theme.colors.error — dark theme uses a lighter token)
          backgroundColor: "#EF4444",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.15)",
          ...theme.shadows.md,
        },
      },
      size: {
        sm: {
          height: theme.sizes.button.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.lg,
          gap: theme.spacing.xs,
        },
        md: {
          height: theme.sizes.button.md,
          paddingHorizontal: theme.spacing.xl,
          borderRadius: theme.radius.xl,
          gap: theme.spacing.sm,
        },
        lg: {
          height: theme.sizes.button.lg,
          paddingHorizontal: theme.spacing["2xl"],
          borderRadius: theme.radius.xl,
          gap: theme.spacing.sm,
        },
      },
    },
  },
  disabled: {
    opacity: 0.4,
  },
  fullWidth: {
    width: "100%",
  },
  spinner: {
    marginRight: 0,
  },
  leftAccessory: {
    marginRight: theme.spacing.xs,
  },
  rightAccessory: {
    marginLeft: theme.spacing.xs,
  },
}))
