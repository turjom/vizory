import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  FlatList,
  Keyboard,
  Modal,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputKeyPressEventData,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { StyleSheet, useUnistyles } from "react-native-unistyles"
import { z } from "zod"

import { Header, Text, TextField, useToast, type TextFieldAccessoryProps } from "@/components"
import { useAuth } from "@/hooks"
import { queryKeys } from "@/hooks/queries"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { supabase } from "@/services/supabase"

interface AddSkuScreenProps extends MainTabScreenProps<"Add"> {}

const UOM_PRESET_VALUES = [
  "Pieces",
  "Box",
  "Bag",
  "Kg",
  "g",
  "L",
  "mL",
  "Pair",
  "Set",
  "Roll",
  "Pack",
  "Bottle",
  "Other",
] as const

const EMPTY_FORM = {
  name: "",
  sku_code: "",
  description: "",
  price: "",
  uom_preset: "",
  uom_other: "",
  safety_stock_threshold: "0",
}

function sanitizeDecimalPriceInput(raw: string): string {
  let next = raw.replace(/[^0-9.]/g, "")
  const dot = next.indexOf(".")
  if (dot !== -1) {
    next = `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, "")}`
  }
  return next
}

function formatPriceTwoDecimals(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === "") return ""
  const n = Number(trimmed)
  if (Number.isNaN(n)) return trimmed
  return n.toFixed(2)
}

/** Approximate bottom tab bar content height (matches MainTabNavigator tabBarStyle). */
const TAB_BAR_CONTENT_HEIGHT = 72

