/**
 * Widget Service - Backend-Agnostic
 *
 * This file conditionally exports the correct widget service based on your backend:
 * - Supabase: Uses Supabase REST API for widget data (widgets.supabase.ts)
 * - Convex: Uses Convex HTTP endpoints for widget data (widgets.convex.ts)
 *
 * Native widgets (iOS/Android) use HTTP endpoints to fetch data:
 * - Supabase: Direct REST API calls with Supabase URL/Key
 * - Convex: HTTP endpoint at /api/widgets/* with auth token
 *
 * HOW TO USE:
 * 1. Look at the version for your backend (.supabase.ts or .convex.ts)
 * 2. Use fetchWidgetData() for fetching widget data
 * 3. Use getWidgetConfig() to get config for native widgets
 *
 * KEY DIFFERENCES:
 * - Supabase: REST API with anon key, direct table access
 * - Convex: HTTP action endpoints, token-based auth
 */


// Conditional export based on backend provider
// This ensures tree-shaking removes the unused version in production

// eslint-disable-next-line @typescript-eslint/no-require-imports
const widgetService = require("./widgets.supabase")

// Re-export types for TypeScript
export type { WidgetCache } from "./widgets.supabase"

// Type definitions for the widget service functions
export interface FetchWidgetDataOptions {
  table: string
  select?: string
  filters?: Record<string, unknown>
  limit?: number
  orderBy?: { column: string; ascending?: boolean }
  requireAuth?: boolean
  cacheKey?: string
}

export interface FetchWidgetDataResult<T> {
  data: T | null
  error: Error | null
}

export const fetchWidgetData: <T = unknown>(
  options: FetchWidgetDataOptions,
) => Promise<FetchWidgetDataResult<T>> = widgetService.fetchWidgetData

export const clearWidgetCache: (key?: string) => void = widgetService.clearWidgetCache

export const getWidgetConfig: () => {
  supabaseUrl: string
  supabaseKey: string
  isMock: boolean
  convexUrl?: string
  backendType?: "convex" | "supabase"
} = widgetService.getWidgetConfig

export const validateWidgetData: <T>(data: T | null, validator?: (data: T) => boolean) => boolean =
  widgetService.validateWidgetData
