import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/hooks"
import { supabase } from "@/services/supabase"

import { queryKeys } from "./queryKeys"

interface SkuRow {
  id: string
  name: string
  safety_stock_threshold: number
  price: number | null
}

interface QuantityRow {
  sku_id: string
  total_quantity: number | null
}

interface AdjustmentRow {
  adjustment_type: "PURCHASE" | "SALE"
  quantity: number
}

export interface LowStockSku {
  id: string
  name: string
  totalQuantity: number
  safetyStockThreshold: number
}

export interface TopSkuByQuantity {
  id: string
  name: string
  totalQuantity: number
}

export interface WeeklyMovement {
  received: number
  sold: number
}

export interface DashboardInventoryData {
  /** Trimmed `profiles.first_name` for the current user, if present. */
  greetingFirstName: string | null
  lowStockSkus: LowStockSku[]
  topSkusByQuantity: TopSkuByQuantity[]
  weeklyMovement: WeeklyMovement
  totalInventoryValue: number | null
}

function mergeQuantities(skus: SkuRow[], quantities: QuantityRow[]) {
  const quantityBySkuId = new Map<string, number>()
  quantities.forEach((row) => {
    const prev = quantityBySkuId.get(row.sku_id) ?? 0
    quantityBySkuId.set(row.sku_id, prev + (row.total_quantity ?? 0))
  })

  return skus.map((sku) => ({
    id: sku.id,
    name: sku.name,
    safetyStockThreshold: sku.safety_stock_threshold,
    totalQuantity: quantityBySkuId.get(sku.id) ?? 0,
    price: sku.price,
  }))
}

export const useDashboardInventoryQuery = () => {
  const { userId } = useAuth()

  return useQuery({
    queryKey: queryKeys.dashboard.inventory(userId ?? null),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<DashboardInventoryData> => {
      if (!userId) {
        return {
          greetingFirstName: null,
          lowStockSkus: [],
          topSkusByQuantity: [],
          weeklyMovement: { received: 0, sold: 0 },
          totalInventoryValue: null,
        }
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [skusResult, quantitiesResult, adjustmentsResult, profileResult] = await Promise.all([
        supabase
          .from("skus")
          .select("id, name, safety_stock_threshold, price")
          .eq("user_id", userId)
          .order("name", { ascending: true }),
        supabase.from("inventory_quantity").select("sku_id, total_quantity").eq("user_id", userId),
        supabase
          .from("inventory_adjustments")
          .select("adjustment_type, quantity")
          .eq("user_id", userId)
          .gte("created_at", sevenDaysAgo),
        supabase.from("profiles").select("first_name").eq("id", userId).maybeSingle(),
      ])

      if (skusResult.error) throw skusResult.error
      if (quantitiesResult.error) throw quantitiesResult.error
      if (adjustmentsResult.error) throw adjustmentsResult.error
      if (profileResult.error) throw profileResult.error

      const skus = (skusResult.data ?? []) as SkuRow[]
      const quantities = (quantitiesResult.data ?? []) as QuantityRow[]
      const adjustments = (adjustmentsResult.data ?? []) as AdjustmentRow[]

      const merged = mergeQuantities(skus, quantities)
      const totalInventoryValue = merged.reduce((sum, row) => {
        if (row.price == null) return sum
        return sum + row.price * row.totalQuantity
      }, 0)
      const hasAnyPrice = merged.some((row) => row.price != null)

      const rawFirst = profileResult.data?.first_name
      const greetingFirstName =
        typeof rawFirst === "string" && rawFirst.trim().length > 0 ? rawFirst.trim() : null

      const lowStockRows = merged.filter((row) => row.totalQuantity <= row.safetyStockThreshold)
      lowStockRows.sort((a, b) => {
        const deficitA = a.safetyStockThreshold - a.totalQuantity
        const deficitB = b.safetyStockThreshold - b.totalQuantity
        return deficitB - deficitA
      })
      const lowStockSkus = lowStockRows.map((row) => ({
        id: row.id,
        name: row.name,
        totalQuantity: row.totalQuantity,
        safetyStockThreshold: row.safetyStockThreshold,
      }))

      const topSkusByQuantity = [...merged]
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          name: row.name,
          totalQuantity: row.totalQuantity,
        }))

      let received = 0
      let sold = 0
      adjustments.forEach((adj) => {
        if (adj.adjustment_type === "PURCHASE") received += adj.quantity
        if (adj.adjustment_type === "SALE") sold += adj.quantity
      })

      return {
        greetingFirstName,
        lowStockSkus,
        topSkusByQuantity,
        weeklyMovement: { received, sold },
        totalInventoryValue: hasAnyPrice ? totalInventoryValue : null,
      }
    },
  })
}
