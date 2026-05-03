import type { ComponentType, Ref } from "react"
import { forwardRef, useImperativeHandle, useRef, useState } from "react"
/* eslint-disable no-restricted-imports -- This is the wrapper component that needs the underlying RN TextInput */
import type { TextInputProps, ViewStyle } from "react-native"
import { Platform, TextInput as RNTextInput, TouchableOpacity, Pressable, View } from "react-native"
/* eslint-enable no-restricted-imports */
import Ionicons from "@expo/vector-icons/Ionicons"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text, TextProps } from "./Text"

// =============================================================================
// TYPES
// =============================================================================

type Sizes = "sm" | "md" | "lg"
type Status = "default" | "error" | "success" | "disabled"

export interface TextFieldAccessoryProps {
  status: Status
  multiline: boolean
  editable: boolean
  style?: ViewStyle
}

export interface TextFieldProps extends Omit<TextInputProps, "ref"> {
  /**
   * Input status
   */
  status?: Status
  /**
   * Input size
   */
  size?: Sizes
  /**
   * Label text
   */
  label?: string
  /**
   * i18n key for label
   */
  labelTx?: TextProps["tx"]
  /**
   * Label translation options
   */
  labelTxOptions?: TextProps["txOptions"]
  /**
   * Helper text (shown below input)
   */
  helper?: string
  /**
   * i18n key for helper
   */
  helperTx?: TextProps["tx"]
  /**
   * Helper translation options
   */
  helperTxOptions?: TextProps["txOptions"]
  /**
   * Placeholder text
   */
  placeholder?: string
  /**
   * i18n key for placeholder
   */
  placeholderTx?: TextProps["tx"]
  /**
   * Placeholder translation options
   */
  placeholderTxOptions?: TextProps["txOptions"]
  /**
   * Container style
   */
  containerStyle?: ViewStyle
  /**
   * Input wrapper style
   */
  inputWrapperStyle?: ViewStyle
  /**
   * Left side accessory component
   */
  LeftAccessory?: ComponentType<TextFieldAccessoryProps>
  /**
   * Right side accessory component
   */
  RightAccessory?: ComponentType<TextFieldAccessoryProps>
  /**
   * Additional label text props
   */
  LabelTextProps?: TextProps
  /**
   * Additional helper text props
   */
  HelperTextProps?: TextProps
  /**
   * Show character count (requires maxLength to be set)
   */
  showCharacterCount?: boolean
  /**
   * Show clear button when input has value
   */
  clearable?: boolean
  /**
   * Callback when clear button is pressed
   */
  onClear?: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * A styled text input component with label and helper text support.
 *
 * @example
 * // Basic input
 * <TextField
 *   label="Email"
 *   placeholder="Enter your email"
 * />
 *
 * // With error state
 * <TextField
 *   label="Password"
 *   status="error"
 *   helper="Password is required"
 * />
 *
 * // With accessory
 * <TextField
 *   label="Search"
 *   LeftAccessory={() => <Icon name="search" />}
 * />
 *
 * // Different sizes
 * <TextField label="Small" size="sm" />
 * <TextField label="Large" size="lg" />
 */
export const TextField = forwardRef(function TextField(
  props: TextFieldProps,
  ref: Ref<RNTextInput>,
) {
  const {
    status = "default",
    size = "md",
    labelTx,
    label,
    labelTxOptions,
    placeholderTx,
    placeholder,
    placeholderTxOptions,
    helper,
    helperTx,
    helperTxOptions,
    LeftAccessory,
    RightAccessory,
    HelperTextProps,
    LabelTextProps,
    style,
    containerStyle,
    inputWrapperStyle,
    multiline,
    editable = true,
    showCharacterCount = false,
    clearable = false,
    onClear,
    maxLength,
    value,
    onChangeText,
    ...textInputProps
  } = props

  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const languageTag = i18n.language?.split("-")[0]
  const isRTL = i18n.dir?.(i18n.language) === "rtl" || languageTag === "ar"
  const inputRef = useRef<RNTextInput>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [internalValue, setInternalValue] = useState(value || "")

  // Track value for character count and clear button
  const isControlled = value !== undefined
  const currentValue = isControlled ? (value ?? "") : internalValue
  const characterCount = currentValue?.length || 0
  const showClearButton = clearable && currentValue && currentValue.length > 0

  const isDisabled = !editable || status === "disabled"
  const currentStatus = isDisabled ? "disabled" : status

  const handleChangeText = (text: string) => {
    if (!isControlled) {
      setInternalValue(text)
    }
    onChangeText?.(text)
  }

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue("")
    }
    onChangeText?.("")
    onClear?.()
    inputRef.current?.focus()
  }

  // Apply variants - map "default" to undefined for Unistyles
  const statusForStyles =
    isFocused && currentStatus === "default"
      ? "focused"
      : currentStatus === "default"
        ? undefined
        : currentStatus
  styles.useVariants({
    size,
    status: statusForStyles,
    multiline: multiline ? "true" : "false",
  })

  const placeholderContent = placeholderTx
    ? t(placeholderTx, placeholderTxOptions as Record<string, string>)
    : placeholder

  function focusInput() {
    if (isDisabled) return
    inputRef.current?.focus()
  }

  useImperativeHandle(ref, () => inputRef.current as RNTextInput)

