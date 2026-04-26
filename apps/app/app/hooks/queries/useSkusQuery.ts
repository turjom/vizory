import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/hooks"
import { supabase } from "@/services/supabase"

import { queryKeys } from "./queryKeys"

interface SkuRow {
  id: string
  name: string
  sku_code: string
}

interface InventoryQuantityRow {
  sku_id: string
  total_quantity: number | null
}

export interface SkuListItem {
  id: string
  name: string
  skuCode: string
  totalQuantity: number
}

export const useSkusQuery = () => {
  const { userId } = useAuth()

  return useQuery({
    queryKey: queryKeys.sku.list(userId ?? null),
    enabled: !!userId,
    queryFn: async (): Promise<SkuListItem[]> => {
      if (!userId) return []

      const { data: skuData, error: skuError } = await supabase
        .from("skus")
        .select("id, name, sku_code")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (skuError) throw skuError

      const skus = (skuData ?? []) as SkuRow[]
      if (skus.length === 0) return []

      const skuIds = skus.map((sku) => sku.id)
      const { data: quantityData, error: quantityError } = await supabase
        .from("inventory_quantity")
        .select("sku_id, total_quantity")
        .eq("user_id", userId)
        .in("sku_id", skuIds)

      if (quantityError) throw quantityError

      const quantityBySkuId = new Map<string, number>()
      ;((quantityData ?? []) as InventoryQuantityRow[]).forEach((row) => {
        const previousValue = quantityBySkuId.get(row.sku_id) ?? 0
        quantityBySkuId.set(row.sku_id, previousValue + (row.total_quantity ?? 0))
      })

      return skus.map((sku) => ({
        id: sku.id,
        name: sku.name,
        skuCode: sku.sku_code,
        totalQuantity: quantityBySkuId.get(sku.id) ?? 0,
      }))
    },
  })
}
