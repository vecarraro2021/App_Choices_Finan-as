import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getIncomes,
  getAllTransactions,
  createIncome,
  updateIncome,
  deleteIncome,
} from '@/services/financeService'
import { Income, Transaction } from '@/types/finance'
import { formatCurrency, formatPercent, formatMonthLong, formatMonthShort } from '@/lib/formatters'
import { parseAmount } from '@/lib/fileParser'
import { useToast } from '@/hooks/use-toast'
import {
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  PiggyBank,
  Calendar,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function IncomeView() {
  const { user, currency } = useAuth()
  const { toast } = useToast()

  const [incomes, setIncomes] = useState<Income[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [month, setMonth] = useState('2026-01')
  const [amountBrl, setAmountBrl] = useState('')
  const [amountEur, setAmountEur] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  // Edit modal state
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [editMonth, setEditMonth] = useState('')
  const [editAmountBrl, setEditAmountBrl] = useState('')
  const [editAmountEur, setEditAmountEur] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDate, setEditDate] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [incList, txList] = await Promise.all([getIncomes(), getAllTransactions()])
      setIncomes(incList)
      setTransactions(txList)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  useRealtime('income', () => loadData())
  useRealtime('transactions', () => loadData())

  // Metrics calculation
  const metrics = useMemo(() => {
    const totalIncome = incomes.reduce((acc, inc) => acc + (Number(inc.amount_brl) || 0), 0)
    const totalExpenses = transactions.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0)

    const uniqueMonths = new Set<string>()
    incomes.forEach((i) => uniqueMonths.add(i.month))
    transactions.forEach((t) => {
      const m = t.month || (t.date ? t.date.slice(0, 7) : '')
      if (m) uniqueMonths.add(m)
    })

    const monthsCount = Math.max(uniqueMonths.size, 1)
    const avgMonthlyIncome = totalIncome / monthsCount

    // Savings rate = (income - expenses) / income
    const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0

    // Monthly deficit check
    const expensesByMonth: Record<string, number> = {}
    transactions.forEach((tx) => {
      const m = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
      if (m) {
        expensesByMonth[m] = (expensesByMonth[m] || 0) + (Number(tx.amount) || 0)
      }
    })

    const incomeByMonth: Record<string, number> = {}
    incomes.forEach((inc) => {
      incomeByMonth[inc.month] = (incomeByMonth[inc.month] || 0) + (Number(inc.amount_brl) || 0)
    })

    const deficitMonths: { month: string; deficit: number; income: number; expense: number }[] = []
    Object.keys(expensesByMonth).forEach((m) => {
      const inc = incomeByMonth[m] || 0
      const exp = expensesByMonth[m] || 0
      if (exp > inc) {
        deficitMonths.push({
          month: m,
          deficit: exp - inc,
          income: inc,
          expense: exp,
        })
      }
    })

    return {
      totalIncome,
      avgMonthlyIncome,
      totalExpenses,
      savingsRate,
      deficitMonths,
    }
  }, [incomes, transactions])

  // Handle Add Income
  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amountBrl || !month) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }

    try {
      setSaving(true)
      const valBrl = parseAmount(amountBrl)
      const valEur = amountEur ? parseAmount(amountEur) : valBrl / 6.0

      await createIncome({
        month,
        amount_brl: valBrl,
        amount_eur: valEur,
        description: description || undefined,
        date: date || undefined,
      })

      toast({ title: 'Receita registrada com sucesso!' })
      setShowAddModal(false)
      setAmountBrl('')
      setAmountEur('')
      setDescription('')
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao registrar receita', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Open Edit Modal
  const handleOpenEdit = (inc: Income) => {
    setEditingIncome(inc)
    setEditMonth(inc.month)
    setEditAmountBrl(String(inc.amount_brl))
    setEditAmountEur(inc.amount_eur ? String(inc.amount_eur) : '')
    setEditDesc(inc.description || '')
    setEditDate(inc.date ? inc.date.slice(0, 10) : '')
  }

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingIncome) return

    try {
      setSavingEdit(true)
      const valBrl = parseAmount(editAmountBrl)
      const valEur = editAmountEur ? parseAmount(editAmountEur) : valBrl / 6.0

      await updateIncome(editingIncome.id, {
        month: editMonth,
        amount_brl: valBrl,
        amount_eur: valEur,
        description: editDesc || undefined,
        date: editDate || undefined,
      })

      toast({ title: 'Receita atualizada!' })
      setEditingIncome(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao atualizar receita', variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta entrada de receita?')) return
    try {
      await deleteIncome(id)
      toast({ title: 'Receita removida.' })
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao remover receita', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Receitas & Entradas Financeiras
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Rastreamento de rendas mensais em BRL e EUR. Fecha o ponto cego da planilha e calcula
            sua saúde financeira.
          </p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 font-semibold shadow-xs"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Entrada de Receita
        </Button>
      </div>

      {/* Warning Banner if Expenses exceed Income */}
      {metrics.deficitMonths.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-900">
                Alerta de Saúde Financeira: Despesas excedem receitas
              </h3>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                Foram identificados meses com saldo operacional negativo onde o custo de vida
                superou a renda declarada:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {metrics.deficitMonths.map((d) => (
                  <Badge
                    key={d.month}
                    variant="destructive"
                    className="text-xs py-1 px-2 font-normal"
                  >
                    <strong>{formatMonthShort(d.month)}:</strong> déficit de{' '}
                    {formatCurrency(d.deficit, currency)} (Gastos{' '}
                    {formatCurrency(d.expense, currency)} vs Ganho{' '}
                    {formatCurrency(d.income, currency)})
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total de Receitas (Período)
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
              {formatCurrency(metrics.totalIncome, currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Soma de todas as entradas cadastradas</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Média Mensal de Entradas
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
              {formatCurrency(metrics.avgMonthlyIncome, currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Capacidade mensal de geração de renda</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Taxa de Poupança Estimada
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <PiggyBank className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tracking-tight tabular-nums ${
                metrics.savingsRate >= 0.2
                  ? 'text-emerald-600'
                  : metrics.savingsRate > 0
                    ? 'text-amber-600'
                    : 'text-red-600'
              }`}
            >
              {formatPercent(metrics.savingsRate)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.savingsRate > 0
                ? 'Margem positiva poupada do total recebido'
                : 'Déficit orçamentário (despesas > receitas)'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income Table */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Entradas Mensais ({incomes.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Lista de aportes, pró-labore, salários e faturamentos registrados
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Carregando receitas...</div>
          ) : incomes.length === 0 ? (
            <div className="py-16 text-center">
              <Wallet className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                Nenhuma receita registrada ainda
              </p>
              <p className="text-xs text-slate-400 mt-0.5 max-w-sm mx-auto">
                Cadastre suas fontes de receita para equilibrar seu fluxo de caixa e habilitar o
                cálculo da taxa de poupança.
              </p>
              <Button
                onClick={() => setShowAddModal(true)}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-xs"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Registrar Primeira Receita
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/70 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Mês de Referência</th>
                    <th className="py-3 px-4">Data Registro</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4 text-right">Valor em BRL (R$)</th>
                    <th className="py-3 px-4 text-right">Valor em EUR (€)</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incomes.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {formatMonthLong(inc.month)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-500">
                        {inc.date ? inc.date.slice(0, 10).split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {inc.description || 'Renda / Receita Mensal'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 tabular-nums">
                        {formatCurrency(inc.amount_brl, 'BRL')}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums font-medium">
                        {formatCurrency(inc.amount_brl, 'EUR')}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-blue-600"
                          onClick={() => handleOpenEdit(inc)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-red-600"
                          onClick={() => handleDelete(inc.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ADD INCOME MODAL */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Nova Receita</DialogTitle>
            <DialogDescription>
              Adicione a entrada de recursos para cálculo de poupança e solvência.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveIncome} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="i-month">Mês de Referência (YYYY-MM)</Label>
              <Input
                id="i-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="i-desc">Descrição / Origem</Label>
              <Input
                id="i-desc"
                placeholder="Ex: Salário, Distribuição de Lucros, Consultoria"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="i-brl">Valor (R$ BRL)</Label>
                <Input
                  id="i-brl"
                  placeholder="Ex: 15.000,00"
                  value={amountBrl}
                  onChange={(e) => {
                    setAmountBrl(e.target.value)
                    const parsed = parseAmount(e.target.value)
                    if (parsed > 0) {
                      setAmountEur((parsed / 6.0).toFixed(2))
                    }
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="i-eur">Valor (€ EUR opcional)</Label>
                <Input
                  id="i-eur"
                  placeholder="Ex: 2.500,00"
                  value={amountEur}
                  onChange={(e) => setAmountEur(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="i-date">Data do Recebimento</Label>
              <Input
                id="i-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? 'Registrando...' : 'Salvar Receita'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT INCOME MODAL */}
      <Dialog open={!!editingIncome} onOpenChange={(open) => !open && setEditingIncome(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Receita</DialogTitle>
            <DialogDescription>Ajuste os valores ou mês da entrada financeira.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="e-month">Mês de Referência (YYYY-MM)</Label>
              <Input
                id="e-month"
                type="month"
                value={editMonth}
                onChange={(e) => setEditMonth(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-desc">Descrição</Label>
              <Input id="e-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-brl">Valor (R$ BRL)</Label>
                <Input
                  id="e-brl"
                  value={editAmountBrl}
                  onChange={(e) => setEditAmountBrl(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-eur">Valor (€ EUR)</Label>
                <Input
                  id="e-eur"
                  value={editAmountEur}
                  onChange={(e) => setEditAmountEur(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-date">Data</Label>
              <Input
                id="e-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingIncome(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEdit}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {savingEdit ? 'Salvando...' : 'Atualizar Receita'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
