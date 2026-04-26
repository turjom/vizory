import { FC, useMemo, useState } from "react"
import { View } from "react-native"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { StyleSheet } from "react-native-unistyles"
import { z } from "zod"

import { Button, Container, Header, Modal, Text, TextField, useToast } from "@/components"
import { useAuth } from "@/hooks"
import { queryKeys } from "@/hooks/queries"
import { SkuListItem } from "@/hooks/queries/useSkusQuery"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { supabase } from "@/services/supabase"

type AdjustmentType = "PURCHASE" | "SALE"

interface InventoryAdjustmentScreenProps extends AppStackScreenProps<"InventoryAdjustment"> {}

export const InventoryAdjustmentScreen: FC<InventoryAdjustmentScreenProps> =
  function InventoryAdjustmentScreen({ navigation, route }) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const toast = useToast()
    const { userId } = useAuth()
    const [saveError, setSaveError] = useState("")
    const [activeType, setActiveType] = useState<AdjustmentType | null>(null)
    const { skuId, skuName, currentQuantity } = route.params

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
      mode: "onBlur",
      defaultValues: {
        quantity: "",
        reference_note: "",
      },
    })

    const closeAdjustmentModal = () => {
      setActiveType(null)
      setSaveError("")
      reset({
        quantity: "",
        reference_note: "",
      })
    }

    const adjustmentMutation = useMutation({
      mutationFn: async (values: AdjustmentFormData) => {
        if (!userId) throw new Error(t("inventoryAdjustmentScreen:missingUserError"))
        if (!activeType) throw new Error(t("inventoryAdjustmentScreen:missingAdjustmentTypeError"))

        const quantity = Number(values.quantity)
        const signedDelta = activeType === "PURCHASE" ? quantity : -quantity

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
          throw new Error(t("inventoryAdjustmentScreen:insufficientStockError"))
        }

        const { error: insertAdjustmentError } = await supabase.from("inventory_adjustments").insert({
          user_id: userId,
          sku_id: skuId,
          adjustment_type: activeType,
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
        if (!activeType || !userId) return { previousSkuLists: [] as [readonly unknown[], SkuListItem[] | undefined][] }

        const quantity = Number(values.quantity)
        const signedDelta = activeType === "PURCHASE" ? quantity : -quantity

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
        await queryClient.invalidateQueries({ queryKey: queryKeys.sku.all })
        closeAdjustmentModal()
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

    const actionLabelTx =
      activeType === "PURCHASE"
        ? "inventoryAdjustmentScreen:receiveStock"
        : "inventoryAdjustmentScreen:recordSale"
    const modalTitleTx =
      activeType === "PURCHASE"
        ? "inventoryAdjustmentScreen:modalTitleReceive"
        : "inventoryAdjustmentScreen:modalTitleSale"

    return (
      <Container safeAreaEdges={["bottom"]}>
        <Header
          titleTx="inventoryAdjustmentScreen:title"
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
          safeAreaEdges={["top"]}
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

          <Button
            tx="inventoryAdjustmentScreen:receiveStock"
            onPress={() => setActiveType("PURCHASE")}
            fullWidth
            size="lg"
          />
          <Button
            tx="inventoryAdjustmentScreen:recordSale"
            onPress={() => setActiveType("SALE")}
            fullWidth
            size="lg"
            variant="secondary"
          />
        </Container>

        <Modal
          visible={!!activeType}
          onClose={closeAdjustmentModal}
          titleTx={modalTitleTx}
          descriptionTx="inventoryAdjustmentScreen:modalDescription"
          size="md"
          showCloseButton
        >
          <View style={styles.modalContent}>
            <Text tx={actionLabelTx} weight="semiBold" size="lg" />

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

            <View style={styles.modalActions}>
              <Button
                tx="common:cancel"
                variant="outlined"
                onPress={closeAdjustmentModal}
                style={styles.actionButton}
              />
              <Button
                tx="inventoryAdjustmentScreen:saveButton"
                onPress={handleSubmit(onSubmit)}
                loading={adjustmentMutation.isPending}
                disabled={!isValid || adjustmentMutation.isPending}
                style={styles.actionButton}
              />
            </View>
          </View>
        </Modal>
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
  modalContent: {
    gap: theme.spacing.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: theme.colors.errorBackground,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
}))
