import { FC, useCallback } from "react"
import { RefreshControl, View } from "react-native"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Button, Card, EmptyState, Header, Screen, ScrollView, Spinner, Text } from "@/components"
import { useDashboardInventoryQuery } from "@/hooks"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"

interface DashboardScreenProps extends MainTabScreenProps<"Home"> {}

export const DashboardScreen: FC<DashboardScreenProps> = function DashboardScreen({ navigation }) {
  const { theme } = useUnistyles()
  const { data, isLoading, error, refetch, isRefetching } = useDashboardInventoryQuery()

  const handleRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

  if (isLoading) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header
          titleTx="dashboardScreen:title"
          rightText="+"
          onRightPress={() => navigation.navigate("AddSku")}
        />
        <View style={styles.centered}>
          <Spinner size="lg" />
        </View>
      </Screen>
    )
  }

  if (error) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header
          titleTx="dashboardScreen:title"
          rightText="+"
          onRightPress={() => navigation.navigate("AddSku")}
        />
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

  const { lowStockSkus, topSkusByQuantity, weeklyMovement } = data ?? {
    lowStockSkus: [],
    topSkusByQuantity: [],
    weeklyMovement: { received: 0, sold: 0 },
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
      <Header
        titleTx="dashboardScreen:title"
        rightText="+"
        onRightPress={() => navigation.navigate("AddSku")}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.background}
          />
        }
      >
        <View style={styles.content}>
          <Button
            variant="secondary"
            tx="dashboardScreen:stockTakeButton"
            onPress={() => navigation.navigate("StockTake")}
            fullWidth
          />
          <Text preset="subheading" tx="dashboardScreen:lowStockTitle" style={styles.sectionTitle} />
          <Card
            preset="outlined"
            style={styles.widgetCard}
            ContentComponent={
              lowStockSkus.length === 0 ? (
                <EmptyState
                  icon="bell"
                  headingTx="dashboardScreen:lowStockEmptyHeading"
                  contentTx="dashboardScreen:lowStockEmptyContent"
                />
              ) : (
                <View style={styles.list}>
                  {lowStockSkus.map((sku) => (
                    <Card
                      key={sku.id}
                      preset="outlined"
                      style={styles.rowCard}
                      onPress={() => navigation.navigate("SkuDetail", { skuId: sku.id })}
                      ContentComponent={
                        <View style={styles.rowInner}>
                          <Text weight="semiBold" numberOfLines={1} style={styles.rowTitle}>
                            {sku.name}
                          </Text>
                          <View style={styles.rowMeta}>
                            <Text size="sm" color="secondary" tx="dashboardScreen:quantityShortLabel" />
                            <Text size="sm" weight="medium">
                              {sku.totalQuantity}
                            </Text>
                            <Text size="sm" color="secondary" tx="dashboardScreen:thresholdShortLabel" />
                            <Text size="sm" weight="medium">
                              {sku.safetyStockThreshold}
                            </Text>
                          </View>
                        </View>
                      }
                    />
                  ))}
                </View>
              )
            }
          />

          <Text preset="subheading" tx="dashboardScreen:topSkusTitle" style={styles.sectionTitle} />
          <Card
            preset="outlined"
            style={styles.widgetCard}
            ContentComponent={
              topSkusByQuantity.length === 0 ? (
                <EmptyState
                  icon="view"
                  headingTx="dashboardScreen:topSkusEmptyHeading"
                  contentTx="dashboardScreen:topSkusEmptyContent"
                />
              ) : (
                <View style={styles.list}>
                  {topSkusByQuantity.map((sku, index) => (
                    <Card
                      key={sku.id}
                      preset="outlined"
                      style={styles.rowCard}
                      onPress={() => navigation.navigate("SkuDetail", { skuId: sku.id })}
                      ContentComponent={
                        <View style={styles.rowInner}>
                          <View style={styles.rankRow}>
                            <Text size="sm" color="secondary">
                              #{index + 1}
                            </Text>
                            <Text weight="semiBold" numberOfLines={1} style={styles.rowTitle}>
                              {sku.name}
                            </Text>
                          </View>
                          <View style={styles.rowMeta}>
                            <Text size="sm" color="secondary" tx="dashboardScreen:quantityShortLabel" />
                            <Text size="sm" weight="medium">
                              {sku.totalQuantity}
                            </Text>
                          </View>
                        </View>
                      }
                    />
                  ))}
                </View>
              )
            }
          />

          <Text preset="subheading" tx="dashboardScreen:weeklyTitle" style={styles.sectionTitle} />
          <Card
            preset="outlined"
            style={styles.widgetCard}
            ContentComponent={
              <View style={styles.weeklyGrid}>
                <View style={styles.weeklyCell}>
                  <Text size="sm" color="secondary" tx="dashboardScreen:weeklyReceivedLabel" />
                  <Text weight="bold" size="2xl">
                    {weeklyMovement.received}
                  </Text>
                </View>
                <View style={styles.weeklyCell}>
                  <Text size="sm" color="secondary" tx="dashboardScreen:weeklySoldLabel" />
                  <Text weight="bold" size="2xl">
                    {weeklyMovement.sold}
                  </Text>
                </View>
              </View>
            }
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing["2xl"],
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  widgetCard: {
    minHeight: 0,
  },
  list: {
    gap: theme.spacing.sm,
  },
  rowCard: {
    minHeight: 0,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  rowInner: {
    gap: theme.spacing.xs,
  },
  rowTitle: {
    flexShrink: 1,
  },
  rowMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  weeklyGrid: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  weeklyCell: {
    flex: 1,
    gap: theme.spacing.xs,
  },
}))
