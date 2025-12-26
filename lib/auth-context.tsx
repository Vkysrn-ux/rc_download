"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface User {
  id: string
  email: string
  name: string
  walletBalance: number
  role?: "user" | "admin"
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signup: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; requiresVerification?: boolean; verificationMethod?: string; debugOtp?: string }>
  requestOtp: (email: string) => Promise<{ ok: boolean; error?: string; debugOtp?: string }>
  verifyOtp: (email: string, otp: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateWalletBalance: (amount: number) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    refreshUser().finally(() => setInitializing(false))
  }, [])

  const refreshUser = async () => {
    const res = await fetch("/api/auth/me", { method: "GET" })
    const json = await res.json().catch(() => ({}))
    const me = json?.user ?? null
    setUser(me)
    setIsAuthenticated(Boolean(me))
  }

  const signup = async (name: string, email: string, password: string) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.error || "Signup failed" }
    return {
      ok: true,
      requiresVerification: Boolean(json?.requiresVerification),
      verificationMethod: typeof json?.verificationMethod === "string" ? json.verificationMethod : undefined,
      debugOtp: typeof json?.debugOtp === "string" ? json.debugOtp : undefined,
    }
  }

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.error || "Login failed" }
    setUser(json.user)
    setIsAuthenticated(true)
    return { ok: true }
  }

  const requestOtp = async (email: string) => {
    const res = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.error || "Failed to send OTP" }
    return { ok: true, debugOtp: typeof json?.debugOtp === "string" ? json.debugOtp : undefined }
  }

  const verifyOtp = async (email: string, otp: string) => {
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.error || "OTP verification failed" }
    setUser(json.user)
    setIsAuthenticated(true)
    return { ok: true }
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    setIsAuthenticated(false)
  }

  const updateWalletBalance = (amount: number) => {
    setUser((prev) => (prev ? { ...prev, walletBalance: amount } : prev))
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, login, signup, requestOtp, verifyOtp, logout, refreshUser, updateWalletBalance }}
    >
      {initializing ? null : children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
