import { type ReactElement, useMemo } from "react"
import type { StyleProp, TextStyle, TouchableOpacityProps, ViewStyle } from "react-native"
import { TouchableOpacity, View } from "react-native"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { ExtendedEdge, useSafeAreaInsetsStyle } from "@/utils/useSafeAreaInsetsStyle"

import { IconTypes, PressableIcon } from "./Icon"
import { Text, TextProps } from "./Text"

export interface HeaderProps {
  /**
   * The layout of the title relative to the action components.
   * - `center` will force the title to always be centered relative to the header. If the title or the action buttons are too long, the title will be cut off.
   * - `flex` will attempt to center the title relative to the action buttons. If the action buttons are different widths, the title will be off-center relative to the header.
   */
  titleMode?: "center" | "flex"
  /**
   * Optional title style override.
   */
  titleStyle?: StyleProp<TextStyle>
  /**
   * Optional outer title container style override.
   */
  titleContainerStyle?: StyleProp<ViewStyle>
  /**
   * Preset typography for main tab titles vs stack (modal) titles.
   * - `tab`: left-aligned, 24 / 700 (Inventory, Profile, Dashboard).
   * - `stack`: centered, 17 / 600 (Add SKU, SKU Detail, Adjust Inventory, Stock Take).
   */
  titleTypography?: "tab" | "stack"
  /**
   * Optional inner header wrapper style override.
   */
  style?: StyleProp<ViewStyle>
  /**
   * Optional outer header container style override.
   */
  containerStyle?: StyleProp<ViewStyle>
  /**
   * Background color
   */
  backgroundColor?: string
  /**
   * Title text to display if not using `tx` or nested components.
   */
  title?: TextProps["text"]
  /**
   * Title text which is looked up via i18n.
   */
  titleTx?: TextProps["tx"]
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  titleTxOptions?: TextProps["txOptions"]
  /**
   * Icon that should appear on the left.
   * Can be used with `onLeftPress`.
   */
  leftIcon?: IconTypes
  /**
   * An optional tint color for the left icon
   */
  leftIconColor?: string
  /**
   * Left action text to display if not using `leftTx`.
   * Can be used with `onLeftPress`. Overrides `leftIcon`.
   */
  leftText?: TextProps["text"]
  /**
   * Left action text text which is looked up via i18n.
   * Can be used with `onLeftPress`. Overrides `leftIcon`.
   */
  leftTx?: TextProps["tx"]
  /**
   * Left action custom ReactElement if the built in action props don't suffice.
   * Overrides `leftIcon`, `leftTx` and `leftText`.
   */
  LeftActionComponent?: ReactElement
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  leftTxOptions?: TextProps["txOptions"]
  /**
   * What happens when you press the left icon or text action.
   */
  onLeftPress?: TouchableOpacityProps["onPress"]
  /**
   * Icon that should appear on the right.
   * Can be used with `onRightPress`.
   */
  rightIcon?: IconTypes
  /**
   * An optional tint color for the right icon
   */
  rightIconColor?: string
  /**
   * Right action text to display if not using `rightTx`.
   * Can be used with `onRightPress`. Overrides `rightIcon`.
   */
  rightText?: TextProps["text"]
  /**
   * Right action text text which is looked up via i18n.
   * Can be used with `onRightPress`. Overrides `rightIcon`.
   */
  rightTx?: TextProps["tx"]
  /**
   * Right action custom ReactElement if the built in action props don't suffice.
   * Overrides `rightIcon`, `rightTx` and `rightText`.
   */
  RightActionComponent?: ReactElement
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  rightTxOptions?: TextProps["txOptions"]
  /**
   * What happens when you press the right icon or text action.
   */
  onRightPress?: TouchableOpacityProps["onPress"]
  /**
   * Override the default edges for the safe area.
   */
  safeAreaEdges?: ExtendedEdge[]
}

interface HeaderActionProps {
  backgroundColor?: string
  icon?: IconTypes
  iconColor?: string
  text?: TextProps["text"]
  tx?: TextProps["tx"]
  txOptions?: TextProps["txOptions"]
  onPress?: TouchableOpacityProps["onPress"]
  ActionComponent?: ReactElement
}

/**
 * Header that appears on many screens. Will hold navigation buttons and screen title.
 * The Header is meant to be used with the `screenOptions.header` option on navigators, routes, or screen components via `navigation.setOptions({ header })`.
 * @param {HeaderProps} props - The props for the `Header` component.
 * @returns {JSX.Element} The rendered `Header` component.
 */
