import { lazy } from "react"

/**
 * Add SKU pulls in expo-camera (native). Load it only when the user opens Add/Edit SKU
 * so startup does not initialize the camera native module.
 */
export const LazyAddSkuScreen = lazy(() =>
  import("@/screens/AddSkuScreen").then((mod) => ({ default: mod.AddSkuScreen })),
)
