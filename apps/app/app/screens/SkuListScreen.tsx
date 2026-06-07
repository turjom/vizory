import { FC, lazy, Suspense, useCallback, useMemo, useState } from "react"
import { FlatList, Platform, Pressable, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import {
  Card,
  EmptyState,
  Header,
  Screen,
  Spinner,
  Text,
  TextField,
  useToast,
  type TextFieldAccessoryProps,
} from "@/components"
import { useAuth, useSkusQuery } from "@/hooks"
import { SKU_LIST_QUERY_TIMEOUT_MESSAGE } from "@/hooks/queries/useSkusQuery"
import { translate } from "@/i18n"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"

interface SkuListScreenProps extends MainTabScreenProps<"Inventory"> {}

const LazyAddSkuBarcodeScannerModal = lazy(() => import("./AddSkuBarcodeScannerModal"))

export const SkuListScreen: FC<SkuListScreenProps> = function SkuListScreen({ navigation }) {
  const { theme } = useUnistyles()
  const toast = useToast()
  const { userId, isLoading: authLoading } = useAuth()
  const { data, isLoading: skusLoading, isError, error, refetch } = useSkusQuery()
  const skus = useMemo(() => data ?? [], [data])
  const awaitingFirstSkuData = Boolean(userId) && data === undefined && skusLoading && !isError
  const [searchQuery, setSearchQuery] = useState("")
  const [skuScannerVisible, setSkuScannerVisible] = useState(false)
  const [pullRefreshing, setPullRefreshing] = useState(false)

  // Inventory stays mounted under StockTake; refetch when the tab regains focus so quantities update.
  useFocusEffect(
    useCallback(() => {
      if (data === undefined) return
      void refetch()
    }, [refetch, data]),
  )

  const closeSkuScanner = useCallback(() => {
    setSkuScannerVisible(false)
  }, [])

  const handleNavigateToAddSku = useCallback(() => {
    navigation.navigate("Add")
  }, [navigation])

  const handleRefresh = useCallback(async () => {
    setPullRefreshing(true)
    try {
      await refetch()
    } finally {
      setPullRefreshing(false)
    }
  }, [refetch])

  const openSkuBarcodeScanner = useCallback(() => {
    if (Platform.OS === "web") {
      toast.show({
        title: translate("addSkuScreen:barcodeScannerUnavailableWeb"),
        variant: "error",
      })
      return
    }
    setSkuScannerVisible(true)
  }, [toast])

  const handleBarcodeScanned = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setSearchQuery(trimmed)
    setSkuScannerVisible(false)
  }, [])

  const searchBarcodeAccessory = useCallback(
    (accessoryProps: TextFieldAccessoryProps) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate("addSkuScreen:skuCodeScanBarcodeAccessibility")}
        onPress={openSkuBarcodeScanner}
        hitSlop={12}
        style={[accessoryProps.style, styles.searchBarcodeAccessoryHit]}
        disabled={!accessoryProps.editable}
      >
        <Ionicons name="camera-outline" size={22} color={theme.colors.foregroundSecondary} />
      </Pressable>
    ),
    [openSkuBarcodeScanner, theme.colors.foregroundSecondary],
  )

  const filteredSkus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return skus
    return skus.filter(
      (sku) => sku.name.toLowerCase().includes(q) || sku.skuCode.toLowerCase().includes(q),
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
          RightAccessory={searchBarcodeAccessory}
          containerStyle={styles.searchField}
        />
        {skus.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("StockTake")}
            style={({ pressed }) => [
              styles.stockTakeButton,
              pressed && styles.stockTakeButtonPressed,
            ]}
          >
            <Text
              weight="semiBold"
              tx="skuListScreen:stockTakeButton"
              style={styles.stockTakeButtonText}
            />
          </Pressable>
        ) : null}
      </View>
    ),
    [navigation, searchBarcodeAccessory, searchQuery, skus.length],
  )

  if (authLoading || awaitingFirstSkuData) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header titleTypography="tab" titleTx="skuListScreen:title" safeAreaEdges={[]} />
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
        <Header titleTypography="tab" titleTx="skuListScreen:title" safeAreaEdges={[]} />
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
      <Header titleTypography="tab" titleTx="skuListScreen:title" safeAreaEdges={[]} />
      <FlatList
        data={filteredSkus}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          filteredSkus.length === 0 && styles.emptyListContent,
        ]}
        onRefresh={handleRefresh}
        refreshing={pullRefreshing}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          skus.length === 0 ? (
            <EmptyState
              icon="components"
              headingTx="skuListScreen:emptyTitle"
              contentTx="skuListScreen:emptyDescription"
              buttonTx="skuListScreen:addFirstSku"
              buttonOnPress={handleNavigateToAddSku}
              buttonStyle={styles.emptyStateButton}
              ButtonProps={{ TextProps: { style: styles.emptyStateButtonText } }}
            />
          ) : (
            <View style={styles.noSearchResults}>
              <Text size="sm" color="secondary" tx="skuListScreen:noSearchResults" />
            </View>
          )
        }
      />
      {skuScannerVisible ? (
        <Suspense fallback={null}>
          <LazyAddSkuBarcodeScannerModal
            visible={skuScannerVisible}
            onClose={closeSkuScanner}
            onBarcodeScanned={handleBarcodeScanned}
          />
        </Suspense>
      ) : null}
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
  searchBarcodeAccessoryHit: {
    padding: theme.spacing.xxs,
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
  emptyStateButton: {
    backgroundColor: theme.colors.accent,
  },
  emptyStateButtonText: {
    color: theme.colors.accentForeground,
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
