/**
 * Auth Store Exports
 *
 * Public exports for the authentication store (Supabase implementation).
 */

// Export shared types and constants
export { GUEST_USER_KEY } from "./authConstants"
export type { AuthState, PersistedAuthState } from "./authTypes"

// Export from Supabase implementation
export { useAuthStore } from "./supabase/authStore"
export {
  syncOnboardingToDatabase,
  syncOnboardingStatus,
  fetchOnboardingFromDatabase,
  updateUserState,
  getEmailRedirectUrl,
  getPasswordResetRedirectUrl,
} from "./supabase/authHelpers"
