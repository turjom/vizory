import { FC, useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import { format, parseISO } from "date-fns"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"
import { z } from "zod"

import { Button, Container, Header, Text, TextField, useToast } from "@/components"
import { useAuth, useSkuDetailQuery } from "@/hooks"
import { queryKeys } from "@/hooks/queries"
import { SkuListItem } from "@/hooks/queries/useSkusQuery"
import type { TxKeyPath } from "@/i18n"
import { haptics } from "@/utils/haptics"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { supabase } from "@/services/supabase"

type AdjustmentTab = "PURCHASE" | "SALE" | "SCRAP"

interface InventoryAdjustmentScreenProps extends AppStackScreenProps<"InventoryAdjustment"> {}

function formatRecentDate(iso: string | null, emptyLabel: string): string {
  if (!iso) return emptyLabel
  try {
    return format(parseISO(iso), "MMM d · h:mm a")
  } catch {
    return emptyLabel
  }
}

function pillStyleKeyForType(
  adjustmentType: string,
): "purchase" | "sale" | "neutral" {
  if (adjustmentType === "PURCHASE") return "purchase"
  if (adjustmentType === "SALE") return "sale"
  return "neutral"
}

function pillTxForAdjustmentType(adjustmentType: string): TxKeyPath {
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

export const InventoryAdjustmentScreen: FC<InventoryAdjustmentScreenProps> =
  function InventoryAdjustmentScreen({ navigation, route }) {
    const { t } = useTranslation()
    const { theme } = useUnistyles()
    const queryClient = useQueryClient()
    const toast = useToast()
    const { userId } = useAuth()
    const [saveError, setSaveError] = useState("")
    const [activeTab, setActiveTab] = useState<AdjustmentTab>("PURCHASE")
    const { skuId, skuName, currentQuantity } = route.params

    const { data: skuDetail } = useSkuDetailQuery(skuId)
    const recentAdjustments = useMemo(
      () => (skuDetail?.adjustments ?? []).slice(0, 3),
      [skuDetail?.adjustments],
    )

    const pillLabelColors = useMemo(
      () => ({
        purchase: theme.colors.successForeground,
        sale: theme.colors.errorForeground,
        neutral: theme.colors.foregroundSecondary,
      }),
      [theme],
    )

    const adjustmentSchema = useMemo(
      () =>
        z.object({
          quantity: z
            .string()
            .trim()
            .refine((value) => value !== "" && Number.isInteger(Number(value)), {
              message: t("inventoryAdjustmentScreen:validationQuantityInteger"),
            })
            .refine((value) => Number(value) > 0, {
              message: t("inventoryAdjustmentScreen:validationQuantityPositive"),
            }),
          reference_note: z
            .string()
            .trim()
            .max(300, t("inventoryAdjustmentScreen:validationReferenceNoteMax"))
            .optional(),
        }),
      [t],
    )

    type AdjustmentFormData = z.infer<typeof adjustmentSchema>

    const {
      control,
      handleSubmit,
      reset,
      formState: { isValid },
    } = useForm<AdjustmentFormData>({
      resolver: zodResolver(adjustmentSchema),
      mode: "onChange",
      defaultValues: {
        quantity: "",
        reference_note: "",
      },
    })

    const adjustmentMutation = useMutation({
      mutationFn: async (values: AdjustmentFormData) => {
        if (!userId) throw new Error(t("inventoryAdjustmentScreen:missingUserError"))

        const quantity = Number(values.quantity)
        const signedDelta = activeTab === "PURCHASE" ? quantity : -quantity

        const { data: existingQuantityRow, error: existingQuantityError } = await supabase
          .from("inventory_quantity")
          .select("id, total_quantity")
          .eq("user_id", userId)
          .eq("sku_id", skuId)
          .maybeSingle()

        if (existingQuantityError) throw existingQuantityError

        const currentTotal = existingQuantityRow?.total_quantity ?? 0
        const nextTotal = currentTotal + signedDelta

        if (nextTotal < 0) {
          throw new Error(t("inventoryAdjustmentScreen:insufficientStockReduceError"))
        }

        const { error: insertAdjustmentError } = await supabase.from("inventory_adjustments").insert({
          user_id: userId,
          sku_id: skuId,
          adjustment_type: activeTab,
          quantity,
          reference_note: values.reference_note?.trim() ? values.reference_note.trim() : null,
        })

        if (insertAdjustmentError) throw insertAdjustmentError

        if (existingQuantityRow?.id) {
          const { error: updateQuantityError } = await supabase
            .from("inventory_quantity")
            .update({ total_quantity: nextTotal })
            .eq("id", existingQuantityRow.id)

          if (updateQuantityError) throw updateQuantityError
        } else {
          const { error: insertQuantityError } = await supabase.from("inventory_quantity").insert({
            user_id: userId,
            sku_id: skuId,
            total_quantity: nextTotal,
          })

          if (insertQuantityError) throw insertQuantityError
        }
      },
      onMutate: async (values) => {
        if (!userId) return { previousSkuLists: [] as [readonly unknown[], SkuListItem[] | undefined][] }

        const quantity = Number(values.quantity)
        const signedDelta = activeTab === "PURCHASE" ? quantity : -quantity

        await queryClient.cancelQueries({ queryKey: queryKeys.sku.lists() })

        const previousSkuLists = queryClient.getQueriesData<SkuListItem[]>({
          queryKey: queryKeys.sku.lists(),
        })

        queryClient.setQueriesData<SkuListItem[]>({ queryKey: queryKeys.sku.lists() }, (old) => {
          if (!old) return old
          return old.map((item) =>
            item.id === skuId
              ? {
                  ...item,
                  totalQuantity: Math.max(0, item.totalQuantity + signedDelta),
                }
              : item,
          )
        })

        return { previousSkuLists }
      },
      onError: (_error, _values, context) => {
        context?.previousSkuLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      },
      onSuccess: async () => {
        toast.show({
          title: t("inventoryAdjustmentScreen:successToastTitle"),
          description: t("inventoryAdjustmentScreen:successToastDescription"),
          variant: "success",
        })
        reset({ quantity: "", reference_note: "" })
        setSaveError("")
        await queryClient.invalidateQueries({ queryKey: queryKeys.sku.all })
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
        navigation.goBack()
      },
    })

    const onSubmit = (values: AdjustmentFormData) => {
      setSaveError("")
      adjustmentMutation.mutate(values, {
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : t("inventoryAdjustmentScreen:saveErrorGeneric")
          setSaveError(message)
        },
      })
    }

    const emptyValue = t("skuDetailScreen:valueEmpty")

    return (
      <Container safeAreaEdges={["bottom"]}>
        <Header
          titleTypography="stack"
          titleTx="inventoryAdjustmentScreen:title"
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
          safeAreaEdges={[]}
        />

        <Container preset="scroll" contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <Text tx="inventoryAdjustmentScreen:skuLabel" size="sm" color="secondary" />
            <Text weight="bold" size="xl" style={styles.skuName}>
              {skuName}
            </Text>
            <View style={styles.quantitySummaryRow}>
              <Text tx="inventoryAdjustmentScreen:currentQuantityLabel" color="secondary" />
              <Text weight="bold" size="2xl">
                {currentQuantity}
              </Text>
            </View>
          </View>

          <View style={styles.adjustmentSegmentOuter}>
            {(
              [
                { key: "PURCHASE" as const, tx: "inventoryAdjustmentScreen:receiveStock" as const },
                { key: "SALE" as const, tx: "inventoryAdjustmentScreen:recordSale" as const },
                { key: "SCRAP" as const, tx: "inventoryAdjustmentScreen:scrapStock" as const },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => {
                    haptics.selection()
                    setActiveTab(tab.key)
                  }}
                  style={[styles.adjustmentSegmentCell, isActive && styles.adjustmentSegmentCellActive]}
                >
                  <Text
                    tx={tab.tx}
                    weight={isActive ? "semiBold" : "medium"}
                    style={isActive ? styles.adjustmentSegmentTextActive : styles.adjustmentSegmentTextInactive}
                  />
                </Pressable>
              )
            })}
          </View>

          <Controller
            control={control}
            name="quantity"
            render={({ field, fieldState }) => (
              <TextField
                labelTx="inventoryAdjustmentScreen:quantityLabel"
                placeholderTx="inventoryAdjustmentScreen:quantityPlaceholder"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                status={fieldState.error ? "error" : "default"}
                helper={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="reference_note"
            render={({ field, fieldState }) => (
              <TextField
                labelTx="inventoryAdjustmentScreen:referenceNoteLabel"
                placeholderTx="inventoryAdjustmentScreen:referenceNotePlaceholder"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                multiline
                maxLength={300}
                showCharacterCount
                status={fieldState.error ? "error" : "default"}
                helper={fieldState.error?.message}
              />
            )}
          />

          {saveError ? (
            <View style={styles.errorContainer}>
              <Text size="sm" color="error">
                {saveError}
              </Text>
            </View>
          ) : null}

          <Button
            tx="inventoryAdjustmentScreen:saveButton"
            onPress={handleSubmit(onSubmit)}
            loading={adjustmentMutation.isPending}
            disabled={!isValid || adjustmentMutation.isPending}
            fullWidth
            size="lg"
            style={styles.saveButton}
            TextProps={{ style: styles.saveButtonText }}
          />

          {recentAdjustments.length > 0 ? (
            <View style={styles.recentSection}>
              <Text tx="inventoryAdjustmentScreen:recentTitle" style={styles.recentTitle} />
              <View style={styles.recentList}>
                {recentAdjustments.map((adj) => {
                  const visual = pillStyleKeyForType(adj.adjustment_type)
                  const pillBg =
                    visual === "purchase"
                      ? styles.recentPill_purchase
                      : visual === "sale"
                        ? styles.recentPill_sale
                        : styles.recentPill_neutral
                  const pillTx = pillTxForAdjustmentType(adj.adjustment_type)
                  return (
                    <View key={adj.id} style={styles.recentRow}>
                      <View style={[styles.recentPill, pillBg]}>
                        <Text
                          tx={pillTx}
                          style={[styles.recentPillText, { color: pillLabelColors[visual] }]}
                        />
                      </View>
                      <Text style={styles.recentQty}>{adj.quantity}</Text>
                      <Text style={styles.recentDate} numberOfLines={1}>
                        {formatRecentDate(adj.created_at, emptyValue)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>
          ) : null}
        </Container>
      </Container>
    )
  }

const styles = StyleSheet.create((theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing["2xl"],
    gap: theme.spacing.md,
  },
  summaryCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  skuName: {
    marginTop: theme.spacing.xs,
  },
  quantitySummaryRow: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  adjustmentSegmentOuter: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    borderWidth: 1,
    borderColor: theme.colors.palette.gray200,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xxs,
    gap: theme.spacing.xxs,
    backgroundColor: theme.colors.palette.white,
  },
  adjustmentSegmentCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: "#FFFFFF",
  },
  adjustmentSegmentCellActive: {
    backgroundColor: "#F97316",
  },
  adjustmentSegmentTextActive: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
    textAlign: "center",
  },
  adjustmentSegmentTextInactive: {
    color: "#6B7280",
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: theme.colors.errorBackground,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  saveButton: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  saveButtonText: {
    color: theme.colors.accentForeground,
  },
  recentSection: {
    gap: theme.spacing.sm,
  },
  recentTitle: {
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
    color: theme.colors.foregroundSecondary,
  },
  recentList: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    overflow: "hidden",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  recentPill: {
    flexShrink: 0,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.full,
    maxWidth: "42%",
  },
  recentPill_purchase: {
    backgroundColor: theme.colors.successBackground,
  },
  recentPill_sale: {
    backgroundColor: theme.colors.errorBackground,
  },
  recentPill_neutral: {
    backgroundColor: theme.colors.backgroundTertiary,
  },
  recentPillText: {
    fontSize: theme.typography.sizes.xs,
    lineHeight: theme.typography.lineHeights.xs,
    fontFamily: theme.typography.fonts.semiBold,
  },
  recentQty: {
    flexShrink: 0,
    minWidth: 36,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fonts.semiBold,
    color: theme.colors.foreground,
    textAlign: "center",
  },
  recentDate: {
    flex: 1,
    minWidth: 0,
    fontSize: theme.typography.sizes.xs,
    lineHeight: theme.typography.lineHeights.xs,
    color: theme.colors.foregroundSecondary,
    textAlign: "right",
  },
}))
