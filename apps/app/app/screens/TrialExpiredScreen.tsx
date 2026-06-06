import { Pressable, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { NavigationProp, StackActions, useNavigation } from "@react-navigation/native"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Button, Screen, Text } from "@/components"
import type { AppStackParamList } from "@/navigators/navigationTypes"

const trialGatedStackRoutes = new Set<string>(["InventoryAdjustment", "StockTake"])

export const TrialExpiredScreen = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>()
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  const goToProfile = () => {
    navigation.navigate("Main", { screen: "Profile" })
  }

  const closeToPreviousScreen = () => {
    const state = navigation.getState()
    const previousRoute = state.routes[state.index - 1]

    if (previousRoute?.name === "Main") {
      const mainState = previousRoute.state as
        | { index?: number; routes?: Array<{ name?: string }> }
        | undefined
      const activeTab = mainState?.routes?.[mainState.index ?? 0]?.name

      if (activeTab === "Add") {
        navigation.navigate("Main", { screen: "Inventory" })
        return
      }
    }

    if (previousRoute && trialGatedStackRoutes.has(previousRoute.name)) {
      navigation.dispatch(StackActions.pop(Math.min(2, state.index)))
      return
    }

    navigation.goBack()
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} style={styles.screen}>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("authScreenLayout:closeButton")}
          onPress={closeToPreviousScreen}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
        >
          <Ionicons name="close" size={24} color={theme.colors.foreground} />
        </Pressable>

        <View style={styles.iconContainer}>
          <Ionicons name="time-outline" size={36} color={theme.colors.accent} />
        </View>

        <Text
          tx="trialExpiredScreen:title"
          weight="bold"
          size="xl"
          style={styles.title}
          accessibilityRole="header"
        />
        <Text tx="trialExpiredScreen:message" size="md" style={styles.message} />

        <Button
          tx="trialExpiredScreen:goToProfile"
          onPress={goToProfile}
          fullWidth
          style={styles.goToProfileButton}
          TextProps={{ style: styles.goToProfileButtonText }}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  card: {
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    maxWidth: 420,
    padding: theme.spacing.xl,
    width: "100%",
    ...theme.shadows.lg,
  },
  closeButton: {
    alignItems: "center",
    borderRadius: theme.radius.full,
    height: 40,
    justifyContent: "center",
    position: "absolute",
    right: theme.spacing.md,
    top: theme.spacing.md,
    width: 40,
  },
  closeButtonPressed: {
    opacity: 0.6,
  },
  iconContainer: {
    alignItems: "center",
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.full,
    height: 72,
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
    width: 72,
  },
  title: {
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  message: {
    color: theme.colors.foregroundSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
    textAlign: "center",
  },
  goToProfileButton: {
    backgroundColor: theme.colors.accent,
  },
  goToProfileButtonText: {
    color: theme.colors.accentForeground,
    flex: 1,
    textAlign: "center",
  },
}))
