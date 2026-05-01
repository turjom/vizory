import type { ReactNode } from "react"
import type { ViewStyle, StyleProp } from "react-native"
import {
  Modal as RNModal,
  Pressable,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Button, ButtonProps } from "./Button"
import { Icon } from "./Icon"
import { Text, TextProps } from "./Text"

// =============================================================================
// TYPES
// =============================================================================

type ModalSize = "sm" | "md" | "lg" | "full"

export interface ModalProps {
  /**
   * Whether the modal is visible
   */
  visible: boolean
  /**
   * Callback when modal is closed
   */
  onClose: () => void
  /**
   * Modal title
   */
  title?: string
  /**
   * Modal title i18n key
   */
  titleTx?: TextProps["tx"]
  /**
   * Modal description/subtitle
   */
  description?: string
  /**
   * Modal description i18n key
   */
  descriptionTx?: TextProps["tx"]
  /**
   * Modal content
   */
  children?: ReactNode
  /**
   * Modal size
   */
  size?: ModalSize
  /**
   * Show close button in header
   */
  showCloseButton?: boolean
  /**
   * Close modal when backdrop is pressed
   */
  closeOnBackdropPress?: boolean
  /**
   * Primary action button text
   */
  primaryAction?: string
  /**
   * Primary action button i18n key
   */
  primaryActionTx?: TextProps["tx"]
  /**
   * Primary action callback
   */
  onPrimaryAction?: () => void
  /**
   * Primary action loading state
   */
  primaryActionLoading?: boolean
  /**
   * Primary action disabled state
   */
  primaryActionDisabled?: boolean
  /**
   * Primary action variant
   */
  primaryActionVariant?: ButtonProps["variant"]
  /**
   * Secondary action button text
   */
  secondaryAction?: string
  /**
   * Secondary action button i18n key
   */
  secondaryActionTx?: TextProps["tx"]
  /**
   * Secondary action callback
   */
  onSecondaryAction?: () => void
  /**
   * Header component (replaces default header)
   */
  HeaderComponent?: ReactNode
  /**
   * Footer component (replaces default footer)
   */
  FooterComponent?: ReactNode
  /**
   * Additional container style
   */
  style?: StyleProp<ViewStyle>
  /**
   * Additional content container style
   */
  contentStyle?: StyleProp<ViewStyle>
  /**
   * Test ID
   */
  testID?: string
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * A flexible modal component with built-in header, footer, and animations.
 *
 * @example
 * // Basic modal
 * <Modal
 *   visible={isVisible}
 *   onClose={() => setIsVisible(false)}
 *   title="Confirm Action"
 *   description="Are you sure you want to proceed?"
 *   primaryAction="Confirm"
 *   onPrimaryAction={handleConfirm}
 *   secondaryAction="Cancel"
 *   onSecondaryAction={() => setIsVisible(false)}
 * />
 *
 * // Modal with custom content
 * <Modal
 *   visible={isVisible}
 *   onClose={() => setIsVisible(false)}
 *   title="Settings"
 *   size="lg"
 * >
 *   <YourCustomContent />
 * </Modal>
 *
 * // Full screen modal
 * <Modal
 *   visible={isVisible}
 *   onClose={() => setIsVisible(false)}
 *   size="full"
 *   title="Create New Item"
 * >
 *   <YourForm />
 * </Modal>
 *
 * // Alert-style modal
 * <Modal
 *   visible={showAlert}
 *   onClose={() => setShowAlert(false)}
 *   title="Error"
 *   description="Something went wrong. Please try again."
 *   primaryAction="OK"
 *   onPrimaryAction={() => setShowAlert(false)}
 *   size="sm"
 * />
 */
export function Modal(props: ModalProps) {
  const {
    visible,
    onClose,
    title,
    titleTx,
    description,
    descriptionTx,
    children,
    size = "md",
    showCloseButton = true,
    closeOnBackdropPress = true,
    primaryAction,
    primaryActionTx,
    onPrimaryAction,
    primaryActionLoading = false,
    primaryActionDisabled = false,
    primaryActionVariant = "filled",
    secondaryAction,
    secondaryActionTx,
    onSecondaryAction,
    HeaderComponent,
    FooterComponent,
    style,
    contentStyle,
    testID,
  } = props

  const { theme } = useUnistyles()

  // Apply size variants
  styles.useVariants({ size })

  const hasTitle = !!(title || titleTx)
  const hasDescription = !!(description || descriptionTx)
  const hasHeader = hasTitle || hasDescription || showCloseButton || HeaderComponent
  const hasFooter =
    !!(primaryAction || primaryActionTx || secondaryAction || secondaryActionTx) || FooterComponent

  const handleBackdropPress = () => {
    if (closeOnBackdropPress) {
      onClose()
    }
  }

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        {/* Backdrop */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFillObject}
        >
          <Pressable style={styles.backdrop} onPress={handleBackdropPress} />
        </Animated.View>

        {/* Modal Container */}
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(200)}
          exiting={SlideOutDown.springify().damping(20).stiffness(200)}
          style={[styles.modalContainer, style]}
        >
          <View style={styles.modal}>
            {/* Header */}
            {hasHeader && (
              <View style={styles.header}>
                {HeaderComponent || (
                  <>
                    <View style={styles.headerText}>
                      {hasTitle && (
                        <Text
                          text={title}
                          tx={titleTx}
                          preset="heading"
                          size="xl"
                          style={styles.title}
                        />
                      )}
                      {hasDescription && (
                        <Text
                          text={description}
                          tx={descriptionTx}
                          color="secondary"
                          size="sm"
                          style={styles.description}
                        />
                      )}
                    </View>
                    {showCloseButton && (
                      <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
                        <Icon icon="x" size={20} color={theme.colors.foreground} />
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Content */}
            {children && (
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.content, contentStyle]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            )}

            {/* Footer */}
            {hasFooter && (
              <View style={styles.footer}>
                {FooterComponent || (
                  <>
                    {(secondaryAction || secondaryActionTx) && (
                      <Button
                        text={secondaryAction}
                        tx={secondaryActionTx}
                        variant="outlined"
                        onPress={onSecondaryAction ?? onClose}
                        style={styles.footerButton}
                      />
                    )}
                    {(primaryAction || primaryActionTx) && (
                      <Button
                        text={primaryAction}
                        tx={primaryActionTx}
                        variant={primaryActionVariant}
                        onPress={onPrimaryAction}
                        loading={primaryActionLoading}
                        disabled={primaryActionDisabled || primaryActionLoading}
                        style={styles.footerButton}
                      />
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  )
}

// =============================================================================
// ALERT MODAL SHORTHAND
// =============================================================================

export interface AlertModalProps {
  visible: boolean
  onClose: () => void
  title?: string
  titleTx?: TextProps["tx"]
  message?: string
  messageTx?: TextProps["tx"]
  confirmText?: string
  confirmTx?: TextProps["tx"]
  cancelText?: string
  cancelTx?: TextProps["tx"]
  onConfirm?: () => void
  onCancel?: () => void
  variant?: "default" | "danger"
}

/**
 * A simplified alert modal for confirmations and messages.
 *
 * @example
 * <AlertModal
 *   visible={showAlert}
 *   onClose={() => setShowAlert(false)}
 *   title="Delete Item?"
 *   message="This action cannot be undone."
 *   confirmText="Delete"
 *   cancelText="Cancel"
 *   onConfirm={handleDelete}
 *   variant="danger"
 * />
 */
export function AlertModal(props: AlertModalProps) {
  const {
    visible,
    onClose,
    title,
    titleTx,
    message,
    messageTx,
    confirmText,
    confirmTx,
    cancelText,
    cancelTx,
    onConfirm,
    onCancel,
    variant = "default",
  } = props

  const handleCancel = () => {
    onCancel?.()
    onClose()
  }

  const handleConfirm = () => {
    onConfirm?.()
    onClose()
  }

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      titleTx={titleTx}
      description={message}
      descriptionTx={messageTx}
      size="sm"
      showCloseButton={false}
      primaryAction={confirmText}
      primaryActionTx={confirmTx}
      onPrimaryAction={handleConfirm}
      primaryActionVariant={variant === "danger" ? "danger" : "filled"}
      secondaryAction={cancelText}
      secondaryActionTx={cancelTx}
      onSecondaryAction={handleCancel}
    />
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  modalContainer: {
    position: "absolute",
    variants: {
      size: {
        sm: {
          width: "85%",
          maxWidth: 340,
        },
        md: {
          width: "90%",
          maxWidth: 420,
        },
        lg: {
          width: "95%",
          maxWidth: 600,
        },
        full: {
          width: "100%",
          height: "100%",
          maxWidth: undefined,
        },
      },
    },
  },
  modal: {
    backgroundColor: theme.colors.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.xl,
    variants: {
      size: {
        sm: {
          borderRadius: 28,
        },
        md: {
          borderRadius: 32,
        },
        lg: {
          borderRadius: 36,
        },
        full: {
          borderRadius: 0,
          borderWidth: 0,
          flex: 1,
        },
      },
    },
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing["2xl"],
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },
  description: {
    marginTop: theme.spacing.sm,
    letterSpacing: 0.1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scrollView: {
    maxHeight: 400,
    variants: {
      size: {
        sm: {
          maxHeight: 200,
        },
        md: {
          maxHeight: 400,
        },
        lg: {
          maxHeight: 500,
        },
        full: {
          maxHeight: undefined,
          flex: 1,
        },
      },
    },
  },
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  footer: {
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.separator,
  },
  footerButton: {
    flex: 1,
  },
}))
