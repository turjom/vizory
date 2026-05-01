import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/hooks"
import { supabase } from "@/services/supabase"

import { queryKeys } from "./queryKeys"

/** Thrown when the combined SKU list fetch exceeds {@link SKU_LIST_QUERY_TIMEOUT_MS}. */
export const SKU_LIST_QUERY_TIMEOUT_MESSAGE = "SKU_LIST_QUERY_TIMEOUT"

const SKU_LIST_QUERY_TIMEOUT_MS = 25_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(SKU_LIST_QUERY_TIMEOUT_MESSAGE)), ms)
    promise.then(
      (value) => {
        clearTimeout(id)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(id)
        reject(err)
      },
    )
  })
}

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
    // Inventory list: always refetch on screen focus/mount (overrides QueryClient 5m stale default)
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<SkuListItem[]> => {
      if (!userId) return []

      return withTimeout(
        (async () => {
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
        })(),
        SKU_LIST_QUERY_TIMEOUT_MS,
      )
    },
  })
}
