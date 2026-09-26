import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  syncBankAccount,
  getUserSettings,
  updateUserSettings,
  getExchangeRates,
  getRateForMonth,
} from '@/services/financeService'
import {
  BankAccount,
  BankAccountType,
  BankAccountStatus,
  UserSettings,
  ExchangeRate,
} from '@/types/finance'
import { formatCurrency } from '@/lib/formatters'
import {
  Wallet,
  Check,
  RefreshCw,
  Plus,
  Building2,
  User as UserIcon,
  Bell,
  Lock,
  Mail,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Paleta visual e iniciais automáticas de bancos conhecidos
const KNOWN_BANKS: Record<string, { initials: string; color: string; label: string }> = {
  nubank: { initials: 'Nu', color: '#820AD1', label: 'Nubank' },
  itaú: { initials: 'It', color: '#EC7000', label: 'Itaú' },
  itau: { initials: 'It', color: '#EC7000', label: 'Itaú' },
  bradesco: { initials: 'Br', color: '#CC092F', label: 'Bradesco' },
  'millennium bcp': { initials: 'BC', color: '#D91D5C', label: 'Millennium BCP' },
  millennium: { initials: 'BC', color: '#D91D5C', label: 'Millennium BCP' },
  santander: { initials: 'St', color: '#EA1D25', label: 'Santander' },
  inter: { initials: 'In', color: '#FF7A00', label: 'Banco Inter' },
  c6: { initials: 'C6', color: '#1A1A1A', label: 'C6 Bank' },
  'banco do brasil': { initials: 'BB', color: '#FFED00', label: 'Banco do Brasil' },
  caixa: { initials: 'Cx', color: '#005CA9', label: 'Caixa Econômica' },
  wise: { initials: 'Wi', color: '#2ED06E', label: 'Wise' },
  revolut: { initials: 'Rv', color: '#0075EB', label: 'Revolut' },
  btg: { initials: 'BT', color: '#122238', label: 'BTG Pactual' },
  xp: { initials: 'XP', color: '#000000', label: 'XP Investimentos' },
  degiro: { initials: 'Dg', color: '#1B98D5', label: 'Degiro' },
}

function getBankVisual(name: string, customColor?: string) {
  const normalized = (name || '').trim().toLowerCase()
  for (const [key, val] of Object.entries(KNOWN_BANKS)) {
    if (normalized.includes(key)) {
      return {
        initials: val.initials,
        color: customColor || val.color,
      }
    }
  }

  // Fallback: extrair até 2 letras das iniciais do nome
  const parts = name.trim().split(/\s+/)
  let initials = 'BK'
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase()
  } else if (parts[0]) {
    initials = parts[0].slice(0, 2).toUpperCase()
  }

  return {
    initials,
    color: customColor || '#2563EB',
  }
}

