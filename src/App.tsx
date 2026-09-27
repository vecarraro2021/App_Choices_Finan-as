import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Index from '@/pages/Index'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import OnboardingView from '@/pages/Onboarding'
import DiagnosticPage from '@/pages/Diagnostic'
import TransactionsView from '@/pages/Transactions'
import IncomeView from '@/pages/Income'
import BudgetVsActualView from '@/pages/BudgetVsActual'
import CategoriesView from '@/pages/Categories'
import AlertsView from '@/pages/Alerts'
import ConsultantView from '@/pages/Consultant'
import SettingsView from '@/pages/Settings'
import NotFound from '@/pages/NotFound'
import { useAuth } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

// Componente de Roteamento para a rota raiz `/`:
// Usuário autenticado -> Dashboard (Index sob Layout)
// Usuário NÃO autenticado -> Onboarding com Bússola Financeira
function RootRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Carregando...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return (
      <ProtectedRoute>
        <Layout>
          <Index />
        </Layout>
      </ProtectedRoute>
    )
  }

  return <OnboardingView />
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rota raiz condicional: Onboarding para não autenticados, Dashboard para autenticados */}
          <Route path="/" element={<RootRoute />} />

          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/onboarding" element={<OnboardingView />} />

          {/* Protected App Routes under shared Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/diagnostico" element={<DiagnosticPage />} />
            <Route path="/extratos" element={<TransactionsView />} />
            <Route path="/receitas" element={<IncomeView />} />
            <Route path="/orcado-vs-realizado" element={<BudgetVsActualView />} />
            <Route path="/categorias" element={<CategoriesView />} />
            <Route path="/alertas" element={<AlertsView />} />
            <Route path="/consultor" element={<ConsultantView />} />
            <Route path="/configuracoes" element={<SettingsView />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
