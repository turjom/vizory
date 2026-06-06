import { FC, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, FlatList, Platform, Pressable, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"
import { z } from "zod"

import {
  Button,
  Card,
  Container,
  Header,
  Spinner,
  Text,
  TextField,
  useToast,
  type TextFieldAccessoryProps,
} from "@/components"
import { useAuth, useTrialStatus } from "@/hooks"
import { queryKeys } from "@/hooks/queries"
import { useSkusQuery, type SkuListItem } from "@/hooks/queries/useSkusQuery"
import { translate } from "@/i18n"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { supabase } from "@/services/supabase"
import { haptics } from "@/utils/haptics"

interface StockTakeScreenProps extends AppStackScreenProps<"StockTake"> {}

const LazyAddSkuBarcodeScannerModal = lazy(() => import("./AddSkuBarcodeScannerModal"))

/** Passed to Container `ScrollViewProps` — must include inset flags (also set explicitly below). */
const STACK_SCROLL_VIEW_PROPS = {
  contentInsetAdjustmentBehavior: "never" as const,
  automaticallyAdjustContentInsets: false,
}

type PostSubmitRow = {
  skuId: string
  skuName: string
  systemQuantity: number
  counted: number
  variance: number
}

type PendingReview = {
  rows: PostSubmitRow[]
  isPostRecount: boolean
}

function useLastStockTakeTimestamps(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.sku.lastStockTakeBySku(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Map<string, string>> => {
      if (!userId) return new Map()
      const { data, error } = await supabase
        .from("stock_takes")
        .select("sku_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error

      const map = new Map<string, string>()
      for (const row of data ?? []) {
        const sid = row.sku_id as string
        const at = row.created_at as string | null
        if (at && !map.has(sid)) map.set(sid, at)
      }
      return map
    },
  })
}

function lastCountedDisplay(iso: string | undefined, neverLabel: string): string {
  if (!iso) return neverLabel
  try {
    return format(parseISO(iso), "MMM d, yyyy")
  } catch {
    return neverLabel
  }
}

function isLastCountedStale(iso: string | undefined): boolean {
  if (!iso) return true
  try {
    return differenceInCalendarDays(new Date(), parseISO(iso)) > 30
  } catch {
    return true
  }
}

const stockTakeItemSchema = z.object({
  skuId: z.string(),
  skuName: z.string(),
  skuCode: z.string(),
  systemQuantity: z.number(),
  counted: z.string(),
})

type StockTakeFormValues = { items: z.infer<typeof stockTakeItemSchema>[] }

function formValuesToReviewRows(values: StockTakeFormValues): PostSubmitRow[] {
  return values.items.map((row) => {
    const counted = Number(row.counted)
    return {
      skuId: row.skuId,
      skuName: row.skuName,
      systemQuantity: row.systemQuantity,
      counted,
      variance: counted - row.systemQuantity,
    }
  })
}

function StockTakeSkuCountRow(props: {
  index: number
  skuName: string
  control: import("react-hook-form").Control<StockTakeFormValues>
  lastIso: string | undefined
  neverLabel: string
  showRemove: boolean
  onRemove: () => void
}) {
  const { index, skuName, control, lastIso, neverLabel, showRemove, onRemove } = props
  const { t } = useTranslation()
  const lastLabel = lastCountedDisplay(lastIso, neverLabel)
  const lastStale = isLastCountedStale(lastIso)

  return (
    <Card
      preset="outlined"
      style={styles.rowCard}
      ContentComponent={
        <View style={styles.rowInner}>
          <View style={styles.nameRow}>
            <View style={styles.nameBlock}>
              <Text weight="semiBold" size="md" numberOfLines={2}>
                {skuName}
              </Text>
              <Text size="xs" style={lastStale ? styles.lastCountedStale : styles.lastCountedOk}>
                {t("stockTakeScreen:lastCountedLabel")}: {lastLabel}
              </Text>
            </View>
            {showRemove ? (
              <Button
                tx="stockTakeScreen:removeFromCount"
                variant="ghost"
                size="sm"
                onPress={onRemove}
              />
            ) : null}
          </View>

          <Controller
            control={control}
            name={`items.${index}.counted`}
            render={({ field, fieldState }) => (
              <TextField
                labelTx="stockTakeScreen:countedLabel"
                placeholderTx="stockTakeScreen:countedPlaceholder"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                status={fieldState.error ? "error" : "default"}
                helper={fieldState.error?.message}
              />
            )}
          />
        </View>
      }
    />
  )
}

export const StockTakeScreen: FC<StockTakeScreenProps> = function StockTakeScreen({ navigation }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const toast = useToast()
  const { userId } = useAuth()
  const { isTrialExpired } = useTrialStatus()
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState("")
  const [listScope, setListScope] = useState<"all" | "select">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [skuScannerVisible, setSkuScannerVisible] = useState(false)
  const prevListScopeRef = useRef(listScope)

  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null)
  const [nextReviewIsPostRecount, setNextReviewIsPostRecount] = useState(false)

  const { data: skus = [], isLoading, error, refetch } = useSkusQuery()
  const { data: lastCountedBySku = new Map<string, string>() } = useLastStockTakeTimestamps(userId)

  useEffect(() => {
    if (isTrialExpired) {
      navigation.navigate("TrialExpired")
    }
  }, [isTrialExpired, navigation])

  const skusFingerprint = useMemo(
    () => skus.map((s) => `${s.id}:${s.totalQuantity}`).join("|"),
    [skus],
  )

  const formSchema = useMemo(
    () =>
      z
        .object({
          items: z.array(stockTakeItemSchema),
        })
        .superRefine((data, ctx) => {
          const rowsToCount = data.items
          if (rowsToCount.length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("stockTakeScreen:validationNoSkusSelected"),
              path: ["items"],
            })
            return
          }
          data.items.forEach((item, i) => {
            if (item.counted.trim() === "") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t("stockTakeScreen:validationCountedRequired"),
                path: ["items", i, "counted"],
              })
              return
            }
            if (!Number.isInteger(Number(item.counted))) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t("stockTakeScreen:validationCountedInteger"),
                path: ["items", i, "counted"],
              })
              return
            }
            if (Number(item.counted) < 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t("stockTakeScreen:validationCountedMin"),
                path: ["items", i, "counted"],
              })
            }
          })
        }),
    [t],
  )

  const { control, handleSubmit, reset, formState, trigger, getValues } = useForm<StockTakeFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { items: [] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  useEffect(() => {
    if (pendingReview) return
    const prev = prevListScopeRef.current
    if (prev === "all" && listScope === "select") {
      reset({ items: [] })
      setSearchQuery("")
    }
    prevListScopeRef.current = listScope
  }, [pendingReview, listScope, reset])

  useEffect(() => {
    if (pendingReview) return
    // Recount step: form is narrowed to variance-only rows — do not replace with full SKU list
    if (nextReviewIsPostRecount) return
    if (skus.length === 0) return
    if (listScope !== "all") return
    reset({
      items: skus.map((sku) => ({
        skuId: sku.id,
        skuName: sku.name,
        skuCode: sku.skuCode,
        systemQuantity: sku.totalQuantity,
        counted: "",
      })),
    })
  }, [pendingReview, nextReviewIsPostRecount, listScope, skusFingerprint, skus, reset])

  useEffect(() => {
    if (pendingReview) return
    if (nextReviewIsPostRecount) return
    if (listScope !== "select" || skus.length === 0) return
    const current = getValues("items")
    if (current.length === 0) return
    const skuById = new Map(skus.map((s) => [s.id, s]))
    const next = current.map((row) => {
      const s = skuById.get(row.skuId)
      if (!s) return row
      return {
        ...row,
        systemQuantity: s.totalQuantity,
        skuName: s.name,
        skuCode: s.skuCode,
      }
    })
    const same =
      next.length === current.length &&
      next.every(
        (n, i) =>
          n.systemQuantity === current[i].systemQuantity &&
          n.skuName === current[i].skuName &&
          n.skuCode === current[i].skuCode,
      )
    if (!same) reset({ items: next })
  }, [pendingReview, nextReviewIsPostRecount, listScope, skusFingerprint, skus, getValues, reset])

  useEffect(() => {
    void trigger()
  }, [listScope, trigger])

  const closeSkuScanner = useCallback(() => {
    setSkuScannerVisible(false)
  }, [])

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

  const selectedIds = useMemo(() => new Set(fields.map((f) => f.skuId)), [fields])

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (q === "") return []
    return skus.filter((sku) => {
      if (selectedIds.has(sku.id)) return false
      const name = sku.name.toLowerCase()
      const code = sku.skuCode.toLowerCase()
      return name.includes(q) || code.includes(q)
    })
  }, [searchQuery, skus, selectedIds])

  const addSkuToCount = useCallback(
    (sku: SkuListItem) => {
      if (selectedIds.has(sku.id)) return
      append({
        skuId: sku.id,
        skuName: sku.name,
        skuCode: sku.skuCode,
        systemQuantity: sku.totalQuantity,
        counted: "",
      })
      void trigger()
      setSearchQuery("")
    },
    [append, selectedIds, trigger],
  )

  const commitMutation = useMutation({
    mutationFn: async (rows: PostSubmitRow[]) => {
      if (!userId) throw new Error(t("stockTakeScreen:missingUserError"))

      for (const row of rows) {
        const counted = row.counted
        const system = row.systemQuantity
        const delta = counted - system

        const { data: takeRow, error: stockTakeError } = await supabase
          .from("stock_takes")
          .insert({
            user_id: userId,
            sku_id: row.skuId,
            counted_quantity: counted,
            system_quantity_at_time: system,
            variance: delta,
          })
          .select("id")
          .single()

        if (stockTakeError) throw stockTakeError
        if (!takeRow?.id) throw new Error(t("stockTakeScreen:missingStockTakeIdError"))

        const refNote = t("stockTakeScreen:adjustmentReferenceNote")

        const { error: adjustmentError } = await supabase.from("inventory_adjustments").insert({
          user_id: userId,
          sku_id: row.skuId,
          adjustment_type: "STOCK_TAKE",
          quantity: delta,
          reference_note: refNote,
        })
        if (adjustmentError) throw adjustmentError

        const { data: quantityRow, error: quantitySelectError } = await supabase
          .from("inventory_quantity")
          .select("id")
          .eq("user_id", userId)
          .eq("sku_id", row.skuId)
          .maybeSingle()

        if (quantitySelectError) throw quantitySelectError

        if (quantityRow?.id) {
          const { error: quantityUpdateError } = await supabase
            .from("inventory_quantity")
            .update({ total_quantity: counted })
            .eq("id", quantityRow.id)

          if (quantityUpdateError) throw quantityUpdateError
        } else {
          const { error: quantityInsertError } = await supabase.from("inventory_quantity").insert({
            user_id: userId,
            sku_id: row.skuId,
            total_quantity: counted,
          })
          if (quantityInsertError) throw quantityInsertError
        }
      }
    },
    onSuccess: () => {
      // Invalidate only — Inventory refetches on focus (SkuList stays mounted under the stack).
      // Awaiting refetchQueries here leaves isRefetching stuck on Inventory until the list re-renders.
      void queryClient.invalidateQueries({ queryKey: queryKeys.sku.lists() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sku.lastStockTakeBySku(userId) })
      }

      setPendingReview(null)
      setNextReviewIsPostRecount(false)
      setSubmitError("")

      navigation.goBack()
    },
  })

  const onCancelCount = useCallback(() => {
    setPendingReview(null)
    setNextReviewIsPostRecount(false)
    navigation.goBack()
  }, [navigation])

  const onRecount = () => {
    const current = pendingReview
    if (!current) return
    const skuCodeById = new Map(skus.map((s) => [s.id, s.skuCode]))
    setPendingReview(null)
    setNextReviewIsPostRecount(true)
    const rowsWithVariance = current.rows.filter((r) => r.counted !== r.systemQuantity)
    reset({
      items: rowsWithVariance.map((r) => ({
        skuId: r.skuId,
        skuName: r.skuName,
        skuCode: skuCodeById.get(r.skuId) ?? "",
        systemQuantity: r.systemQuantity,
        counted: "",
      })),
    })
    void trigger()
  }

  const onCommitDone = useCallback(() => {
    if (!pendingReview) return
    setSubmitError("")
    commitMutation.mutate(pendingReview.rows, {
      onError: () => {
        setSubmitError(t("stockTakeScreen:submitErrorGeneric"))
      },
    })
  }, [commitMutation, pendingReview, t])

  const onAcceptCount = useCallback(() => {
    if (!pendingReview) return
    const rowsToCommit = pendingReview.rows
    const changed = rowsToCommit.filter((r) => r.variance !== 0)
    const body =
      changed.length === 1
        ? t("stockTakeScreen:acceptCountConfirmSingle", {
            system: changed[0].systemQuantity,
            counted: changed[0].counted,
          })
        : t("stockTakeScreen:acceptCountConfirmMulti", {
            details: changed.map((r) => `• ${r.skuName}: ${r.systemQuantity} → ${r.counted}`).join("\n"),
          })
    Alert.alert(t("stockTakeScreen:acceptCountConfirmTitle"), body, [
      { text: t("stockTakeScreen:acceptCountNo"), style: "cancel" },
      {
        text: t("stockTakeScreen:acceptCountYes"),
        onPress: () => {
          setSubmitError("")
          commitMutation.mutate(rowsToCommit, {
            onError: () => {
              setSubmitError(t("stockTakeScreen:submitErrorGeneric"))
            },
          })
        },
      },
    ])
  }, [commitMutation, pendingReview, t])

  const onSubmit = (values: StockTakeFormValues) => {
    setSubmitError("")
    const isPost = nextReviewIsPostRecount
    setNextReviewIsPostRecount(false)
    setPendingReview({
      rows: formValuesToReviewRows(values),
      isPostRecount: isPost,
    })
  }

  const neverLabel = t("stockTakeScreen:lastCountedNever")

  if (isTrialExpired) {
    return null
  }

  if (isLoading) {
    return (
      <Container
        safeAreaEdges={["bottom"]}
      >
        <View style={{ flexShrink: 0 }}>
          <Header
            titleTypography="stack"
            titleTx="stockTakeScreen:title"
            safeAreaEdges={["top"]}
            leftIcon="back"
            onLeftPress={() => navigation.goBack()}
          />
        </View>
        <View style={styles.centered}>
          <Spinner size="lg" />
        </View>
      </Container>
    )
  }

  if (error) {
    return (
      <Container
        safeAreaEdges={["bottom"]}
      >
        <View style={{ flexShrink: 0 }}>
          <Header
            titleTypography="stack"
            titleTx="stockTakeScreen:title"
            safeAreaEdges={["top"]}
            leftIcon="back"
            onLeftPress={() => navigation.goBack()}
          />
        </View>
        <View style={styles.centered}>
          <Text color="error">{error.message}</Text>
          <Button tx="stockTakeScreen:retry" onPress={() => void refetch()} style={styles.retryButton} />
        </View>
      </Container>
    )
  }

  if (skus.length === 0) {
    return (
      <Container
        safeAreaEdges={["bottom"]}
      >
        <View style={{ flexShrink: 0 }}>
          <Header
            titleTypography="stack"
            titleTx="stockTakeScreen:title"
            safeAreaEdges={["top"]}
            leftIcon="back"
            onLeftPress={() => navigation.goBack()}
          />
        </View>
        <View style={styles.centered}>
          <Text tx="stockTakeScreen:noSkusTitle" preset="subheading" />
          <Text tx="stockTakeScreen:noSkusDescription" color="secondary" style={styles.emptyHint} />
        </View>
      </Container>
    )
  }

  if (pendingReview) {
    const allZero = pendingReview.rows.every((r) => r.variance === 0)
    const showRecountCancel = !allZero && !pendingReview.isPostRecount
    const showAcceptCancel = !allZero && pendingReview.isPostRecount

    return (
      <Container
        safeAreaEdges={["bottom"]}
      >
        <View style={{ flexShrink: 0 }}>
          <Header
            titleTypography="stack"
            titleTx="stockTakeScreen:title"
            safeAreaEdges={["top"]}
            leftIcon="back"
            onLeftPress={onCancelCount}
          />
        </View>
        <Container
          preset="scroll"
          contentContainerStyle={styles.scrollContent}
          ScrollViewProps={{
            ...STACK_SCROLL_VIEW_PROPS,
            contentInsetAdjustmentBehavior: "never",
            automaticallyAdjustContentInsets: false,
          }}
        >
          <Text tx="stockTakeScreen:reviewSubtitle" color="secondary" style={styles.subtitle} />
          {pendingReview.rows.map((row) => (
            <Card
              key={row.skuId}
              preset="outlined"
              style={styles.rowCard}
              ContentComponent={
                <View style={styles.rowInner}>
                  <Text weight="semiBold" size="md" numberOfLines={2}>
                    {row.skuName}
                  </Text>
                  <View style={styles.resultsMetaRow}>
                    <Text size="sm" color="secondary" tx="stockTakeScreen:systemQtyLabel" />
                    <Text size="sm" weight="medium">
                      {row.systemQuantity}
                    </Text>
                  </View>
                  <View style={styles.resultsMetaRow}>
                    <Text size="sm" color="secondary" tx="stockTakeScreen:countedLabel" />
                    <Text size="sm" weight="medium">
                      {row.counted}
                    </Text>
                  </View>
                  <View style={styles.varianceRow}>
                    <Text size="sm" color="secondary" tx="stockTakeScreen:varianceLabel" />
                    <Text
                      size="sm"
                      weight="semiBold"
                      style={{
                        color:
                          row.variance === 0
                            ? theme.colors.successForeground
                            : theme.colors.errorForeground,
                      }}
                    >
                      {row.variance}
                    </Text>
                  </View>
                </View>
              }
            />
          ))}

          {submitError ? (
            <View style={styles.errorBanner}>
              <Text size="sm" color="error">
                {submitError}
              </Text>
            </View>
          ) : null}

          {allZero ? (
            <Button
              tx="stockTakeScreen:doneButton"
              onPress={onCommitDone}
              fullWidth
              loading={commitMutation.isPending}
              disabled={commitMutation.isPending}
              style={[styles.primaryCta, styles.doneButton]}
              TextProps={{ style: styles.primaryCtaText }}
            />
          ) : null}

          {showRecountCancel ? (
            <View style={styles.reviewButtonRow}>
              <Button
                tx="stockTakeScreen:recountButton"
                onPress={onRecount}
                style={[styles.primaryCta, styles.reviewActionHalf]}
                TextProps={{ style: styles.primaryCtaText }}
              />
              <Button
                tx="stockTakeScreen:cancelCountButton"
                variant="outlined"
                onPress={onCancelCount}
                style={[styles.cancelCountButton, styles.reviewActionHalf]}
                TextProps={{ style: styles.cancelCountButtonText }}
              />
            </View>
          ) : null}

          {showAcceptCancel ? (
            <View style={styles.reviewButtonRow}>
              <Button
                tx="stockTakeScreen:acceptCountButton"
                onPress={onAcceptCount}
                disabled={commitMutation.isPending}
                style={[styles.primaryCta, styles.reviewActionHalf]}
                TextProps={{ style: styles.primaryCtaText }}
              />
              <Button
                tx="stockTakeScreen:cancelCountButton"
                variant="outlined"
                onPress={onCancelCount}
                style={[styles.cancelCountButton, styles.reviewActionHalf]}
                TextProps={{ style: styles.cancelCountButtonText }}
              />
            </View>
          ) : null}
        </Container>
      </Container>
    )
  }

  return (
    <Container
      safeAreaEdges={["bottom"]}
    >
      <View style={{ flexShrink: 0 }}>
        <Header
          titleTypography="stack"
          titleTx="stockTakeScreen:title"
          safeAreaEdges={["top"]}
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
        />
      </View>
      <Container
        preset="scroll"
        contentContainerStyle={styles.scrollContent}
        ScrollViewProps={{
          ...STACK_SCROLL_VIEW_PROPS,
          contentInsetAdjustmentBehavior: "never",
          automaticallyAdjustContentInsets: false,
        }}
      >
        <View style={styles.stockTakeSegmentOuter}>
          {(
            [
              { key: "all" as const, tx: "stockTakeScreen:tabAllSkus" as const },
              { key: "select" as const, tx: "stockTakeScreen:tabSelectSkus" as const },
            ] as const
          ).map((tab) => {
            const isActive = listScope === tab.key
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => {
                  haptics.selection()
                  setListScope(tab.key)
                }}
                style={[styles.stockTakeSegmentCell, isActive && styles.stockTakeSegmentCellActive]}
              >
                <Text
                  tx={tab.tx}
                  weight={isActive ? "semiBold" : "medium"}
                  style={
                    isActive ? styles.stockTakeSegmentTextActive : styles.stockTakeSegmentTextInactive
                  }
                />
              </Pressable>
            )
          })}
        </View>

        <Text tx="stockTakeScreen:subtitle" color="secondary" style={styles.subtitle} />

        {listScope === "select" ? (
          <View style={styles.searchSection}>
            <TextField
              labelTx="stockTakeScreen:searchLabel"
              placeholderTx="stockTakeScreen:searchPlaceholder"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              RightAccessory={searchBarcodeAccessory}
            />
            {searchQuery.trim() === "" ? (
              <Text tx="stockTakeScreen:searchHint" size="sm" color="secondary" />
            ) : searchMatches.length === 0 ? (
              <Text tx="stockTakeScreen:noSearchResults" size="sm" color="secondary" />
            ) : (
              <View style={styles.searchResults}>
                {searchMatches.map((sku) => (
                  <Pressable
                    key={sku.id}
                    onPress={() => addSkuToCount(sku)}
                    style={({ pressed }) => [
                      styles.searchResultRow,
                      pressed && styles.searchResultRowPressed,
                    ]}
                  >
                    <View style={styles.searchResultText}>
                      <Text weight="medium" size="sm" numberOfLines={2}>
                        {sku.name}
                      </Text>
                      <Text size="xs" color="secondary" numberOfLines={1}>
                        {sku.skuCode}
                      </Text>
                    </View>
                    <Text tx="stockTakeScreen:addSkuAction" size="sm" style={styles.addSkuAction} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}

        <FlatList
          data={fields}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            listScope === "select" ? (
              <Text tx="stockTakeScreen:selectModeEmpty" size="sm" color="secondary" style={styles.selectEmpty} />
            ) : null
          }
          renderItem={({ item, index }) => (
            <StockTakeSkuCountRow
              index={index}
              skuName={item.skuName}
              control={control}
              lastIso={lastCountedBySku.get(item.skuId)}
              neverLabel={neverLabel}
              showRemove={listScope === "select"}
              onRemove={() => {
                remove(index)
                void trigger()
              }}
            />
          )}
        />

        {submitError ? (
          <View style={styles.errorBanner}>
            <Text size="sm" color="error">
              {submitError}
            </Text>
          </View>
        ) : null}

        <Button
          tx="stockTakeScreen:confirmButton"
          onPress={handleSubmit(onSubmit)}
          disabled={!formState.isValid}
          fullWidth
          style={styles.primaryCta}
          TextProps={{ style: styles.primaryCtaText }}
        />
      </Container>
      {skuScannerVisible ? (
        <Suspense fallback={null}>
          <LazyAddSkuBarcodeScannerModal
            visible={skuScannerVisible}
            onClose={closeSkuScanner}
            onBarcodeScanned={handleBarcodeScanned}
          />
        </Suspense>
      ) : null}
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing["2xl"],
    gap: theme.spacing.md,
  },
  subtitle: {
    marginBottom: theme.spacing.xs,
  },
  stockTakeSegmentOuter: {
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
  stockTakeSegmentCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: "#FFFFFF",
  },
  stockTakeSegmentCellActive: {
    backgroundColor: "#F97316",
  },
  stockTakeSegmentTextActive: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
    textAlign: "center",
  },
  stockTakeSegmentTextInactive: {
    color: "#6B7280",
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
    textAlign: "center",
  },
  primaryCta: {
    backgroundColor: "#F97316",
    borderColor: "#F97316",
  },
  primaryCtaText: {
    color: "#FFFFFF",
  },
  searchSection: {
    gap: theme.spacing.sm,
  },
  searchBarcodeAccessoryHit: {
    padding: theme.spacing.xxs,
  },
  searchResults: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  searchResultRowPressed: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  searchResultText: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xxs,
  },
  addSkuAction: {
    color: theme.colors.tint,
    fontFamily: theme.typography.fonts.semiBold,
  },
  selectEmpty: {
    marginBottom: theme.spacing.sm,
  },
  rowCard: {
    minHeight: 0,
    marginBottom: theme.spacing.sm,
  },
  rowInner: {
    gap: theme.spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xxs,
  },
  lastCountedOk: {
    color: theme.colors.foregroundSecondary,
  },
  lastCountedStale: {
    color: theme.colors.errorForeground,
  },
  resultsMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  varianceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  errorBanner: {
    backgroundColor: theme.colors.errorBackground,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  retryButton: {
    marginTop: theme.spacing.md,
  },
  emptyHint: {
    marginTop: theme.spacing.sm,
    textAlign: "center",
  },
  doneButton: {
    marginTop: theme.spacing.sm,
  },
  reviewButtonRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  reviewActionHalf: {
    flex: 1,
  },
  cancelCountButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  cancelCountButtonText: {
    color: "#EF4444",
  },
}))