export function Header(props: HeaderProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const {
    backgroundColor = theme.colors.background,
    LeftActionComponent,
    leftIcon,
    leftIconColor,
    leftText,
    leftTx,
    leftTxOptions,
    onLeftPress,
    onRightPress,
    RightActionComponent,
    rightIcon,
    rightIconColor,
    rightText,
    rightTx,
    rightTxOptions,
    safeAreaEdges = ["top"],
    title,
    titleMode = "center",
    titleTx,
    titleTxOptions,
    titleContainerStyle: $titleContainerStyleOverride,
    style: $styleOverride,
    titleStyle: $titleStyleOverride,
    containerStyle: $containerStyleOverride,
    titleTypography,
  } = props

  const $containerInsets = useSafeAreaInsetsStyle(safeAreaEdges)

  const titleContent = titleTx ? t(titleTx, titleTxOptions as Record<string, string>) : title

  const resolvedTitleMode =
    titleTypography === "tab" ? "flex" : titleTypography === "stack" ? "center" : titleMode

  const mergedTitleStyle = useMemo((): StyleProp<TextStyle> => {
    const preset: TextStyle =
      titleTypography === "tab"
        ? {
            fontSize: 24,
            fontWeight: "700",
            textAlign: "left",
            lineHeight: 30,
          }
        : titleTypography === "stack"
          ? { fontSize: 17, fontWeight: "600", textAlign: "center" }
          : {}
    return [styles.title, preset, $titleStyleOverride]
  }, [titleTypography, $titleStyleOverride])

  const mergedTitleContainerStyle = useMemo((): StyleProp<ViewStyle> => {
    const preset: ViewStyle =
      titleTypography === "tab" ? { alignItems: "flex-start" as const } : {}
    return [
      styles.titleWrapperPointerEvents,
      resolvedTitleMode === "center" && styles.titleWrapperCenter,
      resolvedTitleMode === "flex" && styles.titleWrapperFlex,
      preset,
      $titleContainerStyleOverride,
    ]
  }, [titleTypography, resolvedTitleMode, $titleContainerStyleOverride])

  return (
    <View style={[styles.container, $containerInsets, { backgroundColor }, $containerStyleOverride]}>
      <View
        style={[
          styles.row,
          styles.wrapper,
          titleTypography === "tab" && styles.wrapperTab,
          $styleOverride,
        ]}
      >
        <HeaderAction
          tx={leftTx}
          text={leftText}
          icon={leftIcon}
          iconColor={leftIconColor}
          onPress={onLeftPress}
          txOptions={leftTxOptions}
          backgroundColor={backgroundColor}
          ActionComponent={LeftActionComponent}
        />

        {!!titleContent && (
          <View style={mergedTitleContainerStyle}>
            <Text weight="medium" size="md" text={titleContent} style={mergedTitleStyle} />
          </View>
        )}

        <HeaderAction
          tx={rightTx}
          text={rightText}
          icon={rightIcon}
          iconColor={rightIconColor}
          onPress={onRightPress}
          txOptions={rightTxOptions}
          backgroundColor={backgroundColor}
          ActionComponent={RightActionComponent}
        />
      </View>
    </View>
  )
}

/**
 * @param {HeaderActionProps} props - The props for the `HeaderAction` component.
 * @returns {JSX.Element} The rendered `HeaderAction` component.
 */
function HeaderAction(props: HeaderActionProps) {
  const { backgroundColor, icon, text, tx, txOptions, onPress, ActionComponent, iconColor } = props
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const languageTag = i18n.language?.split("-")[0]
  const isRTL = i18n.dir?.(i18n.language) === "rtl" || languageTag === "ar"

  const content = tx ? t(tx, txOptions as Record<string, string>) : text

  if (ActionComponent) return ActionComponent

  if (content) {
    return (
      <TouchableOpacity
        style={[styles.actionTextContainer, { backgroundColor }]}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.8}
      >
        <Text weight="medium" size="md" text={content} style={{ color: theme.colors.tint }} />
      </TouchableOpacity>
    )
  }

  if (icon) {
    return (
      <PressableIcon
        size={24}
        icon={icon}
        color={iconColor}
        onPress={onPress}
        containerStyle={[styles.actionIconContainer, { backgroundColor }]}
        style={isRTL ? { transform: [{ rotate: "180deg" }] } : {}}
      />
    )
  }

  return <View style={[styles.actionFillerContainer, { backgroundColor }]} />
}

const styles = StyleSheet.create((theme) => ({
  wrapper: {
    height: 56,
    alignItems: "center",
    justifyContent: "space-between",
  },
  wrapperTab: {
    minHeight: 64,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  container: {
    width: "100%",
    // Do not grow inside a column parent (e.g. Container fixedContent + flex:1 body); natural height = safe area + toolbar row only
    flex: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    textAlign: "center",
  },
  actionTextContainer: {
    flexGrow: 0,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    paddingHorizontal: theme.spacing.md,
    zIndex: 2,
  },
  actionIconContainer: {
    flexGrow: 0,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    paddingHorizontal: theme.spacing.md,
    zIndex: 2,
  },
  actionFillerContainer: {
    width: 16,
  },
  titleWrapperPointerEvents: {
    pointerEvents: "none",
  },
  titleWrapperCenter: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
    position: "absolute",
    paddingHorizontal: theme.spacing["2xl"],
    zIndex: 1,
  },
  titleWrapperFlex: {
    justifyContent: "center",
    flexGrow: 1,
  },
}))
