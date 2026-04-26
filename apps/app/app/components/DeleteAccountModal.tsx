import type { FC } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { deleteAccount as deleteSupabaseAccount } from "@/services/accountDeletion"
import { useAuthStore, useSubscriptionStore } from "@/stores"
import { GUEST_USER_KEY } from "@/stores/auth"
import type { AuthState } from "@/stores/auth/authTypes"
import { haptics } from "@/utils/haptics"
import { logger } from "@/utils/Logger"

import { Button } from "./Button"
import { Text } from "./Text"

// Convex removed - using Supabase only
const useMutation = null
const api = null

export interface DeleteAccountModalProps {
  visible: boolean
  onClose: () => void
}

/**
 * Helper to clear subscription state during account deletion
 */
async function clearSubscriptionState() {
  const subscriptionState = useSubscriptionStore.getState()
  try {
    const service = subscriptionState.getActiveService()
    await service.logOut()
  } catch (error) {
    logger.warn("Failed to log out of subscription service", { error })
  }
  subscriptionState.setCustomerInfo(null)
  subscriptionState.setWebSubscriptionInfo(null)
  subscriptionState.setPackages([])
  subscriptionState.checkProStatus()
}

/**
 * Helper to reset auth state after account deletion
 */
function resetAuthState(userId: string) {
  useAuthStore.setState((state: AuthState) => {
    // Remove onboarding entry for the deleted user while preserving guest state
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [userId]: _removed, ...onboardingStatusByUserId } = state.onboardingStatusByUserId
    const guestOnboarding =
      onboardingStatusByUserId[GUEST_USER_KEY] ?? state.onboardingStatusByUserId[GUEST_USER_KEY]
    return {
      session: null,
      user: null,
      isAuthenticated: false,
      hasCompletedOnboarding: guestOnboarding ?? true,
      onboardingStatusByUserId: {
        ...onboardingStatusByUserId,
        [GUEST_USER_KEY]: guestOnboarding ?? true,
      },
      loading: false,
    }
  })
}

export const DeleteAccountModal: FC<DeleteAccountModalProps> = ({ visible, onClose }) => {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [error, setError] = useState("")
  const isMountedRef = useRef(true)

  // Convex mutation - only defined when using Convex backend
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const convexDeleteAccount = null // Convex removed

  // Track mount state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (visible) {
      setError("")
      setConfirmChecked(false)
      setLoading(false)
    }
  }, [visible])

  const handleClose = useCallback(() => {
    if (loading) return
    haptics.buttonPress()
    onClose()
  }, [loading, onClose])

  const handleDelete = useCallback(async () => {
    setError("")
    setLoading(true)
    haptics.delete()

    const authState = useAuthStore.getState()
    const userId = authState.user?.id

    if (!userId) {
      setError(t("deleteAccountModal:errorNoUser"))
      haptics.error()
      setLoading(false)
      return
    }

    try {
      // Supabase only - use deleteSupabaseAccount
      {
        // Supabase backend: Use service
        const result = await deleteSupabaseAccount()

        if (!isMountedRef.current) {
          return
        }

        if (result.error) {
          throw result.error
        }
      }

      // Success - the auth state change will navigate away
      if (!isMountedRef.current) return

      haptics.success()
      setLoading(false)
      onClose()
    } catch (err) {
      if (!isMountedRef.current) return

      const message = err instanceof Error ? err.message : t("deleteAccountModal:errorGeneric")
      setError(message)
      haptics.error()
      setLoading(false)
    }
  }, [onClose, t, convexDeleteAccount])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={styles.titleIcon}>
                  <Ionicons name="warning-outline" size={20} color={theme.colors.error} />
                </View>
                <View style={styles.titleCopy}>
                  <Text style={styles.title} tx="deleteAccountModal:title" />
                  <Text style={styles.subtitle} tx="deleteAccountModal:subtitle" />
                </View>
              </View>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={theme.colors.foreground} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.infoRow}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                <Text style={styles.infoText} tx="deleteAccountModal:infoProfile" />
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.error} />
                <Text style={styles.infoText} tx="deleteAccountModal:infoSubscriptions" />
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="log-out-outline" size={18} color={theme.colors.error} />
                <Text style={styles.infoText} tx="deleteAccountModal:infoSignOut" />
              </View>

              <View style={styles.confirmRow}>
                <View style={styles.confirmCopy}>
                  <Text style={styles.confirmLabel} tx="deleteAccountModal:confirmLabel" />
                  <Text style={styles.confirmHint} tx="deleteAccountModal:confirmHint" />
                </View>
                <Switch
                  value={confirmChecked}
                  onValueChange={() => {
                    haptics.switchChange()
                    setConfirmChecked((prev) => !prev)
                  }}
                  trackColor={{ false: theme.colors.borderSecondary, true: theme.colors.error }}
                  thumbColor={theme.colors.card}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.actions}>
              <Button
                tx="deleteAccountModal:cancelButton"
                variant="ghost"
                onPress={handleClose}
                disabled={loading}
                style={styles.cancelButton}
              />
              <Button
                tx="deleteAccountModal:deleteButton"
                variant="danger"
                onPress={handleDelete}
                loading={loading}
                disabled={!confirmChecked || loading}
                style={styles.deleteButton}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create((theme) => ({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay,
  },
  modalContainer: {
    width: "92%",
    maxWidth: 440,
  },
  modal: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius["3xl"],
    overflow: "hidden",
    ...theme.shadows.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flex: 1,
  },
  titleIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.errorBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCopy: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontFamily: theme.typography.fonts.bold,
    color: theme.colors.foreground,
  },
  subtitle: {
    marginTop: 2,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fonts.medium,
    color: theme.colors.foregroundSecondary,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.backgroundSecondary,
    marginLeft: theme.spacing.md,
  },
  scrollView: {
    maxHeight: 380,
  },
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.base,
    lineHeight: theme.typography.lineHeights.base,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  confirmCopy: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  confirmLabel: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.base,
  },
  confirmHint: {
    color: theme.colors.foregroundSecondary,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.sm,
    marginTop: 4,
  },
  errorText: {
    color: theme.colors.error,
    fontFamily: theme.typography.fonts.medium,
    fontSize: theme.typography.sizes.sm,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.separator,
  },
  cancelButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
  },
}))
