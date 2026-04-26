/**
 * ProfileScreen - Backend-Specific Profile & Settings
 *
 * This file conditionally exports the correct ProfileScreen based on your backend:
 * - Supabase: Uses React Query + Supabase SDK (ProfileScreen.supabase.tsx)
 * - Convex: Uses reactive queries (ProfileScreen.convex.tsx)
 *
 * The screen demonstrates proper data fetching patterns for your chosen backend.
 * Use it as a template when building your own profile/settings screens.
 *
 * HOW TO USE:
 * 1. Look at the version for your backend (.supabase.tsx or .convex.tsx)
 * 2. Copy the patterns for your own screens
 * 3. For Supabase: Use React Query + direct SDK calls
 * 4. For Convex: Use useQuery/useMutation from @/hooks/convex
 *
 * KEY DIFFERENCES:
 * - Supabase: Manual refetch with React Query, pull-to-refresh
 * - Convex: Reactive queries that auto-update, no manual refetch needed
 */

// Conditional export based on backend provider
// This ensures tree-shaking removes the unused version in production

export { ProfileScreen } from "./ProfileScreen.supabase"
