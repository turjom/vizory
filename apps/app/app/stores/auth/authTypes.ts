/**
 * Auth Store Types
 *
 * TypeScript interfaces and types for the authentication store
 */

import type { Session, User } from "../../types/auth"

/**
 * Authentication state interface
 */
export interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  isEmailConfirmed: boolean
  hasCompletedOnboarding: boolean
  onboardingStatusByUserId: Record<string, boolean>

  // Actions
  setSession: (session: Session | null) => void
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setHasCompletedOnboarding: (completed: boolean) => Promise<void>
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error?: Error; session?: Session | null }>
  signUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<{ error?: Error }>
  resendConfirmationEmail: (email: string) => Promise<{ error?: Error }>
  verifyEmail: (code: string) => Promise<{ error?: Error }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: Error }>
  initialize: () => Promise<void>
}

/**
 * Persisted auth state (only non-sensitive data)
 */
export type PersistedAuthState = Pick<AuthState, "onboardingStatusByUserId">
