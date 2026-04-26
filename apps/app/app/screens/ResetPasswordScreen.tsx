/**
 * ResetPasswordScreen - Backend-Specific Password Reset
 *
 * This file conditionally exports the correct ResetPasswordScreen based on your backend:
 * - Supabase: Uses token/code verification from email links (ResetPasswordScreen.supabase.tsx)
 * - Convex: Uses OTP code verification (ResetPasswordScreen.convex.tsx)
 *
 * The screen demonstrates proper password reset patterns for your chosen backend.
 * Use it as a template when building your own auth screens.
 *
 * HOW TO USE:
 * 1. Look at the version for your backend (.supabase.tsx or .convex.tsx)
 * 2. Copy the patterns for your own screens
 * 3. For Supabase: Uses token from email link + session exchange
 * 4. For Convex: Uses 8-digit OTP code + new password in one step
 *
 * KEY DIFFERENCES:
 * - Supabase: Token verification via URL, exchanges for session, then updates password
 * - Convex: OTP code verification with email + code + newPassword in single signIn call
 */

// Conditional export based on backend provider
// This ensures tree-shaking removes the unused version in production

export { ResetPasswordScreen } from "./ResetPasswordScreen.supabase"
