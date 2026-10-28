import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  TrendingUp,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DashboardCardPreview } from '@/components/DashboardCardPreview'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { confirmPasswordReset } = useAuth()

  const [token, setToken] = useState<string>('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenMissing, setTokenMissing] = useState(false)

  // Extrair token tanto de ?token=... quanto de rotas fragmentadas ou path segments
  useEffect(() => {
    // 1. Query parameter padrão: ?token=...
    let foundToken = searchParams.get('token')

    // 2. Fragmento de hash caso venha no formato /#/?token=... ou /_/#/auth/confirm-password-reset/...
    if (!foundToken && window.location.hash) {
      const hashStr = window.location.hash
      const hashQueryIndex = hashStr.indexOf('?')
      if (hashQueryIndex !== -1) {
        const hashParams = new URLSearchParams(hashStr.substring(hashQueryIndex))
        foundToken = hashParams.get('token')
      }
      if (!foundToken && hashStr.includes('confirm-password-reset/')) {
        const parts = hashStr.split('confirm-password-reset/')
        if (parts[1]) {
          foundToken = parts[1].split('?')[0].split('&')[0]
        }
      }
    }

    // 3. Checagem em pathname no formato /redefinir-senha/:token
    if (!foundToken) {
      const pathParts = location.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2 && pathParts[0] === 'redefinir-senha' && pathParts[1] !== '') {
        foundToken = pathParts[1]
      }
    }

    if (foundToken) {
      setToken(foundToken)
      setTokenMissing(false)
    } else {
      setTokenMissing(true)
    }
  }, [searchParams, location])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Token de recuperação não identificado ou ausente.')
      return
    }

    if (password.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setError('A confirmação de senha não confere com a nova senha digitada.')
      return
    }

    setLoading(true)
    try {
      const { error: resetErr } = await confirmPasswordReset(token, password, passwordConfirm)
      if (resetErr) {
        console.error('Erro confirmPasswordReset:', resetErr)
        const errMsg = resetErr.message?.toLowerCase() || ''
        if (errMsg.includes('token') || resetErr.status === 400 || resetErr.status === 404) {
          setError(
            'O link de recuperação é inválido ou já expirou. Por favor, solicite um novo link.',
          )
        } else {
          setError(
            resetErr.message ||
              'Não foi possível redefinir a senha. Verifique o link e tente novamente.',
          )
        }
      } else {
        setSuccess(true)
      }
    } catch (err: any) {
      console.error('Erro inesperado confirmPasswordReset:', err)
      setError('Ocorreu um erro ao processar a solicitação. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-[1240px] min-h-[680px] lg:h-[760px] bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* LEFT COLUMN: Form & Identity */}
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
            {success ? (
              <div className="space-y-6 animate-fade-in">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mb-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
                    Senha redefinida com sucesso!
                  </h1>
                  <p className="text-sm font-medium text-slate-500">
                    Sua nova senha foi atualizada. Agora você já pode acessar sua conta com as novas
                    credenciais.
                  </p>
                </div>

                <Button
                  onClick={() => navigate('/login')}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                >
                  Ir para a página de login
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </Button>
              </div>
            ) : tokenMissing ? (
              <div className="space-y-6 animate-fade-in">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mb-2">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
                    Link inválido ou expirado
                  </h1>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    Não encontramos um token válido nesta URL. O link de recuperação pode ter
                    expirado ou foi aberto de forma incompleta.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    onClick={() => navigate('/login')}
                    className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    Solicitar nova recuperação de senha
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/login')}
                    className="w-full h-11 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                  </Button>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mb-4">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
                    Criar nova senha
                  </h1>
                  <p className="text-sm font-medium text-slate-500">
                    Crie uma senha segura com no mínimo 8 caracteres.
                  </p>
                </div>

                {error && (
                  <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-700 border border-red-200 animate-fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-xs font-semibold text-slate-700">
                      Nova senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo de 8 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-11 rounded-xl bg-slate-50/80 border-slate-200 text-sm focus-visible:bg-white focus-visible:ring-blue-600"
                        required
                        minLength={8}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                        aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="confirm-password"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Confirmar nova senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="confirm-password"
                        type={showPasswordConfirm ? 'text' : 'password'}
                        placeholder="Repita a nova senha"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className="pl-10 pr-10 h-11 rounded-xl bg-slate-50/80 border-slate-200 text-sm focus-visible:bg-white focus-visible:ring-blue-600"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        title={showPasswordConfirm ? 'Ocultar senha' : 'Exibir senha'}
                        aria-label={showPasswordConfirm ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPasswordConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? 'Salvando nova senha...' : 'Salvar nova senha'}
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </Button>

                  <div className="text-center pt-2">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Cancelar e voltar ao login
                    </Link>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Bottom Security Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              <span>Conexão protegida e criptografia ponta a ponta</span>
            </div>
            <Link to="/login" className="text-slate-400 hover:text-slate-600 font-medium">
              Voltar ao login
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: Blue Decorative Panel */}
        <div className="lg:col-span-6 xl:col-span-6 p-4 sm:p-6 lg:p-4 flex">
          <div className="w-full h-full rounded-2xl bg-[#2563EB] bg-gradient-to-br from-blue-600 via-[#1d4ed8] to-[#1e40af] text-white p-6 sm:p-10 lg:p-10 relative overflow-hidden flex flex-col justify-between shadow-inner">
            <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute -top-16 -right-16 w-[450px] h-[450px] rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold text-white tracking-wide shadow-sm">
                <span>Conversão automática para R$ BRL · € EUR</span>
              </div>
            </div>

            <div className="relative z-10 my-4 max-w-md">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-2">
                Segurança em primeiro lugar
              </h2>
              <p className="text-sm font-medium text-blue-100/90">
                Mantenha suas informações financeiras protegidas e seus acessos sempre atualizados.
              </p>
            </div>

            <div className="relative z-10 w-full mt-2 min-h-[300px] flex items-end">
              <div className="absolute top-0 right-4 sm:right-12 z-20 bg-white rounded-2xl shadow-xl shadow-black/15 border border-slate-100 px-4 py-2.5 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none mb-1">
                    Status da conta
                  </span>
                  <span className="text-xs font-bold text-slate-900 leading-none">
                    Acesso seguro
                  </span>
                </div>
              </div>

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
