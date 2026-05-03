import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Pressable, View } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  SlideInUp,
  SlideOutUp,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Icon, IconTypes } from "./Icon"
import { Text } from "./Text"

// =============================================================================
// TYPES
// =============================================================================

type ToastVariant = "default" | "success" | "error" | "warning" | "info"

interface ToastData {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  icon?: IconTypes
  duration?: number
  action?: {
    label: string
    onPress: () => void
  }
}

interface ToastContextValue {
  toasts: ToastData[]
  show: (toast: Omit<ToastData, "id">) => string
  hide: (id: string) => void
  hideAll: () => void
}

interface ToastProviderProps {
  children: ReactNode
  /**
   * Maximum number of toasts to show at once
   */
  maxToasts?: number
  /**
   * Default duration in milliseconds
   */
  defaultDuration?: number
}

export interface ToastProps extends ToastData {
  /** Stable dismiss handler from provider; pass toast `id` when calling. */
  onDismiss: (toastId: string) => void
}

// =============================================================================
// CONTEXT
// =============================================================================

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Hook to access toast functions.
 *
 * @example
 * const toast = useToast()
 * toast.show({ title: "Success!", variant: "success" })
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

// =============================================================================
// TOAST PROVIDER
// =============================================================================

/**
 * Provider component that enables toast notifications throughout the app.
 *
 * @example
 * // In your app root
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 *
 * // In any component
 * const toast = useToast()
 * toast.show({
 *   title: "Profile updated",
 *   description: "Your changes have been saved",
 *   variant: "success",
 * })
 */
export function ToastProvider(props: ToastProviderProps) {
  const { children, maxToasts = 3, defaultDuration = 4000 } = props
  const [toasts, setToasts] = useState<ToastData[]>([])
  const insets = useSafeAreaInsets()

  const show = useCallback(
    (toast: Omit<ToastData, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const newToast: ToastData = {
        ...toast,
        id,
        duration: toast.duration ?? defaultDuration,
      }

      setToasts((prev) => {
        const updated = [newToast, ...prev]
        return updated.slice(0, maxToasts)
      })

      return id
    },
    [defaultDuration, maxToasts],
  )

  const hide = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const hideAll = useCallback(() => {
    setToasts([])
  }, [])

  const contextValue = useMemo(
    () => ({ toasts, show, hide, hideAll }),
    [toasts, show, hide, hideAll],
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onDismiss={hide} />
        ))}
      </View>
    </ToastContext.Provider>
  )
}

// =============================================================================
// TOAST COMPONENT
// =============================================================================

function Toast(props: ToastProps) {
  const { id, title, description, variant = "default", icon, duration = 4000, action, onDismiss } = props

  const { theme } = useUnistyles()
  const progress = useSharedValue(1)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  const dismiss = useCallback(() => {
    onDismissRef.current(id)
  }, [id])

  // Get variant styles
  const variantConfig = useMemo(() => {
    switch (variant) {
      case "success":
        return {
          icon: icon ?? ("check" as IconTypes),
          iconColor: theme.colors.success,
          borderColor: theme.colors.success,
        }
      case "error":
        return {
          icon: icon ?? ("x" as IconTypes),
          iconColor: theme.colors.error,
          borderColor: theme.colors.error,
        }
      case "warning":
        return {
          icon: icon ?? ("bell" as IconTypes),
          iconColor: theme.colors.warning,
          borderColor: theme.colors.warning,
        }
      case "info":
        return {
          icon: icon ?? ("view" as IconTypes),
          iconColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        }
      default:
        return {
          icon: icon,
          iconColor: theme.colors.foreground,
          borderColor: theme.colors.border,
        }
    }
  }, [variant, icon, theme])

  // Auto-dismiss on the JS timer. Do not rely on Reanimated's withTiming completion +
  // runOnJS — that path can fail to fire after navigation or on some platforms, leaving
  // the toast stuck. Progress bar still animates via withTiming for the same duration.
  useEffect(() => {
    cancelAnimation(progress)
    progress.value = 1

    if (duration <= 0) {
      return () => {
        cancelAnimation(progress)
      }
    }

    progress.value = withTiming(0, { duration })

    const timer = setTimeout(() => {
      dismiss()
    }, duration)

    return () => {
      clearTimeout(timer)
      cancelAnimation(progress)
    }
  }, [duration, dismiss, progress])

  // Progress bar animation
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }))

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(20).stiffness(200)}
      exiting={SlideOutUp.springify().damping(20).stiffness(200)}
      style={[styles.toast, { borderLeftColor: variantConfig.borderColor }]}
    >
      <View style={styles.toastContent}>
        {variantConfig.icon && (
          <View style={styles.iconContainer}>
            <Icon icon={variantConfig.icon} size={20} color={variantConfig.iconColor} />
          </View>
        )}

        <Pressable style={styles.textContainer} onPress={dismiss}>
          <Text weight="semiBold" size="sm" numberOfLines={1}>
            {title}
          </Text>
          {description && (
            <Text size="xs" color="secondary" numberOfLines={2} style={styles.description}>
              {description}
            </Text>
          )}
        </Pressable>

        {action && (
          <Pressable style={styles.actionButton} onPress={action.onPress}>
            <Text size="sm" weight="semiBold" style={{ color: theme.colors.primary }}>
              {action.label}
            </Text>
          </Pressable>
        )}

        <Pressable style={styles.closeButton} onPress={dismiss} hitSlop={8}>
          <Icon icon="x" size={16} color={theme.colors.foregroundTertiary} />
        </Pressable>
      </View>

      {/* Progress bar */}
      {duration > 0 && (
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              { backgroundColor: variantConfig.borderColor },
              progressStyle,
            ]}
          />
        </View>
      )}
    </Animated.View>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    position: "absolute",
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 9999,
    gap: theme.spacing.sm,
  },
  toast: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  description: {
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  progressContainer: {
    height: 2,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  progressBar: {
    height: "100%",
  },
}))
