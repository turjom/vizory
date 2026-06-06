/**
 * Format Authentication Error
 *
 * Centralized error message formatting for authentication operations.
 * Converts technical error messages into user-friendly strings.
 */

/**
 * Formats authentication errors into user-friendly messages.
 *
 * Handles various error types including:
 * - Email not confirmed (returns empty string for AppNavigator handling)
 * - Network errors
 * - Invalid credentials
 * - Already registered users
 * - Rate limiting
 *
 * @param error - The error object from auth operations
 * @returns A user-friendly error message string, or empty string for email not confirmed
 *
 * @example
 * ```typescript
 * const message = formatAuthError(new Error("Email not confirmed"))
 * // Returns: "" (empty string - AppNavigator handles navigation)
 *
 * const networkError = formatAuthError(new Error("Network request failed"))
 * // Returns: "Network error. Please check your internet connection and try again."
 * ```
 */
export function formatAuthError(error: Error): string {
  if (!error || !error.message) {
    return "An unexpected error occurred. Please try again."
  }

  const errorMessage = error.message.toLowerCase()

  // Email not confirmed - special handling (no error message shown, navigation handled by AppNavigator)
  if (
    errorMessage.includes("email not confirmed") ||
    errorMessage.includes("email_not_confirmed") ||
    errorMessage.includes("not confirmed")
  ) {
    return "" // Empty string - AppNavigator will handle navigation
  }


  // Network errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("request failed") ||
    errorMessage.includes("failed to fetch") ||
    errorMessage.includes("dns") ||
    errorMessage.includes("host")
  ) {
    if (__DEV__) {
      return "Network error. Check your internet connection and verify if your Supabase project is paused in the dashboard."
    }
    return "Network error. Please check your internet connection and try again."
  }

  // Invalid credentials
  if (errorMessage.includes("invalid")) {
    return "Invalid email or password. Please try again."
  }

  // Email not found
  if (errorMessage.includes("email") && errorMessage.includes("not found")) {
    return "Email not found. Please check your email or sign up."
  }

  // Already registered
  if (
    errorMessage.includes("already registered") ||
    errorMessage.includes("user already registered") ||
    errorMessage.includes("email already exists")
  ) {
    return "This email is already registered. Please sign in instead."
  }
// Email rate limit
  if (errorMessage.includes("over_email_send_rate_limit") || errorMessage.includes("email rate limit")) {
     return "Too many attempts. Please wait a few minutes before trying again."
  }
  // Email validation
  if (errorMessage.includes("email") && !errorMessage.includes("not found")) {
    return "Please enter a valid email address."
  }

  // Password validation
  if (errorMessage.includes("password")) {
    return "Password does not meet requirements. Please try again."
  }

  // Rate limiting
  if (errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
    // Extract time if available
    const timeMatch = errorMessage.match(/(\d+)\s*(minute|second|hour)/i)
    if (timeMatch) {
      return error.message // Use original message which includes time
    }
    return "Too many attempts. Please wait a moment before trying again."
  }

  // Default: return original message or generic error
  return error.message || "Something went wrong. Please try again."
}
