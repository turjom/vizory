import { FC, useCallback } from "react"
import { FlatList, Pressable, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Button, Card, EmptyState, Header, Screen, Spinner, Text } from "@/components"
import { useSkusQuery } from "@/hooks"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"

interface SkuListScreenProps extends MainTabScreenProps<"Inventory"> {}

export const SkuListScreen: FC<SkuListScreenProps> = function SkuListScreen({ navigation }) {
  const { theme } = useUnistyles()
  const { data: skus = [], isLoading, isRefetching, error, refetch } = useSkusQuery()

  const handleNavigateToAddSku = useCallback(() => {
    navigation.navigate("AddSku")
  }, [navigation])

  const handleRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

  const keyExtractor = useCallback((item: (typeof skus)[number]) => item.id, [])

  const renderItem = useCallback(
    ({ item }: { item: (typeof skus)[number] }) => (
      <Card
        preset="outlined"
        style={styles.skuCard}
        onLongPress={() => navigation.navigate("SkuDetail", { skuId: item.id })}
        onPress={() =>
          navigation.navigate("InventoryAdjustment", {
            skuId: item.id,
            skuName: item.name,
            currentQuantity: item.totalQuantity,
          })
        }
        ContentComponent={
          <View style={styles.cardContent}>
            <View style={styles.titleRow}>
              <Text weight="semiBold" size="lg" style={styles.titleText}>
                {item.name}
              </Text>
              <Pressable
                style={styles.infoButton}
                onPress={() => navigation.navigate("SkuDetail", { skuId: item.id })}
                hitSlop={8}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={theme.colors.foregroundSecondary}
                />
              </Pressable>
            </View>
            <Text size="sm" color="secondary">
              {item.skuCode}
            </Text>
            <View style={styles.quantityRow}>
              <Text size="sm" tx="skuListScreen:quantityLabel" />
              <Text weight="bold" size="md">
                {item.totalQuantity}
              </Text>
            </View>
          </View>
        }
      />
    ),
    [navigation, theme.colors.foregroundSecondary],
  )

  if (isLoading) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header titleTx="skuListScreen:title" rightText="+" onRightPress={handleNavigateToAddSku} />
        <View style={styles.centered}>
          <Spinner size="lg" />
        </View>
      </Screen>
    )
  }

  if (error) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header titleTx="skuListScreen:title" rightText="+" onRightPress={handleNavigateToAddSku} />
        <View style={styles.centered}>
          <EmptyState
            preset="error"
            headingTx="skuListScreen:loadErrorTitle"
            content={error.message}
            buttonTx="skuListScreen:retry"
            buttonOnPress={handleRefresh}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
      <Header titleTx="skuListScreen:title" rightText="+" onRightPress={handleNavigateToAddSku} />
      <FlatList
        data={skus}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, skus.length === 0 && styles.emptyListContent]}
        onRefresh={handleRefresh}
        refreshing={isRefetching}
        ListHeaderComponent={
          skus.length > 0 ? (
            <Button
              variant="secondary"
              tx="skuListScreen:stockTakeButton"
              onPress={() => navigation.navigate("StockTake")}
              fullWidth
              style={styles.listHeaderButton}
            />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="components"
            headingTx="skuListScreen:emptyTitle"
            contentTx="skuListScreen:emptyDescription"
            buttonTx="skuListScreen:addFirstSku"
            buttonOnPress={handleNavigateToAddSku}
          />
        }
      />
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
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing["2xl"],
  },
  listHeaderButton: {
    marginBottom: theme.spacing.sm,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  skuCard: {
    minHeight: 0,
    marginBottom: theme.spacing.sm,
  },
  cardContent: {
    gap: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  titleText: {
    flex: 1,
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.backgroundSecondary,
  },
  quantityRow: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
}))
