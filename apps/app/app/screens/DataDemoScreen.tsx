/**
 * DataDemoScreen - Backend-Specific Data Fetching Demo
 *
 * This file conditionally exports the correct DataDemoScreen based on your backend:
 * - Supabase: Uses React Query + Supabase SDK (DataDemoScreen.supabase.tsx)
 * - Convex: Uses reactive queries (DataDemoScreen.convex.tsx)
 *
 * The screen demonstrates proper data fetching patterns for your chosen backend.
 * Use it as a template when building your own data-driven screens.
 *
 * HOW TO USE:
 * 1. Look at the version for your backend (.supabase.tsx or .convex.tsx)
 * 2. Copy the patterns for your own screens
 * 3. For Supabase: Use React Query + direct SDK calls
 * 4. For Convex: Use useQuery/useMutation from @/hooks/convex
 */

// Conditional export based on backend provider
// This ensures tree-shaking removes the unused version in production

export { DataDemoScreen } from "./DataDemoScreen.supabase"
