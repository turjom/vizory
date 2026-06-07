import { FC, useCallback, useEffect, useState } from "react"
import { Platform, View } from "react-native"
import * as LocalAuthentication from "expo-local-authentication"
import { StyleSheet } from "react-native-unistyles"

import { BiometricEnrollmentModal, EmptyState, Header, Screen, Spinner, Text } from "@/components"
import { useAuth, useDashboardInventoryQuery } from "@/hooks"
import type { TxKeyPath } from "@/i18n"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import {
  getBiometricEnrollmentPrompted,
  setBiometricEnabled,
  setBiometricEnrollmentPrompted,
} from "@/services/biometricSessionStorage"

interface DashboardScreenProps extends MainTabScreenProps<"Home"> {}

type GreetingPeriod = "Morning" | "Afternoon" | "Evening"

function getGreetingPeriod(): GreetingPeriod {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return "Morning"
  if (hour >= 12 && hour < 18) return "Afternoon"
  return "Evening"
}

export const DashboardScreen: FC<DashboardScreenProps> = function DashboardScreen() {
  const { user } = useAuth()
  const { data, isLoading, error, refetch } = useDashboardInventoryQuery(user?.firstName ?? null)
  const [enrollmentModalVisible, setEnrollmentModalVisible] = useState(false)

  const handleRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    // TEMP: [BiometricDiag] remove after fixing biometric enrollment visibility
    console.log("[BiometricDiag] Dashboard effect fired", {
      platform: Platform.OS,
      userId: user?.id ?? null,
      isLoading,
      hasError: !!error,
    })
    if (Platform.OS === "web" || !user?.id || isLoading || error) {
      console.log("[BiometricDiag] Dashboard effect early return (no async check)", {
        isWeb: Platform.OS === "web",
        hasUserId: !!user?.id,
        isLoading,
        hasError: !!error,
      })
      return undefined
    }
    const userId = user.id
    let cancelled = false
    void (async () => {
      try {
        const prompted = await getBiometricEnrollmentPrompted(userId)
        console.log("[BiometricDiag] Dashboard getBiometricEnrollmentPrompted done", {
          prompted,
          cancelled,
        })
        if (cancelled || prompted) {
          console.log("[BiometricDiag] Dashboard skip modal: cancelled or already prompted", {
            cancelled,
            prompted,
          })
          return
        }
        const [hasHardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ])
        console.log("[BiometricDiag] Dashboard LocalAuthentication", {
          hasHardware,
          enrolled,
          simulatorNote:
            "iOS Simulator often returns false for isEnrolledAsync unless enrolled in Features > Face ID",
        })
        if (!hasHardware) {
          console.log("[BiometricDiag] Dashboard no biometric hardware — mark prompted, skip modal")
          await setBiometricEnrollmentPrompted(true, userId)
          await setBiometricEnabled(false)
          return
        }
        if (!enrolled) {
          console.log(
            "[BiometricDiag] Dashboard hardware present but biometrics not enrolled — silent skip (no SecureStore)",
          )
          return
        }
        if (!cancelled) {
          console.log("[BiometricDiag] Dashboard setEnrollmentModalVisible(true)")
          setEnrollmentModalVisible(true)
        } else {
          console.log("[BiometricDiag] Dashboard would show modal but effect cancelled")
        }
      } catch (e) {
        console.log("[BiometricDiag] Dashboard biometric effect catch — marking prompted", {
          error: String(e),
        })
        await setBiometricEnrollmentPrompted(true, userId)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, isLoading, error])

  if (isLoading) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header titleTypography="tab" titleTx="dashboardScreen:title" safeAreaEdges={[]} />
        <View style={styles.centered}>
          <Spinner size="lg" />
        </View>
      </Screen>
    )
  }

  if (error) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header titleTypography="tab" titleTx="dashboardScreen:title" safeAreaEdges={[]} />
        <View style={styles.centered}>
          <EmptyState
            preset="error"
            headingTx="dashboardScreen:errorTitle"
            content={error.message}
            buttonTx="dashboardScreen:retry"
            buttonOnPress={handleRefresh}
          />
        </View>
      </Screen>
    )
  }

  const {
    greetingFirstName,
    lowStockSkus,
    topSkusByQuantity,
    weeklyMovement,
    totalInventoryValue,
  } = data ?? {
    greetingFirstName: null,
    lowStockSkus: [],
    topSkusByQuantity: [],
    weeklyMovement: { received: 0, sold: 0 },
    totalInventoryValue: null,
  }

  const period = getGreetingPeriod()
  const trimmedFirstName = greetingFirstName ?? ""
  const hasFirstName = trimmedFirstName.length > 0
  const greetingKeys = {
    Morning: {
      base: "dashboardScreen:greetingMorning" as TxKeyPath,
      named: "dashboardScreen:greetingMorningWithName" as TxKeyPath,
    },
    Afternoon: {
      base: "dashboardScreen:greetingAfternoon" as TxKeyPath,
      named: "dashboardScreen:greetingAfternoonWithName" as TxKeyPath,
    },
    Evening: {
      base: "dashboardScreen:greetingEvening" as TxKeyPath,
      named: "dashboardScreen:greetingEveningWithName" as TxKeyPath,
    },
  }[period]
  const greetingTitleTx = hasFirstName ? greetingKeys.named : greetingKeys.base
  const greetingTitleTxOptions = hasFirstName ? { firstName: trimmedFirstName } : undefined

  return (
    <>
      <Screen preset="scroll" safeAreaEdges={["top", "bottom"]}>
        <Header
          titleTypography="tab"
          titleTx={greetingTitleTx}
          titleTxOptions={greetingTitleTxOptions}
          safeAreaEdges={[]}
        />
        <View style={styles.content}>
          {/* Hero Card */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>TOTAL INVENTORY VALUE</Text>
            <Text style={styles.heroValue}>
              {totalInventoryValue != null ? `$${totalInventoryValue.toFixed(2)}` : "N/A"}
            </Text>
            <Text style={styles.heroSub}>
              {totalInventoryValue != null
                ? "Total value of current stock"
                : "Add prices to SKUs to calculate"}
            </Text>
          </View>
          <View style={styles.divider} />
          {/* Low Stock Alerts */}
          <Text style={styles.sectionHeader}>Low Stock Alerts</Text>
          {lowStockSkus.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>All items are well stocked</Text>
            </View>
          ) : (
            lowStockSkus.map((sku) => (
              <View key={sku.id} style={styles.alertCard}>
                <View style={styles.alertLeft}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {sku.name}
                  </Text>
                  <Text style={styles.itemMeta}>Min: {sku.safetyStockThreshold}</Text>
                </View>
                <Text style={styles.alertQty}>{sku.totalQuantity}</Text>
              </View>
            ))
          )}
          <View style={styles.divider} />

          {/* Top SKUs */}
          <Text style={styles.sectionHeader}>Top SKUs by Stock</Text>
          <View style={styles.flatCard}>
            {topSkusByQuantity.map((sku, index) => (
              <View key={sku.id} style={[styles.skuRow, index > 0 && styles.skuRowBorder]}>
                <Text style={styles.rankText}>#{index + 1}</Text>
                <Text style={styles.itemName} numberOfLines={1}>
                  {sku.name}
                </Text>
                <Text style={styles.skuQty}>{sku.totalQuantity}</Text>
              </View>
            ))}
          </View>
          <View style={styles.divider} />

          {/* Weekly Movement */}
          <Text style={styles.sectionHeader}>Weekly Movement</Text>
          <View style={styles.flatCard}>
            <View style={styles.weeklyRow}>
              <View style={styles.weeklyCell}>
                <Text style={styles.weeklyLabel}>RECEIVED</Text>
                <Text style={styles.weeklyValue}>{weeklyMovement.received}</Text>
              </View>
              <View style={styles.weeklySeparator} />
              <View style={styles.weeklyCell}>
                <Text style={styles.weeklyLabel}>SOLD</Text>
                <Text style={styles.weeklyValue}>{weeklyMovement.sold}</Text>
              </View>
            </View>
          </View>
        </View>
      </Screen>
      <BiometricEnrollmentModal
        visible={enrollmentModalVisible}
        userId={user?.id ?? ""}
        userEmail={user?.email ?? null}
        onClose={() => setEnrollmentModalVisible(false)}
      />
    </>
  )
}

