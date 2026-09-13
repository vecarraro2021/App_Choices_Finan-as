import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Index from '@/pages/Index'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import TransactionsView from '@/pages/Transactions'
import IncomeView from '@/pages/Income'
import BudgetVsActualView from '@/pages/BudgetVsActual'
import CategoriesView from '@/pages/Categories'
import AlertsView from '@/pages/Alerts'
import ExchangeRatesView from '@/pages/ExchangeRates'
import NotFound from '@/pages/NotFound'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />

          {/* Protected App Routes under shared Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Index />} />
            <Route path="/extratos" element={<TransactionsView />} />
            <Route path="/receitas" element={<IncomeView />} />
            <Route path="/orcado-vs-realizado" element={<BudgetVsActualView />} />
            <Route path="/categorias" element={<CategoriesView />} />
            <Route path="/cambio" element={<ExchangeRatesView />} />
            <Route path="/alertas" element={<AlertsView />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
