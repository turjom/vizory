import { FC, useMemo } from "react"
import { Platform, ScrollView, View } from "react-native"
import { format, parseISO } from "date-fns"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Button, Container, EmptyState, Header, Spinner, Text } from "@/components"
import { useSkuDetailQuery } from "@/hooks"
import type { TxKeyPath } from "@/i18n"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"

const SKU_DETAIL_SCROLL_PROPS =
  Platform.OS === "ios"
    ? ({
        contentInsetAdjustmentBehavior: "never",
        automaticallyAdjustContentInsets: false,
      } as const)
    : undefined

interface SkuDetailScreenProps extends AppStackScreenProps<"SkuDetail"> {}

type AdjustmentType = "PURCHASE" | "SALE" | "STOCK_TAKE" | string

function formatHistoryDate(iso: string | null, emptyLabel: string): string {
  if (!iso) return emptyLabel
  try {
    return format(parseISO(iso), "MMM d · h:mm a")
  } catch {
    return emptyLabel
  }
}

function pillVisualForType(adjustmentType: AdjustmentType): "purchase" | "sale" | "neutral" {
  if (adjustmentType === "PURCHASE") return "purchase"
  if (adjustmentType === "SALE") return "sale"
  return "neutral"
}

function pillTxForType(adjustmentType: AdjustmentType): TxKeyPath {
  switch (adjustmentType) {
    case "PURCHASE":
      return "skuDetailScreen:timelinePillPurchase"
    case "SALE":
      return "skuDetailScreen:timelinePillSale"
    case "STOCK_TAKE":
      return "skuDetailScreen:timelinePillStockTake"
    case "SCRAP":
      return "skuDetailScreen:timelinePillScrap"
    default:
      return "skuDetailScreen:timelinePillOther"
  }
}