function formatRelativeSync(dateStr?: string): string {
  if (!dateStr) return 'Nunca sincronizado'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Nunca sincronizado'

  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  const hours = date.getHours().toString().padStart(2, '0')
  const mins = date.getMinutes().toString().padStart(2, '0')

  if (isToday) {
    return `Hoje às ${hours}:${mins}`
  }
  if (isYesterday) {
    return `Ontem às ${hours}:${mins}`
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 7) {
    return `Há ${diffDays} dias`
  }

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function SettingsView() {
  const { user, updateProfile, changePassword } = useAuth()
  const { toast } = useToast()

  // Tab State
  const [activeTab, setActiveTab] = useState<'dados' | 'bancos' | 'notificacoes'>('bancos')

  // Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [loadingBanks, setLoadingBanks] = useState(true)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [accountFormData, setAccountFormData] = useState<{
    name: string
    account_type: BankAccountType
    balance: string
    currency: 'BRL' | 'EUR' | 'USD'
    status: BankAccountStatus
    color: string
  }>({
    name: '',
    account_type: 'checking',
    balance: '',
    currency: 'BRL',
    status: 'connected',
    color: '#820AD1',
  })
  const [savingAccount, setSavingAccount] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  // Meus Dados State
  const [userName, setUserName] = useState(user?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Notificações State
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettingsKey, setSavingSettingsKey] = useState<string | null>(null)

  // Carregar contas bancárias e taxas de câmbio
  const loadBankAccounts = async () => {
    try {
      setLoadingBanks(true)
      const [accounts, rates] = await Promise.all([getBankAccounts(), getExchangeRates()])
      setBankAccounts(accounts)
      setExchangeRates(rates)
    } catch (err) {
      console.error('Erro ao carregar contas:', err)
      toast({
        title: 'Erro ao carregar contas',
        description: 'Não foi possível carregar as contas bancárias.',
        variant: 'destructive',
      })
    } finally {
      setLoadingBanks(false)
    }
  }

  // Carregar configurações de notificação
  const loadUserSettings = async () => {
    try {
      setLoadingSettings(true)
      const settings = await getUserSettings()
      setUserSettings(settings)
    } catch (err) {
      console.error('Erro ao carregar configurações:', err)
    } finally {
      setLoadingSettings(false)
    }
  }

  useEffect(() => {
    loadBankAccounts()
    loadUserSettings()
  }, [])

  useEffect(() => {
    if (user?.name) {
      setUserName(user.name)
    }
  }, [user?.name])

  // Métricas calculadas para a aba Bancos
  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const currentEurRate = useMemo(
    () => getRateForMonth(currentMonthKey, exchangeRates),
    [currentMonthKey, exchangeRates],
  )

  const totalBalanceBrl = useMemo(() => {
    return bankAccounts.reduce((sum, acc) => {
      const val = Number(acc.balance) || 0
      if (acc.currency === 'EUR') {
        return sum + val * currentEurRate
      }
      return sum + val
    }, 0)
  }, [bankAccounts, currentEurRate])

  const activeAccountsCount = useMemo(() => {
    return bankAccounts.filter((a) => a.status === 'connected').length
  }, [bankAccounts])

  const mostRecentSync = useMemo(() => {
    const dates = bankAccounts
      .map((a) => (a.last_synced ? new Date(a.last_synced).getTime() : 0))
      .filter((d) => d > 0)
    if (dates.length === 0) return null
    return new Date(Math.max(...dates))
  }, [bankAccounts])

  // Ações de Contas Bancárias
  const handleOpenAddAccount = () => {
    setEditingAccount(null)
    setAccountFormData({
      name: '',
      account_type: 'checking',
      balance: '',
      currency: 'BRL',
      status: 'connected',
      color: '#820AD1',
    })
    setIsAccountModalOpen(true)
  }

  const handleOpenEditAccount = (acc: BankAccount) => {
    setEditingAccount(acc)
    setAccountFormData({
      name: acc.name,
      account_type: acc.account_type,
      balance: (acc.balance ?? 0).toString(),
      currency: acc.currency,
      status: acc.status,
      color: acc.color || '#2563EB',
    })
    setIsAccountModalOpen(true)
  }

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountFormData.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do banco ou carteira.',
        variant: 'destructive',
      })
      return
    }

    const cleanBalance = parseFloat(
      accountFormData.balance.replace(/\./g, '').replace(',', '.') || '0',
    )
    const numBalance = isNaN(cleanBalance) ? 0 : cleanBalance

    setSavingAccount(true)
    try {
      if (editingAccount) {
        const updated = await updateBankAccount(editingAccount.id, {
          name: accountFormData.name.trim(),
          account_type: accountFormData.account_type,
          balance: numBalance,
          currency: accountFormData.currency,
          status: accountFormData.status,
          color: accountFormData.color,
        })
        setBankAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
        toast({
          title: 'Conta atualizada',
          description: `A conta "${updated.name}" foi atualizada com sucesso.`,
        })
      } else {
        const created = await createBankAccount({
          name: accountFormData.name.trim(),
          account_type: accountFormData.account_type,
          balance: numBalance,
          currency: accountFormData.currency,
          status: accountFormData.status,
          color: accountFormData.color,
          last_synced: new Date().toISOString(),
        })
        setBankAccounts((prev) => [created, ...prev])
        toast({
          title: 'Conta adicionada',
          description: `A conta "${created.name}" foi adicionada com sucesso.`,
        })
      }
      setIsAccountModalOpen(false)
    } catch (err: any) {
      console.error('Erro ao salvar conta:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Não foi possível salvar os dados da conta.',
        variant: 'destructive',
      })
    } finally {
      setSavingAccount(false)
    }
  }

  const handleSyncAccount = async (acc: BankAccount) => {
    try {
      setSyncingId(acc.id)
      const synced = await syncBankAccount(acc.id)
      setBankAccounts((prev) => prev.map((a) => (a.id === synced.id ? synced : a)))
      toast({
        title: 'Sincronização realizada',
        description: `Dados de "${acc.name}" atualizados com sucesso.`,
      })
    } catch (err) {
      console.error('Erro ao sincronizar conta:', err)
      toast({
        title: 'Erro de sincronização',
        description: 'Não foi possível sincronizar esta conta no momento.',
        variant: 'destructive',
      })
    } finally {
      setSyncingId(null)
    }
  }

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente remover a conta "${name}"?`)) return
    try {
      await deleteBankAccount(id)
      setBankAccounts((prev) => prev.filter((a) => a.id !== id))
      toast({
        title: 'Conta removida',
        description: `A conta "${name}" foi desconectada.`,
      })
      if (editingAccount?.id === id) {
        setIsAccountModalOpen(false)
      }
    } catch (err) {
      console.error('Erro ao excluir conta:', err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a conta.',
        variant: 'destructive',
      })
    }
  }

  // Ações de Meus Dados
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userName.trim()) {
      toast({
        title: 'Nome inválido',
        description: 'Por favor, insira o seu nome completo.',
        variant: 'destructive',
      })
      return
    }

    setSavingProfile(true)
    try {
      await updateProfile({ name: userName.trim() })
      toast({
        title: 'Dados atualizados',
        description: 'Seu nome foi alterado com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Não foi possível atualizar o perfil.',
        variant: 'destructive',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      toast({
        title: 'Senha atual obrigatória',
        description: 'Informe sua senha atual para continuar.',
        variant: 'destructive',
      })
      return
    }
    if (newPassword.length < 8) {
      toast({
        title: 'Senha muito curta',
        description: 'A nova senha deve possuir pelo menos 8 caracteres.',
        variant: 'destructive',
      })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas divergentes',
        description: 'A confirmação de senha não confere.',
        variant: 'destructive',
      })
      return
    }

    setSavingPassword(true)
    try {
      await changePassword(currentPassword, newPassword, confirmPassword)
      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi redefinida com sucesso.',
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast({
        title: 'Erro na alteração de senha',
        description: err?.message || 'Verifique se a senha atual está correta.',
        variant: 'destructive',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  // Ações de Notificações
  const handleToggleSetting = async (
    key: keyof Omit<UserSettings, 'id' | 'owner' | 'created' | 'updated'>,
  ) => {
    if (!userSettings) return
    const newValue = !userSettings[key]
    const updatedState = { ...userSettings, [key]: newValue }
    setUserSettings(updatedState)
    setSavingSettingsKey(key)

    try {
      await updateUserSettings(userSettings.id, {
        [key]: newValue,
      })
      toast({
        title: 'Preferência salva',
        description: 'Configuração atualizada com sucesso.',
        duration: 2000,
      })
    } catch (err) {
      console.error('Erro ao atualizar configuração:', err)
      // Rollback
      setUserSettings(userSettings)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar a preferência.',
        variant: 'destructive',
      })
    } finally {
      setSavingSettingsKey(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gerencie seus dados pessoais, conexões bancárias e preferências de alertas do sistema.
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="w-full space-y-6"
      >
        <TabsList className="bg-slate-100 p-1 rounded-xl grid grid-cols-3 max-w-md w-full">
          <TabsTrigger
            value="dados"
            className="flex items-center gap-2 text-xs sm:text-sm py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-xs font-semibold"
          >
            <UserIcon className="h-4 w-4" />
            Meus dados
          </TabsTrigger>
          <TabsTrigger
            value="bancos"
            className="flex items-center gap-2 text-xs sm:text-sm py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-xs font-semibold"
          >
            <Building2 className="h-4 w-4" />
            Bancos
          </TabsTrigger>
          <TabsTrigger
            value="notificacoes"
            className="flex items-center gap-2 text-xs sm:text-sm py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-xs font-semibold"
          >
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
        </TabsList>

        {/* ==================== ABA 1: MEUS DADOS ==================== */}
        <TabsContent value="dados" className="space-y-6 focus-visible:outline-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Informações Pessoais */}
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-blue-600" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Atualize seu nome de exibição no sistema financeiro.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="user-name" className="text-xs font-semibold text-slate-700">
                      Nome Completo
                    </Label>
                    <Input
                      id="user-name"
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="user-email" className="text-xs font-semibold text-slate-700">
                      E-mail
                    </Label>
                    <div className="relative">
                      <Input
                        id="user-email"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="bg-slate-100 text-slate-500 cursor-not-allowed pl-9"
                      />
                      <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      O e-mail é o identificador exclusivo de acesso à conta.
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={savingProfile || !userName.trim() || userName.trim() === user?.name}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-9 px-4 shadow-xs"
                    >
                      {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Troca de Senha */}
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-blue-600" />
                  Segurança & Senha
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Defina uma nova senha para proteger seu acesso.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="current-pass" className="text-xs font-semibold text-slate-700">
                      Senha Atual
                    </Label>
                    <Input
                      id="current-pass"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-pass" className="text-xs font-semibold text-slate-700">
                      Nova Senha (mínimo 8 caracteres)
                    </Label>
                    <Input
                      id="new-pass"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pass" className="text-xs font-semibold text-slate-700">
                      Confirmar Nova Senha
                    </Label>
                    <Input
                      id="confirm-pass"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-slate-50/50"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={savingPassword || !currentPassword || !newPassword}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-9 px-4 shadow-xs"
                    >
                      {savingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== ABA 2: BANCOS (Contas Bancárias & Carteiras) ==================== */}
        <TabsContent value="bancos" className="space-y-6 focus-visible:outline-hidden">
          {/* Top Bar da Aba Bancos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Contas Bancárias & Carteiras
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Gerencie suas conexões de Open Finance com atualização em tempo real do seu
                patrimônio.
              </p>
            </div>

            <Button
              onClick={handleOpenAddAccount}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm h-10 px-4 shadow-xs shrink-0 flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Adicionar Conta
            </Button>
          </div>

          {/* 3 Cards de Métrica conforme o design */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Saldo Total */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  SALDO TOTAL
                </CardTitle>
                <Wallet className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">
                  {formatCurrency(totalBalanceBrl, 'BRL')}
                </div>
                <p className="text-xs text-slate-500 mt-1">Soma das contas conectadas</p>
              </CardContent>
            </Card>

            {/* Card 2: Contas Ativas */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  CONTAS ATIVAS
                </CardTitle>
                <Check className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">
                  {activeAccountsCount}
                </div>
                <p className="text-xs text-slate-500 mt-1">Integrações funcionando normalmente</p>
              </CardContent>
            </Card>

            {/* Card 3: Última Sincronização */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  ÚLTIMA SINCRONIZAÇÃO
                </CardTitle>
                <RefreshCw className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">
                  {mostRecentSync ? formatRelativeSync(mostRecentSync.toISOString()) : 'Nenhuma'}
                </div>
                <p className="text-xs text-slate-500 mt-1">Automática via Open Finance</p>
              </CardContent>
            </Card>
          </div>

          {/* Seção: Contas Conectadas */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Contas Conectadas
            </h3>

            {loadingBanks ? (
              <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                Carregando suas contas bancárias...
              </div>
            ) : bankAccounts.length > 0 ? (
              <div className="space-y-3">
                {bankAccounts.map((acc) => {
                  const visual = getBankVisual(acc.name, acc.color)
                  const isSyncing = syncingId === acc.id

                  const typeLabels: Record<BankAccountType, string> = {
                    checking: 'Conta Corrente',
                    savings: 'Poupança',
                    international: 'Conta Internacional',
                    investment: 'Investimentos',
                    wallet: 'Carteira Digital',
                  }

                  const isConnected = acc.status === 'connected'

                  return (
                    <Card
                      key={acc.id}
                      className="border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all rounded-xl"
                    >
                      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Lado Esquerdo: Avatar + Nome + Tipo + Sincronização */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Avatar Circular com cor personalizada */}
                          <div
                            style={{ backgroundColor: visual.color }}
                            className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs"
                          >
                            {visual.initials}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm sm:text-base">
                                {acc.name}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] sm:text-[11px] font-normal text-slate-500 bg-slate-50 border-slate-200 px-2 py-0.5"
                              >
                                {typeLabels[acc.account_type] || 'Conta Corrente'}
                              </Badge>
                            </div>
                            <span className="text-xs text-slate-400 mt-0.5">
                              Sincronizado: {formatRelativeSync(acc.last_synced)}
                            </span>
                          </div>
                        </div>

                        {/* Lado Direito: Saldo + Status + Botões */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                          {/* Saldo */}
                          <div className="flex flex-col sm:items-end">
                            <span className="font-bold text-slate-900 text-base sm:text-lg tabular-nums">
                              {formatCurrency(
                                acc.balance || 0,
                                acc.currency === 'EUR' ? 'EUR' : 'BRL',
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400">Saldo Atual</span>
                          </div>

                          {/* Badge Status */}
                          <div className="flex items-center">
                            {isConnected ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Conectado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200/60">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                Pendente
                              </span>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSyncing}
                              onClick={() => handleSyncAccount(acc)}
                              className="text-xs h-8 px-3 text-slate-700 border-slate-200 hover:bg-slate-50"
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 mr-1.5 text-slate-400 ${
                                  isSyncing ? 'animate-spin text-blue-600' : ''
                                }`}
                              />
                              Sincronizar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditAccount(acc)}
                              className="text-xs h-8 px-3 text-slate-700 border-slate-200 hover:bg-slate-50"
                            >
                              Editar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              /* Estado Vazio Amigável */
              <Card className="border-dashed border-2 border-slate-200 bg-white p-10 text-center rounded-xl">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3">
                  <Building2 className="h-6 w-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Nenhuma conta conectada ainda
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                  Adicione suas contas bancárias, contas de investimentos ou carteiras
                  internacionais para acompanhar a evolução do seu patrimônio consolidado.
                </p>
                <Button
                  onClick={handleOpenAddAccount}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-9 px-4 shadow-xs"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Adicionar Primeira Conta
                </Button>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ==================== ABA 3: NOTIFICAÇÕES ==================== */}
        <TabsContent value="notificacoes" className="space-y-6 focus-visible:outline-hidden">
          <Card className="border-slate-200 bg-white shadow-xs max-w-3xl">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-600" />
                Preferências de Alertas & Diagnósticos
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Selecione quais regras automáticas do motor financeiro devem exibir notificações no
                seu painel de Alertas & Insights e na Visão Geral.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {loadingSettings || !userSettings ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-blue-600 mb-2" />
                  Carregando preferências...
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {/* Toggle 1: Alertas de estouro de orçamento */}
                  <div className="flex items-center justify-between py-4 first:pt-0">
                    <div className="space-y-0.5 pr-4">
                      <Label
                        htmlFor="toggle-budget"
                        className="text-sm font-semibold text-slate-900 cursor-pointer"
                      >
                        Alertas de estouro de orçamento
                      </Label>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Avisa quando uma categoria ultrapassar 15% acima do valor orçado para o mês.
                      </p>
                    </div>
                    <Switch
                      id="toggle-budget"
                      checked={userSettings.notify_budget_overflow}
                      disabled={savingSettingsKey === 'notify_budget_overflow'}
                      onCheckedChange={() => handleToggleSetting('notify_budget_overflow')}
                    />
                  </div>

                  {/* Toggle 2: Transações atípicas */}
                  <div className="flex items-center justify-between py-4">
                    <div className="space-y-0.5 pr-4">
                      <Label
                        htmlFor="toggle-atypical"
                        className="text-sm font-semibold text-slate-900 cursor-pointer"
                      >
                        Transações atípicas e picos de gastos
                      </Label>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Detecta despesas extraordinárias que superam mais de 2.5x a média histórica
                        da categoria.
                      </p>
                    </div>
                    <Switch
                      id="toggle-atypical"
                      checked={userSettings.notify_atypical_transactions}
                      disabled={savingSettingsKey === 'notify_atypical_transactions'}
                      onCheckedChange={() => handleToggleSetting('notify_atypical_transactions')}
                    />
                  </div>

                  {/* Toggle 3: Divergência contábil */}
                  <div className="flex items-center justify-between py-4">
                    <div className="space-y-0.5 pr-4">
                      <Label
                        htmlFor="toggle-divergence"
                        className="text-sm font-semibold text-slate-900 cursor-pointer"
                      >
                        Divergência contábil detectada
                      </Label>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Informa quando o total oficial de extrato não bate com a soma das categorias
                        apuradas.
                      </p>
                    </div>
                    <Switch
                      id="toggle-divergence"
                      checked={userSettings.notify_accounting_divergence}
                      disabled={savingSettingsKey === 'notify_accounting_divergence'}
                      onCheckedChange={() => handleToggleSetting('notify_accounting_divergence')}
                    />
                  </div>

                  {/* Toggle 4: Resumo mensal */}
                  <div className="flex items-center justify-between py-4 last:pb-0">
                    <div className="space-y-0.5 pr-4">
                      <Label
                        htmlFor="toggle-summary"
                        className="text-sm font-semibold text-slate-900 cursor-pointer"
                      >
                        Resumo mensal e alta concentração
                      </Label>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Destaca meses sem receita cadastrada e categorias com mais de 25% de
                        concentração no patrimônio.
                      </p>
                    </div>
                    <Switch
                      id="toggle-summary"
                      checked={userSettings.notify_monthly_summary}
                      disabled={savingSettingsKey === 'notify_monthly_summary'}
                      onCheckedChange={() => handleToggleSetting('notify_monthly_summary')}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== MODAL: Adicionar / Editar Conta Bancária ==================== */}
      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingAccount ? 'Editar Conta Bancária' : 'Adicionar Conta Bancária'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre sua conta ou carteira para acompanhamento manual ou sincronização Open
              Finance.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAccount} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="bank-name" className="text-xs font-semibold text-slate-700">
                Nome do Banco ou Instituição *
              </Label>
              <Input
                id="bank-name"
                value={accountFormData.name}
                onChange={(e) => {
                  const val = e.target.value
                  const detected = getBankVisual(val)
                  setAccountFormData((prev) => ({
                    ...prev,
                    name: val,
                    color: detected.color,
                  }))
                }}
                placeholder="Ex: Nubank, Itaú, Millennium BCP, Degiro..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bank-type" className="text-xs font-semibold text-slate-700">
                  Tipo de Conta
                </Label>
                <Select
                  value={accountFormData.account_type}
                  onValueChange={(val: BankAccountType) =>
                    setAccountFormData((prev) => ({ ...prev, account_type: val }))
                  }
                >
                  <SelectTrigger id="bank-type">
                    <SelectValue placeholder="Tipo de conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                    <SelectItem value="international">Conta Internacional</SelectItem>
                    <SelectItem value="investment">Investimentos</SelectItem>
                    <SelectItem value="wallet">Carteira Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bank-curr" className="text-xs font-semibold text-slate-700">
                  Moeda
                </Label>
                <Select
                  value={accountFormData.currency}
                  onValueChange={(val: 'BRL' | 'EUR' | 'USD') =>
                    setAccountFormData((prev) => ({ ...prev, currency: val }))
                  }
                >
                  <SelectTrigger id="bank-curr">
                    <SelectValue placeholder="Moeda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">R$ Real (BRL)</SelectItem>
                    <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                    <SelectItem value="USD">$ Dólar (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bank-balance" className="text-xs font-semibold text-slate-700">
                  Saldo Atual
                </Label>
                <Input
                  id="bank-balance"
                  type="text"
                  value={accountFormData.balance}
                  onChange={(e) =>
                    setAccountFormData((prev) => ({ ...prev, balance: e.target.value }))
                  }
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bank-status" className="text-xs font-semibold text-slate-700">
                  Status da Conexão
                </Label>
                <Select
                  value={accountFormData.status}
                  onValueChange={(val: BankAccountStatus) =>
                    setAccountFormData((prev) => ({ ...prev, status: val }))
                  }
                >
                  <SelectTrigger id="bank-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connected">Conectado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="error">Com Erro</SelectItem>
                    <SelectItem value="disconnected">Desconectado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bank-color" className="text-xs font-semibold text-slate-700">
                Cor Representativa
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="bank-color"
                  type="color"
                  value={accountFormData.color}
                  onChange={(e) =>
                    setAccountFormData((prev) => ({ ...prev, color: e.target.value }))
                  }
                  className="w-14 h-9 p-1 cursor-pointer"
                />
                <span className="text-xs text-slate-500 font-mono">{accountFormData.color}</span>
              </div>
            </div>

            <DialogFooter className="pt-4 flex sm:justify-between items-center gap-2">
              {editingAccount ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDeleteAccount(editingAccount.id, editingAccount.name)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 text-xs mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingAccount}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  {savingAccount
                    ? 'Salvando...'
                    : editingAccount
                      ? 'Salvar Alterações'
                      : 'Adicionar Conta'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