const styles = StyleSheet.create((theme) => ({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  heroCard: {
    backgroundColor: theme.colors.accent,
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.accentForeground,
    letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    color: theme.colors.accentForeground,
    marginTop: 4,
  },
  heroSub: {
    fontSize: 12,
    color: theme.colors.accentForeground,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.foreground,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    color: theme.colors.foregroundSecondary,
  },
  alertCard: {
    backgroundColor: theme.colors.errorBackground,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
    marginBottom: 6,
  },
  alertLeft: {
    flex: 1,
    marginRight: 12,
  },
  alertQty: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    color: theme.colors.error,
    flexShrink: 0,
  },
  flatCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 20,
    paddingVertical: 14,
    gap: 10,
  },
  skuRowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  rankText: {
    fontSize: 14,
    color: theme.colors.foregroundSecondary,
    fontWeight: "600",
    width: 24,
    flexShrink: 0,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.foreground,
    flex: 1,
  },
  itemMeta: {
    fontSize: 12,
    color: theme.colors.foregroundSecondary,
    marginTop: 2,
  },
  skuQty: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    color: theme.colors.foreground,
    flexShrink: 0,
  },
  weeklyRow: {
    flexDirection: "row",
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 16,
    paddingRight: 16,
  },
  weeklyCell: {
    flex: 1,
    alignItems: "center",
  },
  weeklySeparator: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  weeklyLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.foregroundSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  weeklyValue: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    color: theme.colors.foreground,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  divider: {
    backgroundColor: theme.colors.border,
    height: 1,
    marginVertical: 4,
  },
}))
