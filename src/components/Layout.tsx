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
  ChevronDown,
  Menu,
  X,
  Wallet,
  MessageSquareText,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const navItems = [
  { path: '/', label: 'Visão Geral', icon: LayoutDashboard },
  { path: '/extratos', label: 'Extratos & Faturas', icon: FileSpreadsheet },
  { path: '/receitas', label: 'Receitas', icon: TrendingUp },
  { path: '/orcado-vs-realizado', label: 'Meu Orçamento', icon: Scale },
  { path: '/categorias', label: 'Categorias', icon: FolderTree },
  { path: '/alertas', label: 'Alertas & Insights', icon: AlertTriangle },
  { path: '/consultor', label: 'Meu Consultor', icon: MessageSquareText },
]

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

export default function Layout() {
  const { user, logout, currency, setCurrency } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      return saved ? JSON.parse(saved) : false
    } catch {
      return false
    }
  })

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(next))
      } catch {
        // ignore quota errors
      }
      return next
    })
  }

  // If on login/signup page, don't show navigation layout
  const isAuthPage = location.pathname === '/login' || location.pathname === '/cadastro'
  const isConsultantPage = location.pathname === '/consultor'

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
      <aside
        className={`group relative hidden lg:flex flex-col border-r border-slate-200 bg-white shadow-sm z-20 transition-all duration-300 ease-in-out shrink-0 ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <TooltipProvider delayDuration={150}>
          {/* Logo Header */}
          <div
            className={`flex h-16 items-center border-b border-slate-100 transition-all duration-300 relative ${
              isCollapsed ? 'justify-center px-2' : 'justify-between px-5'
            }`}
          >
            <div
              className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Wallet className="h-5 w-5" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col whitespace-nowrap overflow-hidden transition-opacity duration-200">
                  <span className="font-bold text-base text-slate-900 tracking-tight leading-none">
                    Planejamento
                  </span>
                  <span className="text-xs text-blue-600 font-medium">Financeiro</span>
                </div>
              )}
            </div>

            {/* Toggle button visible only on hover of sidebar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
                  className={`cursor-pointer rounded-lg p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-hidden ${
                    isCollapsed
                      ? 'absolute -right-3 top-5 z-30 bg-white border border-slate-200 shadow-sm rounded-full'
                      : 'relative'
                  }`}
                >
                  {isCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side={isCollapsed ? 'right' : 'bottom'}>
                {isCollapsed ? 'Expandir menu' : 'Recolher menu'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto overflow-x-hidden">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path

              const linkContent = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center rounded-lg transition-all ${
                    isCollapsed
                      ? 'justify-center h-10 w-full px-0'
                      : 'gap-3 px-3 py-2.5 text-sm font-medium'
                  } ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`shrink-0 ${isCollapsed ? 'h-5 w-5' : 'h-4 w-4'} ${
                      isActive ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              )

              if (isCollapsed) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return linkContent
            })}
          </nav>

          {/* User Card in Sidebar Bottom */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 transition-all duration-300">
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-8 w-8 border border-blue-200 cursor-pointer">
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-xs">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-medium">{user?.name || 'Usuário'}</p>
                    <p className="text-xs text-slate-400">{user?.email}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleLogout}
                      aria-label="Sair"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sair do sistema</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-8 w-8 border border-blue-200 shrink-0">
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
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </TooltipProvider>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex flex-1 flex-col min-w-0 pb-16 lg:pb-0 ${
          isConsultantPage ? 'h-screen overflow-hidden' : ''
        }`}
      >
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
                <DropdownMenuItem
                  onClick={() => navigate('/configuracoes')}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
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
        <main
          className={
            isConsultantPage
              ? 'flex-1 overflow-hidden p-0 m-0 flex flex-col'
              : 'flex-1 p-4 lg:p-8 overflow-y-auto'
          }
        >
          <Outlet />
        </main>

        {/* Simple Footer */}
        {!isConsultantPage && (
          <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
            Dados exibidos conforme planejamento 2026. Atualize os dados mensalmente.
          </footer>
        )}

        {/* Botão circular verde de chat no canto inferior direito */}
        <button
          onClick={() => {
            if (location.pathname !== '/consultor') {
              navigate('/consultor')
            }
          }}
          title="Meu Consultor Financeiro"
          aria-label="Meu Consultor Financeiro"
          className="fixed bottom-20 lg:bottom-8 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#10B981] hover:bg-[#059669] text-white shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer focus:outline-hidden focus:ring-4 focus:ring-emerald-400/30"
        >
          <MessageSquareText className="h-7 w-7 text-white fill-white/10 stroke-[2.2]" />
        </button>
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
