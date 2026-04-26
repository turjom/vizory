import { FC, useMemo, useState } from "react"
import { View } from "react-native"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { StyleSheet } from "react-native-unistyles"
import { z } from "zod"

import { Button, Container, Header, Text, TextField } from "@/components"
import { useAuth } from "@/hooks"
import { queryKeys } from "@/hooks/queries"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { supabase } from "@/services/supabase"

interface AddSkuScreenProps extends AppStackScreenProps<"AddSku"> {}

export const AddSkuScreen: FC<AddSkuScreenProps> = function AddSkuScreen({ navigation, route }) {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState("")
  const editingSku = route.params?.mode === "edit" ? route.params.sku : undefined
  const isEditMode = !!editingSku

  const addSkuSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("addSkuScreen:validationNameRequired"))
          .max(120, t("addSkuScreen:validationNameMax")),
        sku_code: z.string().trim().max(64, t("addSkuScreen:validationSkuCodeMax")).optional(),
        description: z
          .string()
          .trim()
          .max(500, t("addSkuScreen:validationDescriptionMax"))
          .optional(),
        price: z
          .string()
          .trim()
          .refine((value) => value === "" || !Number.isNaN(Number(value)), {
            message: t("addSkuScreen:validationPriceNumber"),
          })
          .refine((value) => value === "" || Number(value) >= 0, {
            message: t("addSkuScreen:validationPriceMin"),
          })
          .optional(),
        uom: z.string().trim().max(40, t("addSkuScreen:validationUomMax")).optional(),
        safety_stock_threshold: z
          .string()
          .trim()
          .refine((value) => value !== "" && Number.isInteger(Number(value)), {
            message: t("addSkuScreen:validationSafetyStockInteger"),
          })
          .refine((value) => Number(value) >= 0, {
            message: t("addSkuScreen:validationSafetyStockMin"),
          }),
      }),
    [t],
  )

  type AddSkuFormData = z.infer<typeof addSkuSchema>

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<AddSkuFormData>({
    resolver: zodResolver(addSkuSchema),
    mode: "onBlur",
    defaultValues: {
      name: editingSku?.name ?? "",
      sku_code: editingSku?.sku_code ?? "",
      description: editingSku?.description ?? "",
      price:
        editingSku?.price !== null && editingSku?.price !== undefined ? String(editingSku.price) : "",
      uom: editingSku?.uom ?? "",
      safety_stock_threshold: String(editingSku?.safety_stock_threshold ?? 0),
    },
  })

  const createSkuMutation = useMutation({
    mutationFn: async (values: AddSkuFormData) => {
      if (!userId) throw new Error(t("addSkuScreen:missingUserError"))

      const payload = {
        name: values.name.trim(),
        sku_code: values.sku_code?.trim() ? values.sku_code.trim() : null,
        description: values.description?.trim() ? values.description.trim() : null,
        price: values.price?.trim() ? Number(values.price) : null,
        uom: values.uom?.trim() ? values.uom.trim() : null,
        safety_stock_threshold: Number(values.safety_stock_threshold),
      }

      if (isEditMode && editingSku?.id) {
        const { error: skuUpdateError } = await supabase
          .from("skus")
          .update(payload)
          .eq("id", editingSku.id)
          .eq("user_id", userId)

        if (skuUpdateError) throw skuUpdateError
      } else {
        const { data: insertedSku, error: skuInsertError } = await supabase
          .from("skus")
          .insert({
            ...payload,
            user_id: userId,
          })
          .select("id")
          .single()

        if (skuInsertError) throw skuInsertError

        const { error: quantityInsertError } = await supabase.from("inventory_quantity").insert({
          user_id: userId,
          sku_id: insertedSku.id,
          total_quantity: 0,
        })

        if (quantityInsertError) throw quantityInsertError
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sku.all })
      if (editingSku?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.sku.detail(editingSku.id) })
      }
      navigation.goBack()
    },
  })

  const onSubmit = (values: AddSkuFormData) => {
    setSaveError("")
    createSkuMutation.mutate(values, {
      onError: () => {
        setSaveError(t("addSkuScreen:saveErrorGeneric"))
      },
    })
  }

  return (
    <Container safeAreaEdges={["bottom"]} keyboardAvoiding>
      <Header
        titleTx={isEditMode ? "addSkuScreen:editTitle" : "addSkuScreen:title"}
        leftIcon="back"
        onLeftPress={() => navigation.goBack()}
        safeAreaEdges={["top"]}
      />
      <Container preset="scroll" contentContainerStyle={styles.content}>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="addSkuScreen:nameLabel"
              placeholderTx="addSkuScreen:namePlaceholder"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              returnKeyType="next"
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="sku_code"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="addSkuScreen:skuCodeLabel"
              placeholderTx="addSkuScreen:skuCodePlaceholder"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="characters"
              returnKeyType="next"
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="addSkuScreen:descriptionLabel"
              placeholderTx="addSkuScreen:descriptionPlaceholder"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              multiline
              showCharacterCount
              maxLength={500}
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="price"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="addSkuScreen:priceLabel"
              placeholderTx="addSkuScreen:pricePlaceholder"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="decimal-pad"
              returnKeyType="next"
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="uom"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="addSkuScreen:uomLabel"
              placeholderTx="addSkuScreen:uomPlaceholder"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              returnKeyType="next"
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="safety_stock_threshold"
          render={({ field, fieldState }) => (
            <TextField
              labelTx="addSkuScreen:safetyStockLabel"
              placeholderTx="addSkuScreen:safetyStockPlaceholder"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
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
          tx={isEditMode ? "addSkuScreen:updateButton" : "addSkuScreen:saveButton"}
          onPress={handleSubmit(onSubmit)}
          loading={createSkuMutation.isPending}
          disabled={!isValid || createSkuMutation.isPending}
          fullWidth
        />
      </Container>
    </Container>
  )
}

const styles = StyleSheet.create((theme) => ({
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing["2xl"],
    gap: theme.spacing.md,
  },
  errorContainer: {
    backgroundColor: theme.colors.errorBackground,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
}))
