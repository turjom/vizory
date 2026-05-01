import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/hooks"
import { supabase } from "@/services/supabase"

import { queryKeys } from "./queryKeys"

interface SkuDetailRow {
  id: string
  name: string
  sku_code: string | null
  description: string | null
  price: number | null
  uom: string | null
  safety_stock_threshold: number
}

interface QuantityRow {
  total_quantity: number | null
}

interface AdjustmentRow {
  id: string
  adjustment_type: "PURCHASE" | "SALE" | "STOCK_TAKE" | "SCRAP"
  quantity: number
  reference_note: string | null
  created_at: string | null
}

export interface SkuDetailData {
  sku: SkuDetailRow
  currentQuantity: number
  adjustments: AdjustmentRow[]
}

export const useSkuDetailQuery = (skuId: string) => {
  const { userId } = useAuth()

  return useQuery({
    queryKey: queryKeys.sku.detail(skuId),
    enabled: !!userId && !!skuId,
    queryFn: async (): Promise<SkuDetailData> => {
      if (!userId) throw new Error("User not authenticated")

      const { data: skuData, error: skuError } = await supabase
        .from("skus")
        .select("id, name, sku_code, description, price, uom, safety_stock_threshold")
        .eq("id", skuId)
        .eq("user_id", userId)
        .single()

      if (skuError) throw skuError

      const { data: quantityData, error: quantityError } = await supabase
        .from("inventory_quantity")
        .select("total_quantity")
        .eq("sku_id", skuId)
        .eq("user_id", userId)
        .maybeSingle()

      if (quantityError) throw quantityError

      const { data: adjustmentsData, error: adjustmentsError } = await supabase
        .from("inventory_adjustments")
        .select("id, adjustment_type, quantity, reference_note, created_at")
        .eq("sku_id", skuId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (adjustmentsError) throw adjustmentsError

      return {
        sku: skuData as SkuDetailRow,
        currentQuantity: ((quantityData as QuantityRow | null)?.total_quantity ?? 0) as number,
        adjustments: (adjustmentsData ?? []) as AdjustmentRow[],
      }
    },
  })
}
