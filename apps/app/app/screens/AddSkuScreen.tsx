import { FC, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Image,
  InputAccessoryView,
  InteractionManager,
  Keyboard,
  Linking,
  Modal,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputKeyPressEventData,
} from "react-native"
import * as ImagePicker from "expo-image-picker"
import { Ionicons } from "@expo/vector-icons"
import { zodResolver } from "@hookform/resolvers/zod"
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { StyleSheet, useUnistyles } from "react-native-unistyles"
import { z } from "zod"

import { Button, Header, Text, TextField, useToast, type TextFieldAccessoryProps } from "@/components"
import { useAuth, useProfileQuery } from "@/hooks"
import { queryKeys } from "@/hooks/queries"
import type { AddSkuScreenProps, AppStackParamList, MainTabParamList } from "@/navigators/navigationTypes"
import { supabase } from "@/services/supabase"
import { uploadSkuPhotoToStorage } from "@/services/skuPhotoUpload"
import {
  deviceCurrencyCode,
  isPreferredCurrencyCode,
  symbolForCurrencyCode,
  type PreferredCurrencyCode,
} from "@/utils/currencyLocale"

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

/** On web, `nativeID` becomes the real `<input id="…">` (RN Web). Used for Tab handling. */
const ADD_SKU_PRICE_INPUT_WEB_ID = "vizory-add-sku-price"

const LazyAddSkuBarcodeScannerModal = lazy(() => import("./AddSkuBarcodeScannerModal"))

/** iOS: empty input accessory so the Price `decimal-pad` field does not show the default Done toolbar. */
const ADD_SKU_PRICE_INPUT_ACCESSORY_ID = "addSkuPriceInputAccessoryEmpty"

type SkuPhotoState =
  | { kind: "none" }
  | { kind: "remote"; url: string }
  | { kind: "local"; uri: string }

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

type AppStackNav = NativeStackNavigationProp<AppStackParamList>
type MainTabNav = BottomTabNavigationProp<MainTabParamList>

async function persistPreferredCurrencyOnFirstSkuSave(userId: string, queryClient: QueryClient) {
  const { data: row, error: selectError } = await supabase
    .from("profiles")
    .select("preferred_currency_code")
    .eq("id", userId)
    .maybeSingle()

  if (selectError || row?.preferred_currency_code) return

  const code = deviceCurrencyCode()
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ preferred_currency_code: code })
    .eq("id", userId)

  if (!updateError) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(userId) })
  }
}