export const AddSkuScreen: FC<AddSkuScreenProps> = function AddSkuScreen({ navigation, route }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState("")
  const editingSku = route.params?.mode === "edit" ? route.params?.sku : undefined
  const isEditMode = !!editingSku

  const nameRef = useRef<TextInput>(null)
  const skuCodeRef = useRef<TextInput>(null)
  const descriptionRef = useRef<TextInput>(null)
  const priceRef = useRef<TextInput>(null)
  const uomOtherRef = useRef<TextInput>(null)
  const safetyStockRef = useRef<TextInput>(null)
  const [uomModalVisible, setUomModalVisible] = useState(false)

  const addSkuSchema = useMemo(
    () =>
      z
        .object({
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
            .min(1, t("addSkuScreen:validationPriceRequired"))
            .refine((value) => !Number.isNaN(Number(value)), {
              message: t("addSkuScreen:validationPriceNumber"),
            })
            .refine((value) => Number(value) >= 0, {
              message: t("addSkuScreen:validationPriceMin"),
            }),
          uom_preset: z
            .string()
            .min(1, t("addSkuScreen:validationUomRequired"))
            .refine((v) => (UOM_PRESET_VALUES as readonly string[]).includes(v), {
              message: t("addSkuScreen:validationUomInvalid"),
            }),
          uom_other: z.string().optional(),
          safety_stock_threshold: z
            .string()
            .trim()
            .refine((value) => value !== "" && Number.isInteger(Number(value)), {
              message: t("addSkuScreen:validationSafetyStockInteger"),
            })
            .refine((value) => Number(value) >= 0, {
              message: t("addSkuScreen:validationSafetyStockMin"),
            }),
        })
        .superRefine((data, ctx) => {
          if (data.uom_preset === "Other") {
            const trimmed = data.uom_other?.trim() ?? ""
            if (!trimmed) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t("addSkuScreen:validationUomOtherRequired"),
                path: ["uom_other"],
              })
            } else if (trimmed.length > 40) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t("addSkuScreen:validationUomMax"),
                path: ["uom_other"],
              })
            }
          }
        }),
    [t],
  )

  type AddSkuFormData = z.infer<typeof addSkuSchema>

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isValid },
  } = useForm<AddSkuFormData>({
    resolver: zodResolver(addSkuSchema),
    mode: "onChange",
    defaultValues: EMPTY_FORM,
  })

  useEffect(() => {
    const sku = route.params?.mode === "edit" ? route.params?.sku : undefined
    const rawUom = sku?.uom ?? ""
    const presetWithoutOther = UOM_PRESET_VALUES.filter((v) => v !== "Other") as readonly string[]
    const matchedPreset = presetWithoutOther.includes(rawUom)
    reset({
      name: sku?.name ?? "",
      sku_code: sku?.sku_code ?? "",
      description: sku?.description ?? "",
      price:
        sku?.price !== null && sku?.price !== undefined ? formatPriceTwoDecimals(String(sku.price)) : "",
      uom_preset: matchedPreset ? rawUom : rawUom ? "Other" : "",
      uom_other: matchedPreset ? "" : rawUom,
      safety_stock_threshold: String(sku?.safety_stock_threshold ?? 0),
    })
  }, [route.params, reset])

  const uomPresetWatch = useWatch({ control, name: "uom_preset" })
  const uomOtherWatch = useWatch({ control, name: "uom_other" })

  const priceDollarAccessory = useCallback(
    (_props: TextFieldAccessoryProps) => (
      <Text
        weight="semiBold"
        size="md"
        style={{ color: theme.colors.foreground, marginRight: theme.spacing.xs }}
      >
        $
      </Text>
    ),
    [theme],
  )

  const createSkuMutation = useMutation({
    mutationFn: async (values: AddSkuFormData) => {
      if (!userId) throw new Error(t("addSkuScreen:missingUserError"))

      const uomStored =
        values.uom_preset === "Other"
          ? values.uom_other?.trim() || null
          : values.uom_preset.trim() || null

      const payload = {
        name: values.name.trim(),
        sku_code: values.sku_code?.trim() ? values.sku_code.trim() : null,
        description: values.description?.trim() ? values.description.trim() : null,
        price: Number(values.price.trim()),
        uom: uomStored,
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      if (editingSku?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.sku.detail(editingSku.id) })
      }
      reset(EMPTY_FORM)
      navigation.setParams(undefined)
      navigation.navigate("Inventory")
      toast.show({
        title: t("addSkuScreen:saveSuccessTitle"),
        variant: "success",
      })
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

  const pending = createSkuMutation.isPending
  const canSave = isValid && !pending

  const handleDescriptionKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e.nativeEvent.key
      if (Platform.OS === "web" && key === "Tab") {
        e.preventDefault()
        priceRef.current?.focus()
        return
      }
      if (key === "Enter") {
        e.preventDefault?.()
        priceRef.current?.focus()
      }
    },
    [],
  )

  const keyboardScrollBottomSpace = TAB_BAR_CONTENT_HEIGHT + insets.bottom + theme.spacing.lg

  return (
    <View style={styles.root}>
      <Header
        titleTypography="stack"
        titleTx={isEditMode ? "addSkuScreen:editTitle" : "addSkuScreen:title"}
        safeAreaEdges={["top"]}
        RightActionComponent={
          <TouchableOpacity
            onPress={canSave ? handleSubmit(onSubmit) : undefined}
            disabled={!canSave}
            style={styles.headerSaveTouch}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
          >
            <Text
              weight="semiBold"
              size="md"
              tx="addSkuScreen:headerSave"
              style={{ color: canSave ? theme.colors.primary : theme.colors.foregroundSecondary }}
            />
          </TouchableOpacity>
        }
      />
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bottomOffset={theme.spacing.md}
        extraKeyboardSpace={keyboardScrollBottomSpace}
        showsVerticalScrollIndicator={false}
      >
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField
              ref={nameRef}
              labelTx="addSkuScreen:nameLabel"
              placeholderTx="addSkuScreen:namePlaceholder"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => skuCodeRef.current?.focus()}
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
              ref={skuCodeRef}
              labelTx="addSkuScreen:skuCodeLabel"
              placeholderTx="addSkuScreen:skuCodePlaceholder"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="characters"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => descriptionRef.current?.focus()}
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
              ref={descriptionRef}
              labelTx="addSkuScreen:descriptionLabel"
              placeholderTx="addSkuScreen:descriptionPlaceholder"
              value={field.value}
              onChangeText={(text) => {
                const prev = field.value ?? ""
                const isReturnAtEnd = text === `${prev}\n` || text === `${prev}\r\n`
                if (isReturnAtEnd) {
                  field.onChange(prev)
                  requestAnimationFrame(() => priceRef.current?.focus())
                  return
                }
                field.onChange(text)
              }}
              onBlur={field.onBlur}
              multiline
              blurOnSubmit
              returnKeyType="next"
              onSubmitEditing={() => priceRef.current?.focus()}
              onKeyPress={handleDescriptionKeyPress}
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
              ref={priceRef}
              labelTx="addSkuScreen:priceLabel"
              placeholderTx="addSkuScreen:pricePlaceholder"
              value={field.value}
              onChangeText={(text) => field.onChange(sanitizeDecimalPriceInput(text))}
              onBlur={() => {
                field.onChange(formatPriceTwoDecimals(field.value))
                field.onBlur()
              }}
              keyboardType={Platform.OS === "web" ? "default" : "decimal-pad"}
              LeftAccessory={priceDollarAccessory}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                if (uomPresetWatch === "Other") uomOtherRef.current?.focus()
                else safetyStockRef.current?.focus()
              }}
              status={fieldState.error ? "error" : "default"}
              helper={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="uom_preset"
          render={({ field, fieldState }) => {
            const triggerLabel = !field.value
              ? t("addSkuScreen:uomPickerPlaceholder")
              : field.value === "Other" && uomOtherWatch?.trim()
                ? `${t("addSkuScreen:uomOptionOther")}: ${uomOtherWatch.trim()}`
                : field.value === "Other"
                  ? t("addSkuScreen:uomOptionOther")
                  : field.value
            return (
              <View>
                <Text preset="label" tx="addSkuScreen:uomLabel" style={styles.uomFieldLabel} />
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss()
                    setUomModalVisible(true)
                  }}
                  style={[
                    styles.uomTrigger,
                    fieldState.error ? styles.uomTriggerError : undefined,
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={styles.uomTriggerText}
                    color={field.value ? "primary" : "tertiary"}
                    text={triggerLabel}
                  />
                  <Ionicons name="chevron-down" size={20} color={theme.colors.foregroundSecondary} />
                </Pressable>
                {fieldState.error?.message ? (
                  <Text size="sm" color="error" style={styles.uomFieldHelper}>
                    {fieldState.error.message}
                  </Text>
                ) : null}
              </View>
            )
          }}
        />

        {uomPresetWatch === "Other" ? (
          <Controller
            control={control}
            name="uom_other"
            render={({ field, fieldState }) => (
              <TextField
                ref={uomOtherRef}
                labelTx="addSkuScreen:uomOtherLabel"
                placeholderTx="addSkuScreen:uomOtherPlaceholder"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => safetyStockRef.current?.focus()}
                status={fieldState.error ? "error" : "default"}
                helper={fieldState.error?.message}
              />
            )}
          />
        ) : null}

        <Modal
          visible={uomModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setUomModalVisible(false)}
        >
          <Pressable style={styles.uomModalBackdrop} onPress={() => setUomModalVisible(false)}>
            <View style={styles.uomModalCard} pointerEvents="box-none">
              <Text weight="semiBold" size="lg" style={styles.uomModalTitle} tx="addSkuScreen:uomModalTitle" />
              <FlatList
                data={[...UOM_PRESET_VALUES]}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                style={styles.uomModalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.uomModalRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setValue("uom_preset", item, { shouldValidate: true, shouldDirty: true })
                      if (item !== "Other") {
                        setValue("uom_other", "", { shouldValidate: true, shouldDirty: true })
                      }
                      setUomModalVisible(false)
                    }}
                  >
                    <Text size="md" text={item === "Other" ? t("addSkuScreen:uomOptionOther") : item} />
                  </TouchableOpacity>
                )}
              />
            </View>
          </Pressable>
        </Modal>

        <Controller
          control={control}
          name="safety_stock_threshold"
          render={({ field, fieldState }) => (
            <TextField
              ref={safetyStockRef}
              labelTx="addSkuScreen:safetyStockLabel"
              placeholderTx="addSkuScreen:safetyStockPlaceholder"
              value={field.value}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, "")
                field.onChange(digits)
              }}
              onBlur={field.onBlur}
              keyboardType="default"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
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
      </KeyboardAwareScrollView>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerSaveTouch: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing["3xl"],
    gap: theme.spacing.md,
  },
  errorContainer: {
    backgroundColor: theme.colors.errorBackground,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  uomFieldLabel: {
    marginBottom: theme.spacing.xs,
  },
  uomTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: theme.sizes.input.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
  },
  uomTriggerError: {
    borderColor: theme.colors.error,
  },
  uomTriggerText: {
    flex: 1,
    marginRight: theme.spacing.sm,
    fontSize: theme.typography.sizes.base,
  },
  uomFieldHelper: {
    marginTop: theme.spacing.xs,
  },
  uomModalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.palette.black + "99",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  uomModalCard: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "70%",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.lg,
  },
  uomModalTitle: {
    marginBottom: theme.spacing.sm,
  },
  uomModalList: {
    flexGrow: 0,
  },
  uomModalRow: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
}))
