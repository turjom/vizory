import { FC, Fragment, useEffect, useMemo, useState } from "react"
import { FlatList, View } from "react-native"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { StyleSheet } from "react-native-unistyles"
import { z } from "zod"

import { Button, Card, Container, Header, Spinner, Text, TextField } from "@/components"
import { useAuth } from "@/hooks"
import { queryKeys } from "@/hooks/queries"
import { useSkusQuery } from "@/hooks/queries/useSkusQuery"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { supabase } from "@/services/supabase"

interface StockTakeScreenProps extends AppStackScreenProps<"StockTake"> {}

export const StockTakeScreen: FC<StockTakeScreenProps> = function StockTakeScreen({ navigation }) {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState("")

  const { data: skus = [], isLoading, error, refetch } = useSkusQuery()

  const skusFingerprint = useMemo(
    () => skus.map((s) => `${s.id}:${s.totalQuantity}`).join("|"),
    [skus],
  )

  const rowSchema = useMemo(
    () =>
      z.object({
        skuId: z.string(),
        skuName: z.string(),
        systemQuantity: z.number(),
        counted: z
          .string()
          .trim()
          .min(1, t("stockTakeScreen:validationCountedRequired"))
          .refine((value) => Number.isInteger(Number(value)), {
            message: t("stockTakeScreen:validationCountedInteger"),
          })
          .refine((value) => Number(value) >= 0, {
            message: t("stockTakeScreen:validationCountedMin"),
          }),
      }),
    [t],
  )

  const formSchema = useMemo(
    () =>
      z.object({
        items: z.array(rowSchema).min(1, t("stockTakeScreen:validationItemsMin")),
      }),
    [rowSchema, t],
  )

  type StockTakeFormValues = z.infer<typeof formSchema>

  const { control, handleSubmit, reset, formState } = useForm<StockTakeFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: { items: [] },
  })

  const { fields } = useFieldArray({ control, name: "items" })

  useEffect(() => {
    if (skus.length === 0) return
    reset({
      items: skus.map((sku) => ({
        skuId: sku.id,
        skuName: sku.name,
        systemQuantity: sku.totalQuantity,
        counted: String(sku.totalQuantity),
      })),
    })
  }, [skusFingerprint, skus, reset])

  const submitMutation = useMutation({
    mutationFn: async (values: StockTakeFormValues) => {
      if (!userId) throw new Error(t("stockTakeScreen:missingUserError"))

      for (const row of values.items) {
        const counted = Number(row.counted)
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

        const refNote = t("stockTakeScreen:adjustmentReferenceNote", { stockTakeId: takeRow.id })

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sku.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      navigation.goBack()
    },
  })

  const onSubmit = (values: StockTakeFormValues) => {
    setSubmitError("")
    submitMutation.mutate(values, {
      onError: () => {
        setSubmitError(t("stockTakeScreen:submitErrorGeneric"))
      },
    })
  }

  if (isLoading) {
    return (
      <Container safeAreaEdges={["bottom"]}>
        <Header
          titleTx="stockTakeScreen:title"
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

  if (error) {
    return (
      <Container safeAreaEdges={["bottom"]}>
        <Header
          titleTx="stockTakeScreen:title"
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
          safeAreaEdges={["top"]}
        />
        <View style={styles.centered}>
          <Text color="error">{error.message}</Text>
          <Button tx="stockTakeScreen:retry" onPress={() => void refetch()} style={styles.retryButton} />
        </View>
      </Container>
    )
  }

  if (skus.length === 0) {
    return (
      <Container safeAreaEdges={["bottom"]}>
        <Header
          titleTx="stockTakeScreen:title"
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
          safeAreaEdges={["top"]}
        />
        <View style={styles.centered}>
          <Text tx="stockTakeScreen:noSkusTitle" preset="subheading" />
          <Text tx="stockTakeScreen:noSkusDescription" color="secondary" style={styles.emptyHint} />
        </View>
      </Container>
    )
  }

  return (
    <Container safeAreaEdges={["bottom"]}>
      <Header
        titleTx="stockTakeScreen:title"
        leftIcon="back"
        onLeftPress={() => navigation.goBack()}
        safeAreaEdges={["top"]}
      />
      <Container preset="scroll" contentContainerStyle={styles.scrollContent}>
        <Text tx="stockTakeScreen:subtitle" color="secondary" style={styles.subtitle} />

        <FlatList
          data={fields}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item, index }) => {
            const systemQty = item.systemQuantity
            return (
              <Card
                preset="outlined"
                style={styles.rowCard}
                ContentComponent={
                  <View style={styles.rowInner}>
                    <Text weight="semiBold" size="md" numberOfLines={2}>
                      {item.skuName}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text size="sm" color="secondary" tx="stockTakeScreen:systemQtyLabel" />
                      <Text size="sm" weight="medium">
                        {systemQty}
                      </Text>
                    </View>
                    <Controller
                      control={control}
                      name={`items.${index}.counted`}
                      render={({ field, fieldState }) => {
                        const countedVal = field.value.trim()
                        const countedNum =
                          countedVal === "" || Number.isNaN(Number(countedVal))
                            ? null
                            : Number(countedVal)
                        const variance =
                          countedNum === null || !Number.isInteger(countedNum)
                            ? null
                            : countedNum - systemQty
                        return (
                          <Fragment>
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
                            <View style={styles.varianceRow}>
                              <Text size="sm" color="secondary" tx="stockTakeScreen:varianceLabel" />
                              {variance === null ? (
                                <Text size="sm" weight="semiBold" tx="stockTakeScreen:variancePending" />
                              ) : (
                                <Text size="sm" weight="semiBold">
                                  {variance}
                                </Text>
                              )}
                            </View>
                          </Fragment>
                        )
                      }}
                    />
                  </View>
                }
              />
            )
          }}
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
          loading={submitMutation.isPending}
          disabled={!formState.isValid || submitMutation.isPending}
          fullWidth
        />
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
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing["2xl"],
    gap: theme.spacing.md,
  },
  subtitle: {
    marginBottom: theme.spacing.xs,
  },
  rowCard: {
    minHeight: 0,
    marginBottom: theme.spacing.sm,
  },
  rowInner: {
    gap: theme.spacing.sm,
  },
  metaRow: {
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
}))
