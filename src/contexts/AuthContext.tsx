import React, { createContext, useContext, useEffect, useState } from 'react'
import type { AuthModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { Currency } from '@/types/finance'

interface AuthContextType {
  user: AuthModel | null
  loading: boolean
  currency: Currency
  setCurrency: (c: Currency) => void
  login: (email: string, pass: string) => Promise<void>
  register: (name: string, email: string, pass: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthModel | null>(pb.authStore.record)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('app_currency')
    return saved === 'EUR' || saved === 'BRL' ? (saved as Currency) : 'BRL'
  })

  const setCurrency = (c: Currency) => {
    const chosen = c === 'EUR' ? 'EUR' : 'BRL'
    setCurrencyState(chosen)
    localStorage.setItem('app_currency', chosen)
  }

  useEffect(() => {
    setUser(pb.authStore.record)
    setLoading(false)

    const unsubscribe = pb.authStore.onChange((_token, model) => {
      setUser(model)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    await pb.collection('users').authWithPassword(email, pass)
    setUser(pb.authStore.record)
  }

  const register = async (name: string, email: string, pass: string) => {
    await pb.collection('users').create({
      name,
      email,
      password: pass,
      passwordConfirm: pass,
      emailVisibility: true,
    })
    await pb.collection('users').authWithPassword(email, pass)
    setUser(pb.authStore.record)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        currency,
        setCurrency,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
