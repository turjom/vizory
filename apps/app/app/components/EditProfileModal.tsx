import type { FC } from "react"
import { useState, useEffect } from "react"
import { Modal, View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { useAuth } from "@/hooks"
import { haptics } from "@/utils/haptics"
import { logger } from "@/utils/Logger"

import { Button } from "./Button"
import { Text } from "./Text"
import { TextField } from "./TextField"

// =============================================================================
// TYPES
// =============================================================================

export interface EditProfileModalProps {
  visible: boolean
  onClose: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export const EditProfileModal: FC<EditProfileModalProps> = ({ visible, onClose }) => {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const { user, updateProfile } = useAuth()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "")
      setLastName(user.lastName ?? "")
    }
  }, [user])

  const handleSave = async () => {
    setError("")
    setLoading(true)
    haptics.buttonPress()

    try {
      const { error: updateError } = await updateProfile({
        firstName,
        lastName,
      })

      if (updateError) {
        logger.error("Profile update error", { error: updateError })
        setError(updateError.message || t("editProfileModal:errorGeneric"))
        haptics.error()
        return
      }

      haptics.success()
      onClose()
    } catch (err) {
      logger.error("Profile update error", { error: err })
      setError(err instanceof Error ? err.message : t("editProfileModal:errorGeneric"))
      haptics.error()
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    haptics.buttonPress()
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title} tx="editProfileModal:title" />
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.foreground} />
              </Pressable>
            </View>

            {/* Form */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.form}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TextField
                labelTx="editProfileModal:firstNameLabel"
                placeholderTx="editProfileModal:firstNamePlaceholder"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
              />

              <TextField
                labelTx="editProfileModal:lastNameLabel"
                placeholderTx="editProfileModal:lastNamePlaceholder"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
                containerStyle={styles.lastNameField}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                tx="editProfileModal:cancelButton"
                variant="outlined"
                onPress={handleClose}
                disabled={loading}
                style={styles.cancelButton}
              />
              <Button
                tx="editProfileModal:saveButton"
                variant="filled"
                onPress={handleSave}
                loading={loading}
                disabled={loading || !firstName.trim() || !lastName.trim()}
                style={styles.saveButton}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay,
  },
  modalContainer: {
    width: "90%",
    maxWidth: 400,
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
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  title: {
    fontSize: theme.typography.sizes["2xl"],
    fontFamily: theme.typography.fonts.bold,
    color: theme.colors.foreground,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  scrollView: {
    maxHeight: 400,
  },
  form: {
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  lastNameField: {
    marginTop: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fonts.regular,
    marginTop: theme.spacing.sm,
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
  saveButton: {
    flex: 1,
  },
}))