export const AddSkuScreen: FC<AddSkuScreenProps> = function AddSkuScreen({ navigation, route }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { userId } = useAuth()
  const { data: profile } = useProfileQuery()
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState("")
  const isStackEdit = route.name === "EditSku"
  const editingSku = isStackEdit ? route.params.sku : undefined
  const isEditMode = !!editingSku

  const nameRef = useRef<TextInput>(null)
  const skuCodeRef = useRef<TextInput>(null)
  const descriptionRef = useRef<TextInput>(null)
  const priceRef = useRef<TextInput>(null)
  const uomOtherRef = useRef<TextInput>(null)
  const safetyStockRef = useRef<TextInput>(null)
  const [uomModalVisible, setUomModalVisible] = useState(false)
  const [skuPhotoState, setSkuPhotoState] = useState<SkuPhotoState>({ kind: "none" })
  const [skuCodeDuplicateError, setSkuCodeDuplicateError] = useState<string | null>(null)
  const [skuScannerVisible, setSkuScannerVisible] = useState(false)

  const closeSkuScanner = useCallback(() => {
    setSkuScannerVisible(false)
  }, [])

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
    formState: { isValid: formIsValid },
  } = useForm<AddSkuFormData>({
    resolver: zodResolver(addSkuSchema),
    mode: "onChange",
    defaultValues: EMPTY_FORM,
  })

  useEffect(() => {
    const sku = isStackEdit ? route.params.sku : undefined
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
    setSkuPhotoState(
      sku?.photo_url ? { kind: "remote", url: sku.photo_url } : { kind: "none" },
    )
  }, [isStackEdit, route.params, reset])

  const uomPresetWatch = useWatch({ control, name: "uom_preset" })
  const uomOtherWatch = useWatch({ control, name: "uom_other" })

  const displayCurrencyCode: PreferredCurrencyCode = useMemo(() => {
    const stored = profile?.preferred_currency_code
    if (isPreferredCurrencyCode(stored)) return stored
    return deviceCurrencyCode()
  }, [profile?.preferred_currency_code])

  const priceSymbol = symbolForCurrencyCode(displayCurrencyCode)

  const priceCurrencyAccessory = useCallback(
    (_props: TextFieldAccessoryProps) => (
      <Text
        weight="semiBold"
        size="md"
        style={{ color: theme.colors.foreground, marginRight: theme.spacing.xs }}
      >
        {priceSymbol}
      </Text>
    ),
    [priceSymbol, theme.colors.foreground, theme.spacing.xs],
  )

  const createSkuMutation = useMutation({
    mutationFn: async (vars: { values: AddSkuFormData; skuPhoto: SkuPhotoState }) => {
      const { values, skuPhoto } = vars
      if (!userId) throw new Error(t("addSkuScreen:missingUserError"))

      const uomStored =
        values.uom_preset === "Other"
          ? values.uom_other?.trim() || null
          : values.uom_preset.trim() || null

      const basePayload = {
        name: values.name.trim(),
        sku_code: values.sku_code?.trim() ? values.sku_code.trim() : null,
        description: values.description?.trim() ? values.description.trim() : null,
        price: Number(values.price.trim()),
        uom: uomStored,
        safety_stock_threshold: Number(values.safety_stock_threshold),
      }

      if (isEditMode && editingSku?.id) {
        let photo_url: string | null = skuPhoto.kind === "remote" ? skuPhoto.url : null
        if (skuPhoto.kind === "local") {
          try {
            photo_url = await uploadSkuPhotoToStorage(supabase, userId, editingSku.id, skuPhoto.uri)
          } catch {
            throw new Error("PHOTO_UPLOAD_FAILED")
          }
        }

        const { error: skuUpdateError } = await supabase
          .from("skus")
          .update({ ...basePayload, photo_url })
          .eq("id", editingSku.id)
          .eq("user_id", userId)

        if (skuUpdateError) throw skuUpdateError
        return { insertedSkuId: undefined as string | undefined }
      }

      const { data: insertedSku, error: skuInsertError } = await supabase
        .from("skus")
        .insert({
          ...basePayload,
          user_id: userId,
          photo_url: null,
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

      if (skuPhoto.kind === "local") {
        try {
          const publicUrl = await uploadSkuPhotoToStorage(
            supabase,
            userId,
            insertedSku.id,
            skuPhoto.uri,
          )
          const { error: photoUpdateError } = await supabase
            .from("skus")
            .update({ photo_url: publicUrl })
            .eq("id", insertedSku.id)
            .eq("user_id", userId)

          if (photoUpdateError) throw photoUpdateError
        } catch {
          throw new Error("PHOTO_UPLOAD_FAILED")
        }
      }

      return { insertedSkuId: insertedSku.id }
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sku.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      if (editingSku?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.sku.detail(editingSku.id) })
      }
      if (result?.insertedSkuId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.sku.detail(result.insertedSkuId) })
      }
      if (userId) {
        await persistPreferredCurrencyOnFirstSkuSave(userId, queryClient)
      }
      reset(EMPTY_FORM)
      setSkuPhotoState({ kind: "none" })
      if (route.name === "EditSku") {
        ;(navigation as AppStackNav).navigate("Main", { screen: "Inventory" })
      } else {
        ;(navigation as MainTabNav).navigate("Inventory")
      }
      toast.show({
        title: t("addSkuScreen:saveSuccessTitle"),
        variant: "success",
      })
    },
  })

  const deleteSkuMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !editingSku?.id) throw new Error("Not signed in")
      const skuId = editingSku.id

      const { error: adjustmentsError } = await supabase
        .from("inventory_adjustments")
        .delete()
        .eq("sku_id", skuId)
        .eq("user_id", userId)
      if (adjustmentsError) throw adjustmentsError

      const { error: stockTakesError } = await supabase
        .from("stock_takes")
        .delete()
        .eq("sku_id", skuId)
        .eq("user_id", userId)
      if (stockTakesError) throw stockTakesError

      const { error: quantityError } = await supabase
        .from("inventory_quantity")
        .delete()
        .eq("sku_id", skuId)
        .eq("user_id", userId)
      if (quantityError) throw quantityError

      const { error: skuError } = await supabase.from("skus").delete().eq("id", skuId).eq("user_id", userId)
      if (skuError) throw skuError

      return { deletedId: skuId }
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sku.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      await queryClient.removeQueries({ queryKey: queryKeys.sku.detail(result.deletedId) })
      ;(navigation as AppStackNav).navigate("Main", { screen: "Inventory" })
      toast.show({
        title: t("skuDetailScreen:deleteSkuSuccessTitle"),
        variant: "success",
      })
    },
    onError: () => {
      toast.show({
        title: t("skuDetailScreen:deleteSkuError"),
        variant: "error",
      })
    },
  })

  const promptDeleteSku = useCallback(() => {
    const name =
      editingSku?.name?.trim() || t("skuDetailScreen:deleteSkuAlertUnnamedName")
    Alert.alert(
      t("skuDetailScreen:deleteSkuAlertTitle", { name }),
      t("skuDetailScreen:deleteSkuAlertMessage"),
      [
        { text: t("common:cancel"), style: "cancel" },
        {
          text: t("skuDetailScreen:deleteSkuConfirm"),
          style: "destructive",
          onPress: () => deleteSkuMutation.mutate(),
        },
      ],
    )
  }, [deleteSkuMutation, editingSku?.name, t])

  const handleBackFromEdit = useCallback(() => {
    const id = editingSku?.id
    if (!id) return
    ;(navigation as AppStackNav).navigate("SkuDetail", { skuId: id })
  }, [editingSku?.id, navigation])

  const pickSkuImageFromSource = useCallback(
    async (source: "camera" | "library") => {
      try {
        if (source === "camera") {
          const { status } = await ImagePicker.requestCameraPermissionsAsync()
          if (status !== "granted") {
            toast.show({
              title: t("addSkuScreen:photoPermissionCamera"),
              description: t("addSkuScreen:photoPermissionHint"),
              variant: "error",
              action: {
                label: t("common:openSettings"),
                onPress: () => {
                  void Linking.openSettings()
                },
              },
            })
            return
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 1,
          })
          if (result.canceled || !result.assets[0]?.uri) return
          setSkuPhotoState({ kind: "local", uri: result.assets[0].uri })
          return
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== "granted") {
          toast.show({
            title: t("addSkuScreen:photoPermissionLibrary"),
            description: t("addSkuScreen:photoPermissionHint"),
            variant: "error",
            action: {
              label: t("common:openSettings"),
              onPress: () => {
                void Linking.openSettings()
              },
            },
          })
          return
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: false,
          quality: 1,
        })
        if (result.canceled || !result.assets[0]?.uri) return
        setSkuPhotoState({ kind: "local", uri: result.assets[0].uri })
      } catch {
        toast.show({
          title: t("addSkuScreen:photoUploadFailed"),
          variant: "error",
        })
      }
    },
    [t, toast],
  )

  const openSkuPhotoSheet = useCallback(() => {
    const take = t("addSkuScreen:photoTakePhoto")
    const library = t("addSkuScreen:photoChooseLibrary")
    const cancel = t("common:cancel")
    const title = t("addSkuScreen:photoActionTitle")

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: [cancel, take, library],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) void pickSkuImageFromSource("camera")
          if (buttonIndex === 2) void pickSkuImageFromSource("library")
        },
      )
      return
    }

    Alert.alert(title, undefined, [
      { text: take, onPress: () => void pickSkuImageFromSource("camera") },
      { text: library, onPress: () => void pickSkuImageFromSource("library") },
      { text: cancel, style: "cancel" },
    ])
  }, [pickSkuImageFromSource, t])

  const onSubmit = async (values: AddSkuFormData) => {
    setSaveError("")
    setSkuCodeDuplicateError(null)

    const trimmedSkuCode = values.sku_code?.trim() ?? ""
    if (!isEditMode && trimmedSkuCode && userId) {
      const { data: existing, error: dupError } = await supabase
        .from("skus")
        .select("id")
        .eq("user_id", userId)
        .eq("sku_code", trimmedSkuCode)
        .maybeSingle()

      if (dupError) {
        setSaveError(t("addSkuScreen:saveErrorGeneric"))
        return
      }
      if (existing) {
        setSkuCodeDuplicateError(t("addSkuScreen:validationSkuCodeDuplicate"))
        return
      }
    }

    createSkuMutation.mutate(
      { values, skuPhoto: skuPhotoState },
      {
        onError: (err) => {
          const message = err instanceof Error ? err.message : ""
          setSaveError(
            message === "PHOTO_UPLOAD_FAILED"
              ? t("addSkuScreen:photoUploadFailed")
              : t("addSkuScreen:saveErrorGeneric"),
          )
        },
      },
    )
  }

  const pending = createSkuMutation.isPending || deleteSkuMutation.isPending
  const canSave = formIsValid && !pending && !skuCodeDuplicateError

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

  const openUomPickerFromKeyboard = useCallback(() => {
    Keyboard.dismiss()
    setUomModalVisible(true)
  }, [])

  /**
   * Web: `priceRef` is not guaranteed to be a DOM node (useImperativeHandle / host refs), so
   * attaching `addEventListener` on it was unreliable. Intercept Tab in the **capture** phase
   * on `document` when the event target is our price `<input>` (identified by `nativeID` → `id`).
   */
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return

    const onDocumentKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.shiftKey) return
      const t = e.target
      if (!t || (t as HTMLElement).nodeName !== "INPUT") return
      if ((t as HTMLInputElement).id !== ADD_SKU_PRICE_INPUT_WEB_ID) return
      e.preventDefault()
      e.stopPropagation()
      openUomPickerFromKeyboard()
    }

    document.addEventListener("keydown", onDocumentKeyDownCapture, true)
    return () => document.removeEventListener("keydown", onDocumentKeyDownCapture, true)
  }, [openUomPickerFromKeyboard])

  const selectUomPresetAndClose = useCallback(
    (item: string) => {
      setValue("uom_preset", item, { shouldValidate: true, shouldDirty: true })
      if (item !== "Other") {
        setValue("uom_other", "", { shouldValidate: true, shouldDirty: true })
      }
      setUomModalVisible(false)

      InteractionManager.runAfterInteractions(() => {
        if (item === "Other") {
          uomOtherRef.current?.focus()
        } else {
          safetyStockRef.current?.focus()
        }
      })
    },
    [setValue],
  )

  const openSkuBarcodeScanner = useCallback(() => {
    if (Platform.OS === "web") {
      toast.show({
        title: t("addSkuScreen:barcodeScannerUnavailableWeb"),
        variant: "error",
      })
      return
    }
    setSkuScannerVisible(true)
  }, [t, toast])

  const handleBarcodeScanned = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      setSkuCodeDuplicateError(null)
      setValue("sku_code", trimmed.slice(0, 64), { shouldValidate: true, shouldDirty: true })
      setSkuScannerVisible(false)
    },
    [setValue],
  )

  const skuCodeScanAccessory = useCallback(
    (accessoryProps: TextFieldAccessoryProps) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("addSkuScreen:skuCodeScanBarcodeAccessibility")}
        onPress={openSkuBarcodeScanner}
        hitSlop={12}
        style={[accessoryProps.style, styles.skuScanAccessoryHit]}
        disabled={!accessoryProps.editable}
      >
        <Ionicons name="camera-outline" size={22} color={theme.colors.foregroundSecondary} />
      </Pressable>
    ),
    [openSkuBarcodeScanner, t, theme.colors.foregroundSecondary],
  )

  const keyboardScrollBottomSpace =
    (isStackEdit ? 0 : TAB_BAR_CONTENT_HEIGHT) + insets.bottom + theme.spacing.lg

  return (
    <View style={styles.root}>
      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={ADD_SKU_PRICE_INPUT_ACCESSORY_ID}>
          <View style={styles.priceInputAccessoryHidden} />
        </InputAccessoryView>
      ) : null}
      <Header
        titleTypography="stack"
        titleTx={isEditMode ? "addSkuScreen:editTitle" : "addSkuScreen:title"}
        safeAreaEdges={["top"]}
        {...(isEditMode && editingSku
          ? {
              leftIcon: "back" as const,
              onLeftPress: handleBackFromEdit,
            }
          : {})}
        RightActionComponent={
          <TouchableOpacity
            onPress={canSave ? handleSubmit(onSubmit) : undefined}
            disabled={!canSave}
            style={[
              styles.headerSaveTouch,
              formIsValid ? styles.headerSaveActive : styles.headerSaveInactive,
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
          >
            <Text
              weight="semiBold"
              size="md"
              tx="addSkuScreen:headerSave"
              style={formIsValid ? styles.headerSaveLabelActive : styles.headerSaveLabelInactive}
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
        <View style={styles.photoBlock}>
          <Text preset="label" tx="addSkuScreen:photoLabel" style={styles.photoLabel} />
          <Pressable
            onPress={openSkuPhotoSheet}
            style={styles.photoTouch}
            accessibilityRole="button"
            accessibilityLabel={t("addSkuScreen:photoLabel")}
          >
            {skuPhotoState.kind === "none" ? (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={28} color={theme.colors.foregroundSecondary} />
                <Text size="sm" color="secondary" tx="addSkuScreen:photoPlaceholder" style={styles.photoHint} />
              </View>
            ) : (
              <Image
                source={{
                  uri: skuPhotoState.kind === "local" ? skuPhotoState.uri : skuPhotoState.url,
                }}
                style={styles.photoThumb}
                resizeMode="cover"
              />
            )}
          </Pressable>
        </View>

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
              onChangeText={(text) => {
                setSkuCodeDuplicateError(null)
                field.onChange(text)
              }}
              onBlur={field.onBlur}
              autoCapitalize="characters"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => descriptionRef.current?.focus()}
              status={fieldState.error || skuCodeDuplicateError ? "error" : "default"}
              helper={skuCodeDuplicateError ?? fieldState.error?.message}
              RightAccessory={Platform.OS === "web" ? undefined : skuCodeScanAccessory}
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
                const hadTab = text.includes("\t")
                const cleaned = text.replace(/\t/g, "")

                const isReturnAtEnd = cleaned === `${prev}\n` || cleaned === `${prev}\r\n`
                if (isReturnAtEnd) {
                  field.onChange(prev)
                  requestAnimationFrame(() => priceRef.current?.focus())
                  return
                }

                if (hadTab) {
                  field.onChange(cleaned)
                  requestAnimationFrame(() => priceRef.current?.focus())
                  return
                }

                field.onChange(cleaned)
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
              nativeID={Platform.OS === "web" ? ADD_SKU_PRICE_INPUT_WEB_ID : undefined}
              labelTx="addSkuScreen:priceLabel"
              placeholderTx="addSkuScreen:pricePlaceholder"
              value={field.value}
              onChangeText={(text) => field.onChange(sanitizeDecimalPriceInput(text))}
              onBlur={() => {
                field.onChange(formatPriceTwoDecimals(field.value))
                field.onBlur()
              }}
              keyboardType={Platform.OS === "web" ? "default" : "decimal-pad"}
              inputAccessoryViewID={
                Platform.OS === "ios" ? ADD_SKU_PRICE_INPUT_ACCESSORY_ID : undefined
              }
              LeftAccessory={priceCurrencyAccessory}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={openUomPickerFromKeyboard}
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
                  onPress={openUomPickerFromKeyboard}
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
                    onPress={() => selectUomPresetAndClose(item)}
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

        {isEditMode ? (
          <Button
            tx="skuDetailScreen:deleteSkuButton"
            variant="danger"
            fullWidth
            style={styles.deleteSkuButton}
            onPress={promptDeleteSku}
            loading={deleteSkuMutation.isPending}
            disabled={deleteSkuMutation.isPending}
          />
        ) : null}

        {saveError ? (
          <View style={styles.errorContainer}>
            <Text size="sm" color="error">
              {saveError}
            </Text>
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      {skuScannerVisible ? (
        <Suspense fallback={null}>
          <LazyAddSkuBarcodeScannerModal
            visible={skuScannerVisible}
            onClose={closeSkuScanner}
            onBarcodeScanned={handleBarcodeScanned}
          />
        </Suspense>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  priceInputAccessoryHidden: {
    height: 0,
    width: "100%",
  },
  headerSaveTouch: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    marginRight: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  headerSaveInactive: {
    backgroundColor: "#D1D5DB",
  },
  headerSaveActive: {
    backgroundColor: "#F97316",
  },
  headerSaveLabelInactive: {
    color: "#9CA3AF",
  },
  headerSaveLabelActive: {
    color: "#FFFFFF",
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
  deleteSkuButton: {
    marginTop: theme.spacing.xs,
  },
  photoBlock: {
    gap: theme.spacing.xs,
  },
  photoLabel: {
    marginBottom: theme.spacing.xxs,
  },
  photoTouch: {
    alignSelf: "flex-start",
  },
  photoPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
  },
  photoHint: {
    textAlign: "center",
  },
  photoThumb: {
    width: 112,
    height: 112,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.input,
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
  skuScanAccessoryHit: {
    justifyContent: "center",
    alignItems: "center",
    minWidth: 36,
    minHeight: 36,
  },
}))
