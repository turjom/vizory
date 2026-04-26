import { FC, useMemo } from "react"
import { View } from "react-native"
import { StyleSheet } from "react-native-unistyles"

import { Button, Card, Container, EmptyState, Header, Spinner, Text } from "@/components"
import { useSkuDetailQuery } from "@/hooks"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"

interface SkuDetailScreenProps extends AppStackScreenProps<"SkuDetail"> {}

export const SkuDetailScreen: FC<SkuDetailScreenProps> = function SkuDetailScreen({
  navigation,
  route,
}) {
  const { skuId } = route.params
  const { data, isLoading, error } = useSkuDetailQuery(skuId)

  const formattedPrice = useMemo(() => {
    if (!data?.sku.price && data?.sku.price !== 0) return "-"
    return `$${Number(data.sku.price).toFixed(2)}`
  }, [data?.sku.price])

  if (isLoading) {
    return (
      <Container safeAreaEdges={["bottom"]}>
        <Header
          titleTx="skuDetailScreen:title"
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
          safeAreaEdges={["top"]}
        />
        <View style={styles.centered}>
          <Spinner size="lg" />
        </View>
      </Container>
    )
  }

  if (error || !data) {
    return (
      <Container safeAreaEdges={["bottom"]}>
        <Header
          titleTx="skuDetailScreen:title"
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
          safeAreaEdges={["top"]}
        />
        <View style={styles.centered}>
          <EmptyState
            preset="error"
            headingTx="skuDetailScreen:errorTitle"
            content={error instanceof Error ? error.message : undefined}
          />
        </View>
      </Container>
    )
  }

  const { sku, currentQuantity, adjustments } = data

  return (
    <Container safeAreaEdges={["bottom"]}>
      <Header
        titleTx="skuDetailScreen:title"
        leftIcon="back"
        rightTx="skuDetailScreen:editButton"
        onLeftPress={() => navigation.goBack()}
        onRightPress={() =>
          navigation.navigate("AddSku", {
            mode: "edit",
            sku: {
              id: sku.id,
              name: sku.name,
              sku_code: sku.sku_code,
              description: sku.description,
              price: sku.price,
              uom: sku.uom,
              safety_stock_threshold: sku.safety_stock_threshold,
            },
          })
        }
        safeAreaEdges={["top"]}
      />

      <Container preset="scroll" contentContainerStyle={styles.content}>
        <Card
          preset="outlined"
          style={styles.sectionCard}
          ContentComponent={
            <View style={styles.sectionContent}>
              <Text tx="skuDetailScreen:nameLabel" color="secondary" size="sm" />
              <Text weight="bold" size="xl">
                {sku.name}
              </Text>
              <View style={styles.fieldRow}>
                <Text tx="skuDetailScreen:skuCodeLabel" color="secondary" />
                <Text>{sku.sku_code || "-"}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text tx="skuDetailScreen:descriptionLabel" color="secondary" />
                <Text style={styles.valueText}>{sku.description || "-"}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text tx="skuDetailScreen:priceLabel" color="secondary" />
                <Text>{formattedPrice}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text tx="skuDetailScreen:uomLabel" color="secondary" />
                <Text>{sku.uom || "-"}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text tx="skuDetailScreen:safetyStockLabel" color="secondary" />
                <Text>{sku.safety_stock_threshold}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text tx="skuDetailScreen:currentQuantityLabel" color="secondary" />
                <Text weight="bold">{currentQuantity}</Text>
              </View>
            </View>
          }
        />

        <Button
          tx="skuDetailScreen:adjustInventoryButton"
          onPress={() =>
            navigation.navigate("InventoryAdjustment", {
              skuId: sku.id,
              skuName: sku.name,
              currentQuantity,
            })
          }
          fullWidth
        />

        <Text tx="skuDetailScreen:historyTitle" size="lg" weight="semiBold" />

        {adjustments.length === 0 ? (
          <EmptyState
            icon="components"
            headingTx="skuDetailScreen:historyEmptyTitle"
            contentTx="skuDetailScreen:historyEmptyDescription"
          />
        ) : (
          adjustments.map((adjustment) => (
            <Card
              key={adjustment.id}
              preset="outlined"
              style={styles.sectionCard}
              ContentComponent={
                <View style={styles.sectionContent}>
                  <View style={styles.fieldRow}>
                    <Text tx="skuDetailScreen:historyTypeLabel" color="secondary" />
                    <Text
                      weight="semiBold"
                      tx={
                        adjustment.adjustment_type === "PURCHASE"
                          ? "skuDetailScreen:typePurchase"
                          : "skuDetailScreen:typeSale"
                      }
                    />
                  </View>
                  <View style={styles.fieldRow}>
                    <Text tx="skuDetailScreen:historyQuantityLabel" color="secondary" />
                    <Text>{adjustment.quantity}</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text tx="skuDetailScreen:historyReferenceLabel" color="secondary" />
                    <Text style={styles.valueText}>{adjustment.reference_note || "-"}</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text tx="skuDetailScreen:historyDateLabel" color="secondary" />
                    <Text>
                      {adjustment.created_at
                        ? new Date(adjustment.created_at).toLocaleString()
                        : "-"}
                    </Text>
                  </View>
                </View>
              }
            />
          ))
        )}
      </Container>
    </Container>
  )
}

const styles = StyleSheet.create((theme) => ({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing["2xl"],
    gap: theme.spacing.md,
  },
  sectionCard: {
    minHeight: 0,
  },
  sectionContent: {
    gap: theme.spacing.sm,
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    alignItems: "flex-start",
  },
  valueText: {
    flex: 1,
    textAlign: "right",
  },
}))
