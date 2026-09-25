import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  TrendingUp,
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DashboardCardPreview } from '@/components/DashboardCardPreview'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      console.error('Erro de login:', err)
      setError('Credenciais inválidas. Verifique seu e-mail e senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans">
      {/* Main Container 1223x766 aspect ratio card */}
      <div className="w-full max-w-[1240px] min-h-[680px] lg:h-[760px] bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* LEFT COLUMN: Form & Identity (~49%) */}
        <div className="lg:col-span-6 xl:col-span-6 flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 bg-white relative z-10">
          {/* Top Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/25">
              <TrendingUp className="h-6 w-6 stroke-[2.5]" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">
              Meu Planejamento Financeiro
            </span>
          </div>

          {/* Form Content */}
          <div className="w-full max-w-md mx-auto my-auto py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
                Entrar na sua conta
              </h1>
              <p className="text-sm font-medium text-slate-500">
                Gestão financeira simples e inteligente
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-700 border border-red-200 animate-fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="voce@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-slate-50/80 border-slate-200 text-sm focus-visible:bg-white focus-visible:ring-blue-600"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 rounded-xl bg-slate-50/80 border-slate-200 text-sm focus-visible:bg-white focus-visible:ring-blue-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(!!checked)}
                    className="rounded-md data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <label
                    htmlFor="remember"
                    className="text-xs font-medium text-slate-600 cursor-pointer select-none"
                  >
                    Lembrar de mim
                  </label>
                </div>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        Esqueci minha senha
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-xs">
                      Para redefinir sua senha, entre em contato com o suporte ou administrador do
                      sistema.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Entrar'}
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </Button>

              {/* Sign up link */}
              <div className="text-center text-xs text-slate-500 pt-2">
                Ainda não tem conta?{' '}
                <Link
                  to="/cadastro"
                  className="font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2 ml-1"
                >
                  Criar conta
                </Link>
              </div>
            </form>
          </div>

          {/* Bottom Security / Help Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              <span>Conexão segura e dados criptografados</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600 font-medium transition-colors cursor-pointer"
                  >
                    Precisa de ajuda?
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Dúvidas ou problemas de acesso? Escreva para suporte@financeiro.app
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* RIGHT COLUMN: Blue Decorative Panel (~51%) */}
        <div className="lg:col-span-6 xl:col-span-6 p-4 sm:p-6 lg:p-4 flex">
          <div className="w-full h-full rounded-2xl bg-[#2563EB] bg-gradient-to-br from-blue-600 via-[#1d4ed8] to-[#1e40af] text-white p-6 sm:p-10 lg:p-10 relative overflow-hidden flex flex-col justify-between shadow-inner">
            {/* Decorative concentric ripples */}
            <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute -top-16 -right-16 w-[450px] h-[450px] rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

            {/* Top Badge */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold text-white tracking-wide shadow-sm">
                <span>Conversão automática para R$ BRL · € EUR</span>
              </div>
            </div>

            {/* Headline and subtitle */}
            <div className="relative z-10 my-4 max-w-md">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-2">
                Seu assistente financeiro virtual
              </h2>
              <p className="text-sm font-medium text-blue-100/90">
                Gestão financeira simples e inteligente
              </p>
            </div>

            {/* Floating preview area */}
            <div className="relative z-10 w-full mt-2 min-h-[300px] flex items-end">
              {/* Floating Meta chip */}
              <div className="absolute top-0 right-4 sm:right-12 z-20 bg-white rounded-2xl shadow-xl shadow-black/15 border border-slate-100 px-4 py-2.5 flex items-center gap-3 animate-fade-in">
                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none mb-1">
                    Meta do mês
                  </span>
                  <span className="text-xs font-bold text-slate-900 leading-none">
                    Dentro do orçamento
                  </span>
                </div>
              </div>

              {/* System Dashboard Preview Card bleeding off right side */}
              <div className="relative -right-8 sm:-right-12 lg:-right-16 translate-y-4">
                <DashboardCardPreview />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
