/**
 * Query Keys Factory
 *
 * Type-safe query key management with hierarchical structure
 */

/**
 * Query key factory for user-related queries
 */
export const userKeys = {
  all: ["user"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  profile: (userId: string) => [...userKeys.all, "profile", userId] as const,
}

/**
 * Query key factory for subscription-related queries
 */
export const subscriptionKeys = {
  all: ["subscription"] as const,
  status: () => [...subscriptionKeys.all, "status"] as const,
  entitlements: () => [...subscriptionKeys.all, "entitlements"] as const,
  products: () => [...subscriptionKeys.all, "products"] as const,
  offerings: () => [...subscriptionKeys.all, "offerings"] as const,
}

/**
 * Query key factory for analytics-related queries
 */
export const analyticsKeys = {
  all: ["analytics"] as const,
  events: () => [...analyticsKeys.all, "events"] as const,
  event: (id: string) => [...analyticsKeys.events(), id] as const,
}

/**
 * Query key factory for app-related queries
 */
export const appKeys = {
  all: ["app"] as const,
  config: () => [...appKeys.all, "config"] as const,
  features: () => [...appKeys.all, "features"] as const,
}

/**
 * Query key factory for widget-related queries
 */
export const widgetKeys = {
  all: ["widget"] as const,
  list: (params: {
    table: string
    select?: string
    filters?: Record<string, unknown>
    limit?: number
    orderBy?: { column: string; ascending?: boolean }
    requireAuth?: boolean
  }) => [...widgetKeys.all, params] as const,
  cache: (cacheKey: string) => [...widgetKeys.all, "cache", cacheKey] as const,
}

/**
 * Query key factory for SKU-related queries
 */
export const skuKeys = {
  all: ["sku"] as const,
  lists: () => [...skuKeys.all, "list"] as const,
  list: (userId: string | null) => [...skuKeys.lists(), userId] as const,
  details: () => [...skuKeys.all, "detail"] as const,
  detail: (skuId: string) => [...skuKeys.details(), skuId] as const,
  lastStockTakeBySku: (userId: string | null) =>
    [...skuKeys.all, "lastStockTakeBySku", userId] as const,
}

/**
 * Query key factory for dashboard inventory widgets
 */
export const dashboardKeys = {
  all: ["dashboard"] as const,
  inventory: (userId: string | null) => [...dashboardKeys.all, "inventory", userId] as const,
}

/**
 * All query keys
 */
export const queryKeys = {
  user: userKeys,
  subscription: subscriptionKeys,
  analytics: analyticsKeys,
  app: appKeys,
  widget: widgetKeys,
  sku: skuKeys,
  dashboard: dashboardKeys,
}
