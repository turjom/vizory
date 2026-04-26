import { FC, useCallback, useMemo, useState } from "react"
import { FlatList, View } from "react-native"
import { StyleSheet } from "react-native-unistyles"

import { Card, EmptyState, Header, Screen, Spinner, Text, TextField } from "@/components"
import { useSkusQuery } from "@/hooks"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"

interface SearchScreenProps extends MainTabScreenProps<"Search"> {}

function skuCodeNorm(code: string): string {
  return String(code ?? "").trim().toLowerCase()
}

export const SearchScreen: FC<SearchScreenProps> = function SearchScreen({ navigation }) {
  const [query, setQuery] = useState("")
  const { data: skus = [], isLoading, error, refetch } = useSkusQuery()

  const trimmedQuery = query.trim()
  const queryLower = trimmedQuery.toLowerCase()

  const filteredSkus = useMemo(() => {
    if (queryLower.length === 0) return []
    return skus.filter((sku) => {
      const nameMatch = sku.name.toLowerCase().includes(queryLower)
      const code = skuCodeNorm(sku.skuCode)
      const codeMatch = code.length > 0 && code.includes(queryLower)
      return nameMatch || codeMatch
    })
  }, [skus, queryLower])

  const keyExtractor = useCallback((item: (typeof skus)[number]) => item.id, [])

  const renderItem = useCallback(
    ({ item }: { item: (typeof skus)[number] }) => (
      <Card
        preset="outlined"
        style={styles.resultCard}
        onPress={() => navigation.navigate("SkuDetail", { skuId: item.id })}
        ContentComponent={
          <View style={styles.cardContent}>
            <Text weight="semiBold" size="lg" numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.metaRow}>
              <Text size="sm" color="secondary" tx="searchScreen:skuCodeLabel" />
              {skuCodeNorm(item.skuCode).length > 0 ? (
                <Text size="sm" numberOfLines={1} style={styles.codeValue}>
                  {item.skuCode}
                </Text>
              ) : (
                <Text size="sm" color="secondary" style={styles.codeValue} tx="searchScreen:noSkuCode" />
              )}
            </View>
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
    [navigation],
  )

  const listHeader = useMemo(
    () => (
      <View style={styles.searchSection}>
        <TextField
          labelTx="searchScreen:searchLabel"
          placeholderTx="searchScreen:searchPlaceholder"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
    ),
    [query],
  )

  if (isLoading) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header titleTx="searchScreen:title" />
        <View style={styles.centered}>
          <Spinner size="lg" />
        </View>
      </Screen>
    )
  }

  if (error) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <Header titleTx="searchScreen:title" />
        <View style={styles.centered}>
          <EmptyState
            preset="error"
            headingTx="searchScreen:errorTitle"
            content={error.message}
            buttonTx="searchScreen:retry"
            buttonOnPress={() => void refetch()}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
      <Header titleTx="searchScreen:title" />
      <FlatList
        data={filteredSkus}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          skus.length === 0 && trimmedQuery.length === 0 ? (
            <EmptyState
              icon="components"
              headingTx="searchScreen:noSkusHeading"
              contentTx="searchScreen:noSkusContent"
            />
          ) : trimmedQuery.length === 0 ? (
            <EmptyState
              icon="view"
              headingTx="searchScreen:emptyPromptHeading"
              contentTx="searchScreen:emptyPromptContent"
            />
          ) : (
            <EmptyState
              icon="view"
              headingTx="searchScreen:noResultsHeading"
              contentTx="searchScreen:noResultsContent"
            />
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
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing["2xl"],
  },
  searchSection: {
    marginBottom: theme.spacing.md,
  },
  resultCard: {
    minHeight: 0,
    marginBottom: theme.spacing.sm,
  },
  cardContent: {
    gap: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  codeValue: {
    flex: 1,
    minWidth: 0,
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
