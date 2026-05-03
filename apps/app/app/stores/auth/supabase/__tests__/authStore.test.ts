/**
 * Supabase Auth Store Tests
 *
 * Tests for the Supabase authentication store functionality
 */

import { act, renderHook, waitFor } from "@testing-library/react-native"

import * as supabaseService from "../../../../services/supabase"
import { useAuthStore } from "../authStore"

// Mock dependencies
jest.mock("../../../../services/supabase")
jest.mock("../../../../utils/rateLimiter", () => ({
  authRateLimiter: {
    isAllowed: jest.fn().mockResolvedValue(true),
    reset: jest.fn().mockResolvedValue(undefined),
    getRemainingAttempts: jest.fn().mockResolvedValue(5),
    getResetTime: jest.fn().mockResolvedValue(0),
  },
  passwordResetRateLimiter: {
    isAllowed: jest.fn().mockResolvedValue(true),
    reset: jest.fn().mockResolvedValue(undefined),
    getRemainingAttempts: jest.fn().mockResolvedValue(5),
    getResetTime: jest.fn().mockResolvedValue(0),
  },
  signUpRateLimiter: {
    isAllowed: jest.fn().mockResolvedValue(true),
    reset: jest.fn().mockResolvedValue(undefined),
    getRemainingAttempts: jest.fn().mockResolvedValue(5),
    getResetTime: jest.fn().mockResolvedValue(0),
  },
}))
jest.mock("../../../../utils/storage")

describe("AuthStore", () => {
  beforeEach(async () => {
    // Reset store state before each test
    const { result } = renderHook(() => useAuthStore())
    await act(async () => {
      await result.current.signOut()
    })
    // Reset rate limiter mocks
    const { authRateLimiter, passwordResetRateLimiter } = require("../../../../utils/rateLimiter")
    authRateLimiter.isAllowed.mockClear()
    authRateLimiter.isAllowed.mockResolvedValue(true)
    passwordResetRateLimiter.isAllowed.mockClear()
    passwordResetRateLimiter.isAllowed.mockResolvedValue(true)
  })

  describe("signIn", () => {
    it("should sign in successfully with valid credentials", async () => {
      const { result } = renderHook(() => useAuthStore())
      const mockUser = {
        id: "123",
        email: "test@example.com",
        email_confirmed_at: new Date().toISOString(), // Email must be confirmed
      }
      const mockSession = { user: mockUser, access_token: "token" }

      ;(supabaseService.supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })

      let signInResult: any
      await act(async () => {
        signInResult = await result.current.signIn("test@example.com", "password123")
      })

      expect(signInResult.error).toBeUndefined()
      expect(signInResult.session).toBe(mockSession)
      await waitFor(
        () => {
          expect(result.current.user?.email).toBe("test@example.com")
          expect(result.current.isAuthenticated).toBe(true)
        },
        { timeout: 3000 },
      )
    })

    it("should handle invalid credentials", async () => {
      const { result } = renderHook(() => useAuthStore())

      ;(supabaseService.supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: new Error("Invalid login credentials"),
      })

      const signInResult = await result.current.signIn("test@example.com", "wrongpassword")

      expect(signInResult.error).toBeDefined()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it("should handle email not confirmed error", async () => {
      const { result } = renderHook(() => useAuthStore())
      const mockUser = { id: "123", email: "test@example.com", email_confirmed_at: null }

      ;(supabaseService.supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: mockUser, session: null },
        error: new Error("Email not confirmed"),
      })

      let signInResult: any
      await act(async () => {
        signInResult = await result.current.signIn("test@example.com", "password123")
      })

      expect(signInResult.error).toBeDefined()
      await waitFor(() => {
        expect(result.current.user?.email).toBe("test@example.com")
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.isEmailConfirmed).toBe(false)
      })
    })
  })

  describe("signUp", () => {
    it("should sign up successfully", async () => {
      const { result } = renderHook(() => useAuthStore())
      const mockUser = {
        id: "123",
        email: "new@example.com",
        email_confirmed_at: new Date().toISOString(),
      }
      const mockSession = { user: mockUser, access_token: "token" }

      ;(supabaseService.supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })

      let signUpResult: any
      await act(async () => {
        signUpResult = await result.current.signUp("new@example.com", "password123")
      })

      expect(signUpResult.error).toBeUndefined()
      await waitFor(() => {
        expect(result.current.user?.email).toBe("new@example.com")
        expect(result.current.isAuthenticated).toBe(true)
      })
    })

    it("should handle sign up errors", async () => {
      const { result } = renderHook(() => useAuthStore())

      ;(supabaseService.supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: new Error("User already registered"),
      })

      const signUpResult = await result.current.signUp("existing@example.com", "password123")

      expect(signUpResult.error).toBeDefined()
    })
  })

  describe("signOut", () => {
    it("should sign out successfully", async () => {
      const { result } = renderHook(() => useAuthStore())

      // First sign in
      const mockUser = { id: "123", email: "test@example.com" }
      const mockSession = { user: mockUser, access_token: "token" }
      ;(supabaseService.supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })
      await act(async () => {
        await result.current.signIn("test@example.com", "password123")
      })

      // Then sign out
      ;(supabaseService.supabase.auth.signOut as jest.Mock).mockResolvedValue({})
      await act(async () => {
        await result.current.signOut()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe("resendConfirmationEmail", () => {
    it("should resend confirmation email successfully", async () => {
      const { result } = renderHook(() => useAuthStore())

      ;(supabaseService.supabase.auth.resend as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      })

      const resendResult = await result.current.resendConfirmationEmail("test@example.com")

      expect(resendResult.error).toBeUndefined()
    })

    it("should handle resend errors", async () => {
      const { result } = renderHook(() => useAuthStore())

      ;(supabaseService.supabase.auth.resend as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("User not found"),
      })

      const resendResult = await result.current.resendConfirmationEmail("nonexistent@example.com")

      expect(resendResult.error).toBeDefined()
    })
  })

  describe("resetPassword", () => {
    it("should reset password successfully", async () => {
      const { result } = renderHook(() => useAuthStore())

      ;(supabaseService.supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        error: null,
      })

      let resetResult: any
      await act(async () => {
        resetResult = await result.current.resetPassword("test@example.com")
      })

      expect(resetResult.error).toBeUndefined()
    })
  })
})
