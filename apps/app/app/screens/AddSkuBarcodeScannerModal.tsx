import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, Linking, Modal, Platform, Pressable, View } from "react-native"
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from "expo-camera"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text } from "@/components"

const SKU_BARCODE_TYPES: BarcodeType[] = [
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code128",
  "code39",
  "codabar",
  "itf14",
  "datamatrix",
  "pdf417",
  "code93",
  "qr",
  "aztec",
]

const SKU_BARCODE_SCANNER_SETTINGS = { barcodeTypes: SKU_BARCODE_TYPES }

export type AddSkuBarcodeScannerModalProps = {
  visible: boolean
  onClose: () => void
  /** Raw barcode payload (trimmed in parent if needed). */
  onBarcodeScanned: (data: string) => void
}

/**
 * Full-screen barcode scanner. Lives in its own module so `expo-camera` is only
 * loaded when this file is dynamically imported (first time the scanner opens).
 */
export default function AddSkuBarcodeScannerModal({
  visible,
  onClose,
  onBarcodeScanned,
}: AddSkuBarcodeScannerModalProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  const [, requestCameraPermission] = useCameraPermissions()
  const [cameraAllowed, setCameraAllowed] = useState(false)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!visible || Platform.OS === "web") {
      setCameraAllowed(false)
      return
    }

    let cancelled = false
    setCameraAllowed(false)

    void (async () => {
      const result = await requestCameraPermission()
      if (cancelled) return
      if (!result.granted) {
        Alert.alert(t("addSkuScreen:barcodePermissionTitle"), t("addSkuScreen:barcodePermissionMessage"), [
          { text: t("common:cancel"), style: "cancel" },
          { text: t("common:openSettings"), onPress: () => void Linking.openSettings() },
        ])
        onCloseRef.current()
        return
      }
      setCameraAllowed(true)
    })()

    return () => {
      cancelled = true
    }
  }, [visible, requestCameraPermission, t])

  const handleNativeScan = useCallback(
    (scan: BarcodeScanningResult) => {
      const value = scan.data?.trim() ?? ""
      if (!value) return
      onBarcodeScanned(value)
      onClose()
    },
    [onBarcodeScanned, onClose],
  )

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.skuScannerRoot}>
        <View style={[styles.skuScannerHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("addSkuScreen:barcodeScannerClose")}
            onPress={onClose}
            style={styles.skuScannerCloseTouch}
            hitSlop={12}
          >
            <Ionicons name="close" size={28} color={theme.colors.palette.white} />
          </Pressable>
          <Text
            weight="semiBold"
            size="lg"
            tx="addSkuScreen:barcodeScannerTitle"
            style={styles.skuScannerTitle}
          />
          <View style={styles.skuScannerHeaderSpacer} />
        </View>
        {cameraAllowed ? (
          <CameraView
            style={styles.skuScannerCamera}
            facing="back"
            barcodeScannerSettings={SKU_BARCODE_SCANNER_SETTINGS}
            onBarcodeScanned={handleNativeScan}
          />
        ) : (
          <View style={styles.skuScannerCamera} />
        )}
        <View style={[styles.skuScannerHintWrap, { paddingBottom: insets.bottom + theme.spacing.md }]}>
          <Text size="sm" tx="addSkuScreen:barcodeScannerHint" style={styles.skuScannerHintText} />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create((theme) => ({
  skuScannerRoot: {
    flex: 1,
    backgroundColor: theme.colors.palette.black,
  },
  skuScannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  skuScannerCloseTouch: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  skuScannerTitle: {
    flex: 1,
    textAlign: "center",
    color: theme.colors.palette.white,
  },
  skuScannerHeaderSpacer: {
    width: 44,
  },
  skuScannerCamera: {
    flex: 1,
    width: "100%",
  },
  skuScannerHintWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.palette.black,
  },
  skuScannerHintText: {
    textAlign: "center",
    color: theme.colors.palette.white,
    opacity: 0.85,
  },
}))
