import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  FileSpreadsheet,
  TrendingUp,
  Scale,
  FolderTree,
  AlertTriangle,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Menu,
  X,
  Wallet,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const navItems = [
  { path: '/', label: 'Visão Geral', icon: LayoutDashboard },
  { path: '/extratos', label: 'Extratos & Faturas', icon: FileSpreadsheet },
  { path: '/receitas', label: 'Receitas', icon: TrendingUp },
  { path: '/orcado-vs-realizado', label: 'Orçado vs Realizado', icon: Scale },
  { path: '/categorias', label: 'Categorias', icon: FolderTree },
  { path: '/alertas', label: 'Alertas & Insights', icon: AlertTriangle },
]

export default function Layout() {
  const { user, logout, currency, setCurrency } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // If on login/signup page, don't show navigation layout
  const isAuthPage = location.pathname === '/login' || location.pathname === '/cadastro'

  if (isAuthPage) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Outlet />
      </main>
    )
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userInitial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U'

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200 bg-white shadow-sm z-20">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base text-slate-900 tracking-tight leading-none">
              Planejamento
            </span>
            <span className="text-xs text-blue-600 font-medium">Financeiro 2026</span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1.5 p-4">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Menu Principal
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* User Card in Sidebar Bottom */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="h-8 w-8 border border-blue-200">
                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-xs">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-900 truncate">
                  {user?.name || 'Usuário'}
                </span>
                <span className="text-[11px] text-slate-500 truncate">{user?.email}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Sair"
              className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 pb-16 lg:pb-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 lg:px-8 backdrop-blur-md">
          {/* Left Title / Mobile Toggle */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-lg hidden sm:inline">
                Meu Planejamento Financeiro
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                2026
              </span>
            </div>
          </div>

          {/* Right Controls: Currency Selector & User Dropdown */}
          <div className="flex items-center gap-3">
            {/* Currency Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setCurrency('BRL')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  currency === 'BRL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Exibir valores em Real Brasileiro (R$)"
              >
                R$ BRL
              </button>
              <button
                onClick={() => setCurrency('EUR')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  currency === 'EUR'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Exibir valores originais em Euro (€)"
              >
                € EUR
              </button>
            </div>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-slate-100">
                  <Avatar className="h-8 w-8 border border-slate-200">
                    <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-slate-700 hidden md:inline">
                    {user?.name || user?.email}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{user?.name || 'Usuário'}</span>
                    <span className="text-xs text-slate-500 font-normal">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/categorias')}
                  className="cursor-pointer"
                >
                  <FolderTree className="mr-2 h-4 w-4" />
                  Gerenciar Categorias
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/alertas')} className="cursor-pointer">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Ver Alertas & Insights
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair do Sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile slide-over drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-16 z-30 bg-slate-900/40 backdrop-blur-xs">
            <div className="w-64 bg-white h-full shadow-xl flex flex-col p-4 animate-in slide-in-from-left duration-200">
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        isActive
                          ? 'bg-blue-50 text-blue-600 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Page View */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>

        {/* Simple Footer */}
        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
          Dados exibidos conforme planejamento 2026. Atualize os dados mensalmente.
        </footer>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-2 shadow-lg backdrop-blur-md">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-md text-[10px] font-medium transition-all ${
                isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
