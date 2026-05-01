import { FC, useCallback, useMemo, useState } from "react"
import { FlatList, Pressable, View } from "react-native"
import { StyleSheet } from "react-native-unistyles"

import { Card, EmptyState, Header, Screen, Spinner, Text, TextField } from "@/components"
import { useAuth, useSkusQuery } from "@/hooks"
import { SKU_LIST_QUERY_TIMEOUT_MESSAGE } from "@/hooks/queries/useSkusQuery"
import { translate } from "@/i18n"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"

interface SkuListScreenProps extends MainTabScreenProps<"Inventory"> {}

export const SkuListScreen: FC<SkuListScreenProps> = function SkuListScreen({ navigation }) {
  const { userId, isLoading: authLoading } = useAuth()
  const { data, isPending, isFetching, isRefetching, isError, error, refetch } = useSkusQuery()
  const skus = data ?? []
  const awaitingFirstSkuData =
    Boolean(userId) && data === undefined && (isPending || isFetching) && !isError
  const [searchQuery, setSearchQuery] = useState("")

  const handleNavigateToAddSku = useCallback(() => {
    navigation.navigate("Add")
  }, [navigation])

  const handleRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

  const filteredSkus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return skus
    return skus.filter(
      (sku) =>
        sku.name.toLowerCase().includes(q) || sku.skuCode.toLowerCase().includes(q),
    )
  }, [skus, searchQuery])

  const keyExtractor = useCallback((item: (typeof skus)[number]) => item.id, [])

  const renderItem = useCallback(
    ({ item }: { item: (typeof skus)[number] }) => (
      <Card
        preset="outlined"
        style={styles.skuCard}
        onLongPress={() => navigation.navigate("SkuDetail", { skuId: item.id })}
        onPress={() => navigation.navigate("SkuDetail", { skuId: item.id })}
        ContentComponent={
          <View style={styles.cardContent}>
            <View style={styles.titleRow}>
              <Text weight="semiBold" size="lg" style={styles.titleText}>
                {item.name}
              </Text>
            </View>
            <Text size="sm" color="secondary">
              {item.skuCode}
            </Text>
            <View style={styles.quantityRow}>
              <Text tx="skuListScreen:quantityLabel" style={styles.quantityLabel} />
              <Text style={styles.quantityValue}>{item.totalQuantity}</Text>
            </View>
          </View>
        }
      />
    ),
    [navigation],
  )

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <TextField
          placeholderTx="skuListScreen:searchPlaceholder"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          containerStyle={styles.searchField}
        />
        {skus.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("StockTake")}
            style={({ pressed }) => [styles.stockTakeButton, pressed && styles.stockTakeButtonPressed]}
          >
            <Text weight="semiBold" tx="skuListScreen:stockTakeButton" style={styles.stockTakeButtonText} />
          </Pressable>
        ) : null}
      </View>
    ),
    [navigation, searchQuery, skus.length],
  )

  if (authLoading || awaitingFirstSkuData) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header titleTypography="tab" titleTx="skuListScreen:title" />
        <View style={styles.centered}>
          <Spinner size="lg" />
        </View>
      </Screen>
    )
  }

  if (isError && error) {
    const errorContent =
      error instanceof Error && error.message === SKU_LIST_QUERY_TIMEOUT_MESSAGE
        ? translate("skuListScreen:timeoutError")
        : error instanceof Error
          ? error.message
          : translate("skuListScreen:loadErrorTitle")

    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header titleTypography="tab" titleTx="skuListScreen:title" />
        <View style={styles.centered}>
          <EmptyState
            preset="error"
            headingTx="skuListScreen:loadErrorTitle"
            content={errorContent}
            buttonTx="skuListScreen:retry"
            buttonOnPress={handleRefresh}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
      <Header titleTypography="tab" titleTx="skuListScreen:title" />
      <FlatList
        data={filteredSkus}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          filteredSkus.length === 0 && styles.emptyListContent,
        ]}
        onRefresh={handleRefresh}
        refreshing={isRefetching}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          skus.length === 0 ? (
            <EmptyState
              icon="components"
              headingTx="skuListScreen:emptyTitle"
              contentTx="skuListScreen:emptyDescription"
              buttonTx="skuListScreen:addFirstSku"
              buttonOnPress={handleNavigateToAddSku}
            />
          ) : (
            <View style={styles.noSearchResults}>
              <Text size="sm" color="secondary" tx="skuListScreen:noSearchResults" />
            </View>
          )
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
  listHeader: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  searchField: {
    marginBottom: 0,
  },
  stockTakeButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: theme.sizes.button.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.card,
  },
  stockTakeButtonPressed: {
    opacity: 0.85,
  },
  stockTakeButtonText: {
    color: theme.colors.accent,
    fontSize: theme.typography.sizes.base,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  noSearchResults: {
    paddingVertical: theme.spacing.xl,
    alignItems: "center",
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
  quantityRow: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  quantityLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.palette.gray500,
  },
  quantityValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: "700",
    color: theme.colors.foreground,
  },
}))
