/**
 * Unistyles Configuration
 *
 * This is the single source of truth for all styling in the app.
 * Import this file at the app entry point before any component imports.
 *
 * @example
 * // In index.tsx or App.tsx (before other imports)
 * import './app/theme/unistyles'
 */

import { Platform } from "react-native"
import { StyleSheet } from "react-native-unistyles"

// =============================================================================
// COLOR PALETTE
// =============================================================================

const palette = {
  // Neutrals
  white: "#FFFFFF",
  black: "#000000",

  // Grays (Light Mode)
  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray600: "#4B5563",
  gray700: "#374151",
  gray800: "#1F2937",
  gray900: "#111827",

  // Neutrals (Slate Style)
  neutral50: "#F8FAFC",
  neutral100: "#F1F5F9",
  neutral200: "#E2E8F0",
  neutral300: "#CBD5E1",
  neutral400: "#94A3B8",
  neutral500: "#64748B",
  neutral600: "#475569",
  neutral700: "#334155",
  neutral800: "#1E293B",
  neutral900: "#0F172A",

  // Primary (Sky Blue)
  primary50: "#F0F9FF",
  primary100: "#E0F2FE",
  primary200: "#BAE6FD",
  primary300: "#7DD3FC",
  primary400: "#38BDF8",
  primary500: "#0EA5E9",
  primary600: "#0284C7",
  primary700: "#0369A1",
  primary800: "#075985",
  primary900: "#0C4A6E",

  // Secondary (Purple)
  secondary50: "#FAF5FF",
  secondary100: "#F3E8FF",
  secondary200: "#E9D5FF",
  secondary300: "#D8B4FE",
  secondary400: "#C084FC",
  secondary500: "#A855F7",
  secondary600: "#9333EA",
  secondary700: "#7E22CE",
  secondary800: "#6B21A8",
  secondary900: "#581C87",

  // Accent (Orange)
  accent50: "#FFF7ED",
  accent100: "#FFEDD5",
  accent200: "#FED7AA",
  accent300: "#FDBA74",
  accent400: "#FB923C",
  accent500: "#F97316",
  accent600: "#EA580C",
  accent700: "#C2410C",
  accent800: "#9A3412",
  accent900: "#7C2D12",

  // Success (Green)
  success50: "#F0FDF4",
  success100: "#DCFCE7",
  success200: "#BBF7D0",
  success300: "#86EFAC",
  success400: "#4ADE80",
  success500: "#22C55E",
  success600: "#16A34A",
  success700: "#15803D",
  success800: "#166534",
  success900: "#14532D",

  // Error (Red)
  error50: "#FEF2F2",
  error100: "#FEE2E2",
  error200: "#FECACA",
  error300: "#FCA5A5",
  error400: "#F87171",
  error500: "#EF4444",
  error600: "#DC2626",
  error700: "#B91C1C",
  error800: "#991B1B",
  error900: "#7F1D1D",

  // Warning (Amber)
  warning50: "#FFFBEB",
  warning100: "#FEF3C7",
  warning200: "#FDE68A",
  warning300: "#FCD34D",
  warning400: "#FBBF24",
  warning500: "#F59E0B",
  warning600: "#D97706",
  warning700: "#B45309",
  warning800: "#92400E",
  warning900: "#78350F",

  // Info (Blue)
  info50: "#EFF6FF",
  info100: "#DBEAFE",
  info200: "#BFDBFE",
  info300: "#93C5FD",
  info400: "#60A5FA",
  info500: "#3B82F6",
  info600: "#2563EB",
  info700: "#1D4ED8",
  info800: "#1E40AF",
  info900: "#1E3A8A",
} as const

// =============================================================================
// LIGHT THEME
// =============================================================================