  const accessoryProps: TextFieldAccessoryProps = {
    status: currentStatus,
    multiline: !!multiline,
    editable: !isDisabled,
  }

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={containerStyle}
      onPress={focusInput}
      accessibilityState={{ disabled: isDisabled }}
      // Web: do not put the wrapper in the tab order; only the inner <input> should be
      // a tab stop (otherwise Tab order vs. sibling controls like pickers is unreliable).
      focusable={Platform.OS === "web" ? false : undefined}
    >
      {/* Label */}
      {!!(label || labelTx) && (
        <Text
          preset="label"
          text={label}
          tx={labelTx}
          txOptions={labelTxOptions}
          style={styles.label}
          {...LabelTextProps}
        />
      )}

      {/* Input wrapper */}
      <View style={[styles.inputWrapper, inputWrapperStyle]}>
        {/* Left accessory */}
        {!!LeftAccessory && (
          <View style={styles.leftAccessory}>
            <LeftAccessory {...accessoryProps} />
          </View>
        )}

        {/* Text input */}
        <RNTextInput
          ref={inputRef}
          underlineColorAndroid="transparent"
          textAlignVertical={multiline ? "top" : "center"}
          placeholder={placeholderContent}
          placeholderTextColor={theme.colors.inputPlaceholder}
          editable={!isDisabled}
          style={[styles.input, isRTL && styles.inputRTL, style]}
          onFocus={(e) => {
            setIsFocused(true)
            textInputProps.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            textInputProps.onBlur?.(e)
          }}
          multiline={multiline}
          maxLength={maxLength}
          value={currentValue}
          onChangeText={handleChangeText}
          {...textInputProps}
        />

        {/* Clear button */}
        {showClearButton && !isDisabled && (
          <Pressable
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Clear input"
            accessibilityRole="button"
          >
            <Ionicons name="close-circle" size={18} color={theme.colors.foregroundTertiary} />
          </Pressable>
        )}

        {/* Right accessory */}
        {!!RightAccessory && (
          <View style={styles.rightAccessory}>
            <RightAccessory {...accessoryProps} />
          </View>
        )}
      </View>

      {/* Footer row: helper text and character count */}
      <View style={styles.footer}>
        {/* Helper text */}
        {!!(helper || helperTx) ? (
          <Text
            size="sm"
            text={helper}
            tx={helperTx}
            txOptions={helperTxOptions}
            color={currentStatus === "error" ? "error" : "secondary"}
            style={styles.helper}
            {...HelperTextProps}
          />
        ) : (
          <View />
        )}

        {/* Character count */}
        {showCharacterCount && maxLength && (
          <Text
            size="xs"
            color={characterCount >= maxLength ? "error" : "tertiary"}
            style={styles.characterCount}
          >
            {characterCount}/{maxLength}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
})

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  label: {
    marginBottom: theme.spacing.sm,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderWidth: 1.5,
    overflow: "hidden",
    variants: {
      size: {
        sm: {
          minHeight: theme.sizes.input.sm,
          borderRadius: theme.radius.lg,
        },
        md: {
          minHeight: theme.sizes.input.md,
          borderRadius: theme.radius.xl,
        },
        lg: {
          minHeight: theme.sizes.input.lg,
          borderRadius: theme.radius.xl,
        },
      },
      status: {
        default: {
          borderColor: theme.colors.border,
        },
        focused: {
          borderColor: theme.colors.inputBorderFocus,
          borderWidth: 2,
          backgroundColor: theme.colors.background,
        },
        error: {
          borderColor: theme.colors.error,
          borderWidth: 2,
          backgroundColor: theme.colors.errorBackground,
        },
        success: {
          borderColor: theme.colors.success,
          borderWidth: 2,
          backgroundColor: theme.colors.successBackground,
        },
        disabled: {
          borderColor: theme.colors.border,
          opacity: 0.5,
          backgroundColor: theme.colors.backgroundSecondary,
        },
      },
      multiline: {
        true: {
          minHeight: 120,
          alignItems: "flex-start",
          paddingVertical: theme.spacing.md,
        },
        false: {},
      },
    },
  },
  input: {
    flex: 1,
    color: theme.colors.inputForeground,
    fontFamily: theme.typography.fonts.regular,
    letterSpacing: 0.2,
    variants: {
      size: {
        sm: {
          fontSize: theme.typography.sizes.sm,
          paddingHorizontal: theme.spacing.md,
        },
        md: {
          fontSize: theme.typography.sizes.base,
          paddingHorizontal: theme.spacing.lg,
        },
        lg: {
          fontSize: theme.typography.sizes.lg,
          paddingHorizontal: theme.spacing.lg,
        },
      },
      status: {
        default: {},
        focused: {},
        error: {},
        success: {},
        disabled: {
          color: theme.colors.foregroundTertiary,
        },
      },
      multiline: {
        true: {
          height: "auto",
          paddingTop: 0,
        },
        false: {},
      },
    },
  },
  leftAccessory: {
    marginLeft: theme.spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  rightAccessory: {
    marginRight: theme.spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  clearButton: {
    marginRight: theme.spacing.sm,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xxs,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: theme.spacing.sm,
  },
  helper: {
    flex: 1,
    marginLeft: theme.spacing.xxs,
  },
  characterCount: {
    marginLeft: theme.spacing.sm,
  },
  inputRTL: {
    textAlign: "right",
  },
}))
