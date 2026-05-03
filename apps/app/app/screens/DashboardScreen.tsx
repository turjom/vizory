import { FC, useCallback } from "react"
import { Pressable, View } from "react-native"
import { StyleSheet } from "react-native-unistyles"

import { EmptyState, Header, Screen, Spinner, Text } from "@/components"
import { useDashboardInventoryQuery } from "@/hooks"
import type { TxKeyPath } from "@/i18n"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"

interface DashboardScreenProps extends MainTabScreenProps<"Home"> {}

type GreetingPeriod = "Morning" | "Afternoon" | "Evening"

function getGreetingPeriod(): GreetingPeriod {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return "Morning"
  if (hour >= 12 && hour < 18) return "Afternoon"
  return "Evening"
}

export const DashboardScreen: FC<DashboardScreenProps> = function DashboardScreen({ navigation }) {
  const { data, isLoading, error, refetch, isRefetching } = useDashboardInventoryQuery()
  const handleRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

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

  const { greetingFirstName, lowStockSkus, topSkusByQuantity, weeklyMovement, totalInventoryValue } =
    data ?? {
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
        <View style={{ height: 1, backgroundColor: "#F3F4F6", marginVertical: 4 }} />
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
        <View style={{ height: 1, backgroundColor: "#F3F4F6", marginVertical: 4 }} />

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
        <View style={{ height: 1, backgroundColor: "#F3F4F6", marginVertical: 4 }} />

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
  )
}

const styles = StyleSheet.create((theme) => ({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  heroCard: {
    backgroundColor: "#F97316",
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    color: "#FFFFFF",
    marginTop: 4,
  },
  heroSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    color: "#6B7280",
  },
  alertCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
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
    color: "#EF4444",
    flexShrink: 0,
  },
  flatCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
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
    borderTopColor: "#F3F4F6",
  },
  rankText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
    width: 24,
    flexShrink: 0,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  itemMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  skuQty: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    color: "#111827",
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
    backgroundColor: "#F3F4F6",
    marginVertical: 4,
  },
  weeklyLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  weeklyValue: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    color: "#111827",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
}))