export const lightTheme = {
  colors: {
    // Palette access
    palette,

    // Semantic colors
    primary: palette.black,
    primaryForeground: palette.white,

    secondary: palette.gray100,
    secondaryForeground: palette.gray900,

    accent: palette.accent500,
    accentForeground: palette.white,

    background: "#FFFFFF",
    backgroundSecondary: palette.gray100,
    backgroundTertiary: palette.gray200,

    foreground: palette.gray900,
    foregroundSecondary: palette.gray600,
    foregroundTertiary: palette.gray400,

    card: palette.white,
    cardForeground: palette.gray900,

    border: palette.gray200,
    borderSecondary: palette.gray300,

    input: palette.gray100,
    inputForeground: palette.gray900,
    inputPlaceholder: palette.gray400,
    inputBorder: palette.gray300,
    inputBorderFocus: palette.accent500,

    // Semantic states
    success: palette.success500,
    successBackground: palette.success50,
    successForeground: palette.success700,

    error: palette.error500,
    errorBackground: palette.error50,
    errorForeground: palette.error700,

    warning: palette.warning500,
    warningBackground: palette.warning50,
    warningForeground: palette.warning700,

    info: palette.info500,
    infoBackground: palette.info50,
    infoForeground: palette.info700,

    // Overlay
    overlay: "rgba(0, 0, 0, 0.5)",
    overlayLight: "rgba(0, 0, 0, 0.1)",

    // Gradient colors
    gradientStart: palette.primary100,
    gradientMiddle: palette.secondary50,
    gradientEnd: palette.accent50,

    // Misc
    transparent: "transparent",
    link: palette.accent600,
    tint: palette.accent500,
    separator: palette.gray200,
  },

  // Typography
  typography: {
    fonts: {
      // Font family names for Unistyles
      // expo-font registers fonts using the KEY from customFontsToLoad object
      // On web: uses the key name directly (e.g., "spaceGroteskRegular")
      // On native: uses PostScript names (e.g., "SpaceGrotesk-Regular")
      regular: Platform.select({
        web: "spaceGroteskRegular",
        ios: "-apple-system",
        default: "SpaceGrotesk-Regular",
      }),
      medium: Platform.select({
        web: "spaceGroteskMedium",
        ios: "-apple-system",
        default: "SpaceGrotesk-Medium",
      }),
      semiBold: Platform.select({
        web: "spaceGroteskSemiBold",
        ios: "-apple-system",
        default: "SpaceGrotesk-SemiBold",
      }),
      bold: Platform.select({
        web: "spaceGroteskBold",
        ios: "-apple-system",
        default: "SpaceGrotesk-Bold",
      }),
    },
    sizes: {
      "xs": 12,
      "sm": 14,
      "base": 16,
      "lg": 18,
      "xl": 20,
      "2xl": 24,
      "3xl": 30,
      "4xl": 36,
      "5xl": 48,
    },
    lineHeights: {
      "xs": 16,
      "sm": 20,
      "base": 24,
      "lg": 28,
      "xl": 28,
      "2xl": 32,
      "3xl": 36,
      "4xl": 40,
      "5xl": 48,
    },
  },

  // Spacing (8px grid system)
  spacing: {
    "xxxs": 2,
    "xxs": 4,
    "xs": 8,
    "sm": 12,
    "md": 16,
    "lg": 24,
    "xl": 32,
    "2xl": 40,
    "3xl": 48,
    "4xl": 64,
    "5xl": 80,
  },

  // Border radius
  radius: {
    "none": 0,
    "xs": 4,
    "sm": 8,
    "md": 12,
    "lg": 16,
    "xl": 20,
    "2xl": 24,
    "3xl": 32,
    "full": 9999,
  },

  // Shadows
  // Web shadows use direct CSS box-shadow for better control and lighter appearance
  // Native shadows use React Native shadow properties
  shadows: {
    none: {
      shadowColor: "transparent",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === "web" && { boxShadow: "none" }),
    },
    xs: Platform.select({
      web: {
        boxShadow: "0 1px 1px rgba(0, 0, 0, 0.01)",
        elevation: 1,
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 1,
      },
    }),
    sm: Platform.select({
      web: {
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.01)",
        elevation: 1,
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
    md: Platform.select({
      web: {
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.015)",
        elevation: 2,
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
    lg: Platform.select({
      web: {
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.02)",
        elevation: 4,
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
    xl: Platform.select({
      web: {
        boxShadow: "0 6px 12px rgba(0, 0, 0, 0.025)",
        elevation: 8,
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },

  // Component sizes
  sizes: {
    icon: {
      xs: 16,
      sm: 20,
      md: 24,
      lg: 32,
      xl: 40,
    },
    button: {
      sm: 36,
      md: 44,
      lg: 56,
    },
    input: {
      sm: 40,
      md: 48,
      lg: 56,
    },
    avatar: {
      xs: 24,
      sm: 32,
      md: 40,
      lg: 56,
      xl: 80,
    },
  },

  // Animation timing
  timing: {
    fast: 150,
    normal: 300,
    slow: 500,
  },

  // Helper functions
  gap: (multiplier: number) => multiplier * 8,
} as const

// =============================================================================
// DARK THEME
// =============================================================================

export const darkTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    palette,

    // Semantic colors
    primary: palette.white,
    primaryForeground: palette.black,

    secondary: palette.gray800,
    secondaryForeground: palette.gray100,

    accent: palette.accent400,
    accentForeground: palette.black,

    background: palette.gray900,
    backgroundSecondary: palette.gray800,
    backgroundTertiary: palette.gray700,

    foreground: palette.gray100,
    foregroundSecondary: palette.gray400,
    foregroundTertiary: palette.gray500,

    card: palette.gray800,
    cardForeground: palette.gray100,

    border: palette.gray700,
    borderSecondary: palette.gray600,

    input: palette.gray800,
    inputForeground: palette.gray100,
    inputPlaceholder: palette.gray500,
    inputBorder: palette.gray600,
    inputBorderFocus: palette.accent500,

    // Semantic states
    success: palette.success400,
    successBackground: "rgba(34, 197, 94, 0.1)",
    successForeground: palette.success300,

    error: palette.error400,
    errorBackground: "rgba(239, 68, 68, 0.1)",
    errorForeground: palette.error300,

    warning: palette.warning400,
    warningBackground: "rgba(245, 158, 11, 0.1)",
    warningForeground: palette.warning300,

    info: palette.info400,
    infoBackground: "rgba(59, 130, 246, 0.1)",
    infoForeground: palette.info300,

    // Overlay
    overlay: "rgba(0, 0, 0, 0.7)",
    overlayLight: "rgba(0, 0, 0, 0.3)",

    // Gradient colors
    gradientStart: palette.gray800,
    gradientMiddle: palette.gray900,
    gradientEnd: palette.black,

    link: palette.primary400,
    tint: palette.primary400,
    separator: palette.gray700,
  },
} as const

// =============================================================================
// BREAKPOINTS
// =============================================================================

const breakpoints = {
  xs: 0,
  sm: 380,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

// =============================================================================
// THEME TYPES
// =============================================================================

type AppThemes = {
  light: typeof lightTheme
  dark: typeof darkTheme
}

type AppBreakpoints = typeof breakpoints

// Extend Unistyles types for TypeScript support
declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

// =============================================================================
// CONFIGURE UNISTYLES
// =============================================================================

StyleSheet.configure({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  breakpoints,
  settings: {
    adaptiveThemes: true,
  },
})

// Export themes for external use
export const themes = { light: lightTheme, dark: darkTheme }
export type Theme = typeof lightTheme
