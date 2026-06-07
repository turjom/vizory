import { ComponentProps } from "react"
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs"
import {
  CompositeScreenProps,
  NavigationContainer,
  NavigatorScreenParams,
} from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"

// Main Tab Navigator types
/** Serializable SKU snapshot for stack Edit SKU (same shape as prior Add-tab edit params). */
export type EditSkuRouteParams = {
  sku: {
    id: string
    name: string
    sku_code: string | null
    description: string | null
    price: number | null
    uom: string | null
    safety_stock_threshold: number
    photo_url?: string | null
  }
}

export type MainTabParamList = {
  Home: undefined
  Inventory: undefined
  Add: undefined
  Profile: undefined
}

// App Stack Navigator types
export type AppStackParamList = {
  Login: undefined
  Register: undefined
  ForgotPassword: undefined
  ResetPassword: { code?: string; token?: string; email?: string } | undefined
  EmailVerification: undefined
  MagicLink: undefined
  OTPVerification: { email: string; isConvex?: boolean }
  AuthCallback:
    | {
        code?: string
        access_token?: string
        refresh_token?: string
        state?: string
        token_hash?: string
        type?: string
      }
    | undefined
  Starter: undefined
  Paywall: undefined
  TrialExpired: undefined
  Profile: undefined
  ComponentShowcase: undefined
  DataDemo: undefined
  SkuDetail: {
    skuId: string
  }
  EditSku: EditSkuRouteParams
  InventoryAdjustment: {
    skuId: string
    skuName: string
    currentQuantity: number
  }
  StockTake: undefined
  Main: NavigatorScreenParams<MainTabParamList>
  // 🔥 Your screens go here
  // SHIPNATIVE_GENERATOR_ANCHOR_APP_STACK_PARAM_LIST
}

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  AppStackScreenProps<keyof AppStackParamList>
>

/** Add tab (create) or stack Edit SKU — same component, different routes. */
export type AddSkuScreenProps =
  | MainTabScreenProps<"Add">
  | NativeStackScreenProps<AppStackParamList, "EditSku">

export interface NavigationProps extends Partial<
  ComponentProps<typeof NavigationContainer<AppStackParamList>>
> {}
