import type { FC } from "react"
import { useState } from "react"
import { Modal, Pressable, View, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import CountryFlag from "react-native-country-flag"
import Animated, { FadeInDown } from "react-native-reanimated"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { changeLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n"
import { haptics } from "@/utils/haptics"
import { logger } from "@/utils/Logger"

import { Text } from "./Text"

// =============================================================================
// TYPES
// =============================================================================

export interface LanguageSelectorProps {
  visible: boolean
  onClose: () => void
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Language metadata with country codes for flags
const LANGUAGE_METADATA: Record<
  SupportedLanguage,
  { name: string; countryCode: string; nativeName: string }
> = {
  en: { name: "English", countryCode: "US", nativeName: "English" },
  ar: { name: "Arabic", countryCode: "SA", nativeName: "العربية" },
  es: { name: "Spanish", countryCode: "ES", nativeName: "Español" },
  fr: { name: "French", countryCode: "FR", nativeName: "Français" },
  hi: { name: "Hindi", countryCode: "IN", nativeName: "हिन्दी" },
  ja: { name: "Japanese", countryCode: "JP", nativeName: "日本語" },
  ko: { name: "Korean", countryCode: "KR", nativeName: "한국어" },
}

// =============================================================================
// COMPONENT
// =============================================================================

export const LanguageSelector: FC<LanguageSelectorProps> = ({ visible, onClose }) => {
  const { theme } = useUnistyles()
  const [changing, setChanging] = useState(false)
  // Use useTranslation hook to get reactive language updates
  const { i18n } = useTranslation()
  const currentLanguage = (i18n.language?.split("-")[0] || "en") as SupportedLanguage

  const handleLanguageChange = async (languageCode: SupportedLanguage) => {
    if (changing || languageCode === currentLanguage) {
      onClose()
      return
    }

    setChanging(true)
    haptics.selection()

    try {
      await changeLanguage(languageCode)
      haptics.success()
      onClose()
    } catch (error) {
      logger.error("Failed to change language", { error })
      haptics.error()
    } finally {
      setChanging(false)
    }
  }

  const languages = Object.entries(SUPPORTED_LANGUAGES) as [SupportedLanguage, string][]

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Ionicons name="language" size={24} color={theme.colors.primary} />
                <Text style={styles.title} tx="settings:language" />
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.foreground} />
              </Pressable>
            </View>

            {/* Language List */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {languages.map(([code, name], index) => {
                const metadata = LANGUAGE_METADATA[code]
                const isSelected = code === currentLanguage

                return (
                  <Animated.View key={code} entering={FadeInDown.delay(index * 50).springify()}>
                    <Pressable
                      style={[styles.languageItem, isSelected && styles.languageItemSelected]}
                      onPress={() => handleLanguageChange(code)}
                      disabled={changing}
                    >
                      <View style={styles.languageContent}>
                        <View style={styles.flagContainer}>
                          <CountryFlag isoCode={metadata.countryCode} size={32} />
                        </View>
                        <View style={styles.languageInfo}>
                          <Text
                            style={[styles.languageName, isSelected && styles.languageNameSelected]}
                          >
                            {metadata.nativeName}
                          </Text>
                          <Text style={styles.languageNameEnglish}>{name}</Text>
                        </View>
                      </View>
                      {isSelected && (
                        <View style={styles.checkContainer}>
                          <Ionicons
                            name="checkmark-circle"
                            size={24}
                            color={theme.colors.primary}
                          />
                        </View>
                      )}
                    </Pressable>
                  </Animated.View>
                )
              })}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText} tx="settings:languageAutoDetect" />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "80%",
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
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
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  languageItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.backgroundSecondary,
    marginBottom: theme.spacing.xs,
  },
  languageItemSelected: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  languageContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    flex: 1,
  },
  flagContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: theme.typography.sizes.base,
    fontFamily: theme.typography.fonts.semiBold,
    color: theme.colors.foreground,
    marginBottom: 2,
  },
  languageNameSelected: {
    color: theme.colors.primary,
  },
  languageNameEnglish: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fonts.regular,
    color: theme.colors.foregroundSecondary,
  },
  checkContainer: {
    marginLeft: theme.spacing.sm,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.separator,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  footerText: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fonts.regular,
    color: theme.colors.foregroundSecondary,
    textAlign: "center",
  },
}))
