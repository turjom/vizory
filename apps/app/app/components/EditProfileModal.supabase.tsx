/**
 * EditProfileModal - Supabase Version
 *
 * A modal for editing user profile with Supabase.
 * Uses React Query mutations passed from parent for data updates.
 */

import type { FC } from "react"
import { useState, useEffect } from "react"
import { Modal, View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { haptics } from "@/utils/haptics"
import { logger } from "@/utils/Logger"

import { Button } from "./Button"
import { Text } from "./Text"
import { TextField } from "./TextField"

// =============================================================================
// TYPES
// =============================================================================

interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  updated_at: string | null
}

export interface EditProfileModalSupabaseProps {
  visible: boolean
  onClose: () => void
  profile: Profile | null | undefined
  onUpdate: (firstName: string, lastName: string) => Promise<{ error: Error | null }>
  isUpdating: boolean
}

// =============================================================================
// COMPONENT
// =============================================================================

export const EditProfileModalSupabase: FC<EditProfileModalSupabaseProps> = ({
  visible,
  onClose,
  profile,
  onUpdate,
  isUpdating,
}) => {
  const { theme } = useUnistyles()
  const { t } = useTranslation()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [error, setError] = useState("")

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? "")
      setLastName(profile.last_name ?? "")
    }
  }, [profile])

  const handleSave = async () => {
    setError("")
    haptics.buttonPress()

    const { error: updateError } = await onUpdate(firstName, lastName)

    if (updateError) {
      logger.error("Profile update error", { error: updateError })
      setError(updateError.message || t("editProfileModal:errorGeneric"))
      haptics.error()
      return
    }

    haptics.success()
    onClose()
  }

  const handleClose = () => {
    haptics.buttonPress()
    setError("")
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
                editable={!isUpdating}
              />

              <TextField
                labelTx="editProfileModal:lastNameLabel"
                placeholderTx="editProfileModal:lastNamePlaceholder"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isUpdating}
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
                disabled={isUpdating}
                style={styles.cancelButton}
              />
              <Button
                tx="editProfileModal:saveButton"
                variant="filled"
                onPress={handleSave}
                loading={isUpdating}
                disabled={isUpdating || !firstName.trim() || !lastName.trim()}
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