export const SkuDetailScreen: FC<SkuDetailScreenProps> = function SkuDetailScreen({
  navigation,
  route,
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const emptyValue = t("skuDetailScreen:valueEmpty")
  const { skuId } = route.params
  const { data, isLoading, error } = useSkuDetailQuery(skuId)

  const timelinePillLabelColors = useMemo(
    () => ({
      purchase: theme.colors.successForeground,
      sale: theme.colors.errorForeground,
      neutral: theme.colors.foregroundSecondary,
    }),
    [theme],
  )

  const formattedPrice = useMemo(() => {
    if (!data?.sku.price && data?.sku.price !== 0) return emptyValue
    return `$${Number(data.sku.price).toFixed(2)}`
  }, [data?.sku.price, emptyValue])

  if (isLoading) {
    return (
      <Container safeAreaEdges={["bottom"]}>
        <Header
          titleTypography="stack"
          titleTx="skuDetailScreen:title"
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
          safeAreaEdges={[]}
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
          titleTypography="stack"
          titleTx="skuDetailScreen:title"
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
          safeAreaEdges={[]}
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
        titleTypography="stack"
        titleTx="skuDetailScreen:title"
        leftIcon="back"
        rightTx="skuDetailScreen:editButton"
        onLeftPress={() => navigation.goBack()}
        onRightPress={() =>
          navigation.navigate("Main", {
            screen: "Add",
            params: {
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
            },
          })
        }
        safeAreaEdges={[]}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...(SKU_DETAIL_SCROLL_PROPS ?? {})}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.productName}>{sku.name}</Text>
          <Text style={styles.productSku}>{sku.sku_code || emptyValue}</Text>
        </View>

        <View style={styles.heroCard}>
          <Text tx="skuDetailScreen:currentQuantityLabel" style={styles.heroLabel} />
          <Text style={styles.heroQuantity}>{currentQuantity}</Text>
        </View>

        <View style={styles.fieldsSection}>
          <View style={styles.fieldRow}>
            <Text tx="skuDetailScreen:nameLabel" style={styles.fieldLabel} />
            <Text style={styles.fieldValue}>{sku.name}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text tx="skuDetailScreen:skuCodeLabel" style={styles.fieldLabel} />
            <Text style={styles.fieldValue}>{sku.sku_code || emptyValue}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text tx="skuDetailScreen:priceLabel" style={styles.fieldLabel} />
            <Text style={styles.fieldValue}>{formattedPrice}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text tx="skuDetailScreen:uomLabel" style={styles.fieldLabel} />
            <Text style={styles.fieldValue}>{sku.uom || emptyValue}</Text>
          </View>
          <View style={[styles.fieldRow, styles.fieldRowLast]}>
            <Text tx="skuDetailScreen:safetyStockLabel" style={styles.fieldLabel} />
            <Text style={styles.fieldValue}>{sku.safety_stock_threshold}</Text>
          </View>
        </View>

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
          style={styles.adjustInventoryButton}
          TextProps={{ style: styles.adjustInventoryButtonText }}
        />

        <Text tx="skuDetailScreen:historyTitle" style={styles.historySectionTitle} />

        {adjustments.length === 0 ? (
          <EmptyState
            icon="components"
            headingTx="skuDetailScreen:historyEmptyTitle"
            contentTx="skuDetailScreen:historyEmptyDescription"
          />
        ) : (
          <View style={styles.timeline}>
            <View style={[styles.timelineEntry, styles.timelineListHeader]}>
              <View style={styles.timelineLine1}>
                <View style={styles.timelineColType}>
                  <Text
                    tx="skuDetailScreen:historyHeaderType"
                    style={[styles.timelineColumnHeaderLabel, styles.timelineHeaderTypeCell]}
                  />
                </View>
                <View style={styles.timelineColQty}>
                  <Text
                    tx="skuDetailScreen:historyHeaderQty"
                    style={[styles.timelineColumnHeaderLabel, styles.timelineHeaderQtyCell]}
                  />
                </View>
                <View style={styles.timelineColDate}>
                  <Text
                    tx="skuDetailScreen:historyHeaderDate"
                    style={[styles.timelineColumnHeaderLabel, styles.timelineHeaderDateCell]}
                  />
                </View>
              </View>
            </View>
            {adjustments.map((adjustment, index) => {
              const visual = pillVisualForType(adjustment.adjustment_type)
              const pillTx = pillTxForType(adjustment.adjustment_type)
              const pillBg =
                visual === "purchase"
                  ? styles.timelinePill_purchase
                  : visual === "sale"
                    ? styles.timelinePill_sale
                    : styles.timelinePill_neutral
              const isLast = index === adjustments.length - 1
              return (
                <View
                  key={adjustment.id}
                  style={[styles.timelineEntry, !isLast && styles.timelineEntryDivider]}
                >
                  <View style={styles.timelineLine1}>
                    <View style={styles.timelineColType}>
                      <View style={[styles.timelinePill, pillBg]}>
                        <Text
                          tx={pillTx}
                          style={[
                            styles.timelinePillText,
                            { color: timelinePillLabelColors[visual] },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.timelineColQty}>
                      <Text style={styles.timelineQuantity}>{adjustment.quantity}</Text>
                    </View>
                    <View style={styles.timelineColDate}>
                      <Text style={[styles.timelineDate, styles.timelineDateCell]}>
                        {formatHistoryDate(adjustment.created_at, emptyValue)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.timelineReferenceNote}>
                    {adjustment.reference_note?.trim()
                      ? `NOTE: ${adjustment.reference_note.trim()}`
                      : emptyValue}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
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
    paddingBottom: theme.spacing["2xl"],
    gap: theme.spacing.md,
    flexGrow: 0,
  },
  titleBlock: {
    gap: theme.spacing.xxs,
  },
  productName: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.bold,
    fontSize: theme.typography.sizes.xl,
    lineHeight: theme.typography.lineHeights.xl,
  },
  productSku: {
    color: theme.colors.foregroundSecondary,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
  },
  heroCard: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    ...theme.shadows.md,
  },
  heroLabel: {
    color: theme.colors.accentForeground,
    fontFamily: theme.typography.fonts.medium,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
  },
  heroQuantity: {
    color: theme.colors.accentForeground,
    fontFamily: theme.typography.fonts.bold,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  fieldsSection: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    flexShrink: 0,
    width: "38%",
    maxWidth: 140,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.palette.gray500,
    fontFamily: theme.typography.fonts.regular,
  },
  fieldValue: {
    flex: 1,
    textAlign: "right",
    fontSize: theme.typography.sizes.base,
    lineHeight: theme.typography.lineHeights.base,
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.semiBold,
  },
  adjustInventoryButton: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  adjustInventoryButtonText: {
    color: theme.colors.accentForeground,
  },
  historySectionTitle: {
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.lg,
    lineHeight: theme.typography.lineHeights.lg,
    color: theme.colors.foreground,
    marginTop: theme.spacing.xs,
  },
  timeline: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    overflow: "hidden",
  },
  timelineListHeader: {
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  timelineColumnHeaderLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: "#9CA3AF",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  timelineHeaderTypeCell: {
    width: "100%",
    textAlign: "left",
  },
  timelineHeaderQtyCell: {
    width: "100%",
    textAlign: "left",
  },
  timelineHeaderDateCell: {
    width: "100%",
    textAlign: "right",
  },
  timelineColType: {
    flex: 2,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  timelineColQty: {
    flex: 1,
    minWidth: 44,
    maxWidth: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingLeft: theme.spacing.xxs,
  },
  timelineColDate: {
    flex: 2,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  timelineEntry: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  timelineEntryDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  timelineLine1: {
    flexDirection: "row",
    alignItems: "center",
  },
  timelinePill: {
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.full,
  },
  timelinePill_purchase: {
    backgroundColor: theme.colors.successBackground,
  },
  timelinePill_sale: {
    backgroundColor: theme.colors.errorBackground,
  },
  timelinePill_neutral: {
    backgroundColor: theme.colors.backgroundTertiary,
  },
  timelinePillText: {
    fontSize: theme.typography.sizes.xs,
    lineHeight: theme.typography.lineHeights.xs,
    fontFamily: theme.typography.fonts.semiBold,
  },
  timelineQuantity: {
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
    fontFamily: theme.typography.fonts.semiBold,
    color: theme.colors.foreground,
    textAlign: "left",
    width: "100%",
  },
  timelineDate: {
    fontSize: theme.typography.sizes.xs,
    lineHeight: theme.typography.lineHeights.xs,
    color: theme.colors.foregroundSecondary,
    textAlign: "right",
  },
  timelineDateCell: {
    width: "100%",
  },
  timelineReferenceNote: {
    marginTop: theme.spacing.sm,
    width: "100%",
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.palette.gray500,
    fontFamily: theme.typography.fonts.regular,
  },
}))
