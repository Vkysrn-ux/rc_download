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
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signup: (
    name: string,
    email: string,
    phone: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateWalletBalance: (amount: number) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)
  const isAuthenticated = Boolean(user)

  useEffect(() => {
    refreshUser().finally(() => setInitializing(false))
  }, [])

  const refreshUser = async () => {
    const res = await fetch("/api/auth/me", { method: "GET" })
    const json = await res.json().catch(() => ({}))
    const me = json?.user ?? null
    setUser(me)
  }

  const signup = async (name: string, email: string, phone: string, password: string) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, phone, password }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.error || "Signup failed" }
    return { ok: true }
  }

  const login = async (identifier: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.error || "Login failed" }
    setUser(json.user)
    return { ok: true }
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
  }

  const updateWalletBalance = (amount: number) => {
    setUser((prev) => (prev ? { ...prev, walletBalance: amount } : prev))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        signup,
        logout,
        refreshUser,
        updateWalletBalance,
      }}
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
