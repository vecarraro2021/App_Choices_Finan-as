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
  register: (
    name: string,
    email: string,
    pass: string,
    diagnosticAnswers?: Record<number | string, number>,
  ) => Promise<AuthModel>
  updateProfile: (data: { name?: string }) => Promise<void>
  changePassword: (
    oldPassword: string,
    newPassword: string,
    passwordConfirm: string,
  ) => Promise<void>
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

  const register = async (
    name: string,
    email: string,
    pass: string,
    diagnosticAnswers?: Record<number | string, number>,
  ) => {
    await pb.collection('users').create({
      name,
      email,
      password: pass,
      passwordConfirm: pass,
      emailVisibility: true,
    })
    await pb.collection('users').authWithPassword(email, pass)
    const newRecord = pb.authStore.record
    setUser(newRecord)

    // Se respostas de diagnóstico foram passadas durante o cadastro, gravá-las
    if (newRecord?.id && diagnosticAnswers && Object.keys(diagnosticAnswers).length > 0) {
      try {
        const { saveDiagnostic } = await import('@/services/diagnosticService')
        await saveDiagnostic({
          ownerId: newRecord.id,
          answers: diagnosticAnswers,
        })
      } catch (diagErr) {
        console.warn('Erro ao gravar diagnóstico no cadastro:', diagErr)
      }
    }

    // Garantir que a árvore inicial de categorias do usuário esteja provisionada
    if (newRecord?.id) {
      try {
        const existingCats = await pb.collection('categories').getFullList({
          filter: `owner = '${newRecord.id}'`,
          limit: 1,
        })
        if (existingCats.length === 0) {
          const defaultTaxonomy = [
            {
              name: 'Moradia',
              color: '#2563EB',
              icon: 'Home',
              subcategories: [
                'Aluguel',
                'Mercado',
                'Internet',
                'Luz',
                'Água',
                'Limpeza',
                'Utensílios e Móveis',
                'Lavanderia',
                'Manutenção Residencial',
              ],
            },
            {
              name: 'Cuidados Pessoais',
              color: '#EC4899',
              icon: 'Heart',
              subcategories: [
                'Farmácia',
                'Plano de Saúde',
                'Exames e Consultas',
                'Academia',
                'Atividades Esportivas',
                'Equipamentos e Manutenção',
                'Terapias e Saúde Mental',
                'Vestuário e Roupas',
                'Salão e Cabelo',
                'Beleza e Estética',
                'Massagem',
              ],
            },
            {
              name: 'Transporte',
              color: '#F59E0B',
              icon: 'Car',
              subcategories: [
                'Combustível',
                'Uber / Táxi',
                'Seguro do Carro',
                'Pedágios e Estacionamento',
                'Manutenção do Carro',
                'Inspeção e Impostos Auto',
                'Aluguel ou Compra Automóvel',
              ],
            },
            {
              name: 'Lazer',
              color: '#10B981',
              icon: 'Coffee',
              subcategories: [
                'Restaurantes',
                'Alimentação Fora',
                'Eventos e Shows',
                'Passagens Aéreas',
                'Turismo e Hospedagem',
                'Passagens Locais',
              ],
            },
            {
              name: 'Educação',
              color: '#8B5CF6',
              icon: 'BookOpen',
              subcategories: ['Cursos Online', 'Mentorias', 'Materiais e Livros'],
            },
            {
              name: 'Assinaturas',
              color: '#06B6D4',
              icon: 'Layers',
              subcategories: [
                'Streaming (Netflix, Spotify)',
                'Armazenamento em Nuvem (Google, Apple)',
                'Software e Ferramentas (Figma, Loom)',
                'Inteligência Artificial (ChatGPT, Claude)',
              ],
            },
            {
              name: 'Impostos',
              color: '#6366F1',
              icon: 'FileText',
              subcategories: ['Impostos Governamentais', 'Contribuições e Taxas Oficiais'],
            },
            {
              name: 'Tarifas Financeiras',
              color: '#F97316',
              icon: 'CreditCard',
              subcategories: ['Taxas Bancárias', 'Juros e Taxas Cartão', 'Seguro Pix / Conta'],
            },
            {
              name: 'Serviços',
              color: '#14B8A6',
              icon: 'Briefcase',
              subcategories: ['Contabilidade'],
            },
            {
              name: 'Social',
              color: '#84CC16',
              icon: 'Gift',
              subcategories: ['Presentes', 'Doações'],
            },
            {
              name: 'Investimentos',
              color: '#059669',
              icon: 'TrendingUp',
              subcategories: ['Investimentos', 'Degiro', 'Consorcio', 'Outros investimentos'],
            },
            {
              name: 'Extras',
              color: '#64748B',
              icon: 'PlusCircle',
              subcategories: [
                'Eletrônicos',
                'Material de Obra',
                'Serviço de Obra',
                'Não Categorizado',
              ],
            },
          ]

          for (const item of defaultTaxonomy) {
            const parentCat = await pb.collection('categories').create({
              name: item.name,
              type: 'main',
              estimated: 0,
              color: item.color,
              icon: item.icon,
              owner: newRecord.id,
            })

            for (const sub of item.subcategories) {
              await pb.collection('categories').create({
                name: sub,
                type: 'sub',
                parent: parentCat.id,
                estimated: 0,
                color: item.color,
                owner: newRecord.id,
              })
            }
          }
        }
      } catch (err) {
        console.warn('Bootstrap de categorias pós-registro:', err)
      }
    }

    return newRecord!
  }

  const updateProfile = async (data: { name?: string }) => {
    if (!pb.authStore.record?.id) throw new Error('Usuário não autenticado')
    const updated = await pb.collection('users').update(pb.authStore.record.id, data)
    setUser(updated)
  }

  const changePassword = async (
    oldPassword: string,
    newPassword: string,
    passwordConfirm: string,
  ) => {
    if (!pb.authStore.record?.id) throw new Error('Usuário não autenticado')
    const updated = await pb.collection('users').update(pb.authStore.record.id, {
      oldPassword,
      password: newPassword,
      passwordConfirm,
    })
    setUser(updated)
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
        updateProfile,
        changePassword,
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
