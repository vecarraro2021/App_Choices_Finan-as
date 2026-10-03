import { useMemo, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Category, Transaction, Currency, ExchangeRate } from '@/types/finance'
import { formatCurrency, formatMonthShort } from '@/lib/formatters'
import { getRateForMonth } from '@/services/financeService'
import {
  ReceiptText,
  Calendar,
  Layers,
  ArrowUpDown,
  Search,
  CheckCircle2,
  FilterX,
  CreditCard,
} from 'lucide-react'

export interface BudgetLineDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  category: Category | null
  parentCategory?: Category | null
  transactions: Transaction[]
  allCategories: Category[]
  activeMonths: string[]
  currency: Currency
  exchangeRates: ExchangeRate[]
}

export function BudgetLineDetailDrawer({
  isOpen,
  onClose,
  category,
  parentCategory,
  transactions,
  allCategories,
  activeMonths,
  currency,
  exchangeRates,
}: BudgetLineDetailDrawerProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')

  // Identificar os IDs das categorias aplicáveis para esta linha:
  // Se for categoria principal (main), agrega suas próprias transações E de todas as subcategorias filhas.
  // Se for subcategoria (sub), apenas as transações dela.
  const applicableCategoryIds = useMemo(() => {
    if (!category) return new Set<string>()
    const ids = new Set<string>([category.id])
    if (category.type === 'main') {
      allCategories.forEach((c) => {
        const pId = typeof c.parent === 'string' ? c.parent : (c.parent as any)?.id
        if (pId === category.id) {
          ids.add(c.id)
        }
      })
    }
    return ids
  }, [category, allCategories])

  // Filtrar e preparar os lançamentos correspondentes
  const matchingTransactions = useMemo(() => {
    if (!category) return []

    return transactions.filter((tx) => {
      // 1. Deve pertencer a uma das categorias aplicáveis
      const txCatId = tx.category || (tx.expand?.category ? tx.expand.category.id : '')
      if (!applicableCategoryIds.has(txCatId)) {
        return false
      }

      // 2. Deve respeitar o mês filtrado ou estar dentro do período ativo da página
      const txMonth = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
      if (selectedMonth !== 'all') {
        if (txMonth !== selectedMonth) return false
      } else {
        // Se 'all', só inclui os que estão no período ativo considerado na tabela
        if (activeMonths.length > 0 && !activeMonths.includes(txMonth)) {
          return false
        }
      }

      // 3. Busca textual opcional
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const descMatch = (tx.description || '').toLowerCase().includes(q)
        const amtMatch = String(tx.amount || '').includes(q)
        const dateMatch = (tx.date || '').includes(q)
        if (!descMatch && !amtMatch && !dateMatch) return false
      }

      return true
    })
  }, [category, applicableCategoryIds, transactions, selectedMonth, activeMonths, searchQuery])

  // Ordenar transações (por data mais recente ou mais antiga)
  const sortedTransactions = useMemo(() => {
    return [...matchingTransactions].sort((a, b) => {
      const dateA = a.date || a.month || ''
      const dateB = b.date || b.month || ''
      if (dateA === dateB) {
        return sortOrder === 'desc'
          ? (b.created || '').localeCompare(a.created || '')
          : (a.created || '').localeCompare(b.created || '')
      }
      return sortOrder === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB)
    })
  }, [matchingTransactions, sortOrder])

  // Somatório total na moeda ativa
  const totalBrl = useMemo(() => {
    return sortedTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  }, [sortedTransactions])

  // Mapa de id da categoria para nome amigável (para indicar em categorias-pai se veio de subcategoria)
  const categoryNamesMap = useMemo(() => {
    const map = new Map<string, string>()
    allCategories.forEach((c) => map.set(c.id, c.name))
    return map
  }, [allCategories])

  if (!category) return null

  const isMainCategory = category.type === 'main'
  const isSubCategory = category.type === 'sub'

  // Período de exibição
  const periodLabel =
    selectedMonth !== 'all'
      ? formatMonthShort(selectedMonth)
      : activeMonths.length > 0
        ? `${formatMonthShort(activeMonths[0])} a ${formatMonthShort(activeMonths[activeMonths.length - 1])}`
        : 'Todos os meses'

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col bg-slate-50 border-l border-slate-200 z-50 text-slate-800"
      >
        {/* Header */}
        <SheetHeader className="p-6 pb-4 bg-white border-b border-slate-200 text-left space-y-3">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: category.color || '#2563EB' }}
                />
                <SheetTitle className="text-xl font-bold tracking-tight text-slate-900">
                  {category.name}
                </SheetTitle>
                <Badge
                  variant="outline"
                  className="text-[11px] font-medium border-slate-200 bg-slate-50 text-slate-600"
                >
                  {isMainCategory ? 'Categoria Principal' : 'Subcategoria'}
                </Badge>
              </div>

              {isSubCategory && parentCategory && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <span>Pertence a:</span>
                  <span className="font-semibold text-slate-700">{parentCategory.name}</span>
                </p>
              )}

              <SheetDescription className="text-xs text-slate-500">
                Detalhamento dos lançamentos individuais que compõem o valor realizado no período.
              </SheetDescription>
            </div>
          </div>

          {/* Indicadores rápidos: Período e Contagem */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Badge
              variant="secondary"
              className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60 text-xs px-2.5 py-0.5 gap-1.5 font-medium"
            >
              <Calendar className="h-3 w-3" />
              Período: {periodLabel}
            </Badge>

            <Badge
              variant="secondary"
              className="bg-slate-100 text-slate-700 border border-slate-200/80 text-xs px-2.5 py-0.5 gap-1 font-medium"
            >
              <ReceiptText className="h-3 w-3 text-slate-500" />
              {sortedTransactions.length}{' '}
              {sortedTransactions.length === 1 ? 'lançamento' : 'lançamentos'}
            </Badge>

            {isMainCategory && (
              <Badge
                variant="outline"
                className="text-[11px] text-slate-600 border-dashed border-slate-300 gap-1"
                title="Soma todas as despesas diretas e de subcategorias vinculadas"
              >
                <Layers className="h-3 w-3 text-slate-400" />
                Inclui subcategorias
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Toolbar de Filtro e Busca dentro do painel */}
        <div className="p-4 bg-white/70 border-b border-slate-200/80 space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Filtro de Mês */}
            <div className="w-full sm:w-48">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                  <SelectValue placeholder="Mês específico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-semibold">
                    Todo o período ({activeMonths.length} meses)
                  </SelectItem>
                  {activeMonths.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {formatMonthShort(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Busca textual por descrição */}
            <div className="relative flex-1 min-w-[140px]">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar descrição ou valor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-white border-slate-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                  aria-label="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Alternar ordenação cronológica */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="h-8 px-2.5 text-xs border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shrink-0"
              title={
                sortOrder === 'desc'
                  ? 'Mais recentes primeiro (clique para inverter)'
                  : 'Mais antigos primeiro (clique para inverter)'
              }
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-slate-400" />
              {sortOrder === 'desc' ? 'Mais recentes' : 'Mais antigos'}
            </Button>
          </div>
        </div>

        {/* Lista de Transações */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sortedTransactions.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <FilterX className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Nenhum lançamento encontrado</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                {searchQuery || selectedMonth !== 'all'
                  ? 'Nenhuma transação corresponde aos filtros selecionados. Tente ajustar a busca ou o mês.'
                  : 'Não constam saídas para esta categoria no período selecionado.'}
              </p>
              {(searchQuery || selectedMonth !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedMonth('all')
                  }}
                  className="mt-4 text-xs h-8 border-slate-300"
                >
                  Limpar filtros do painel
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTransactions.map((tx) => {
                const txMonth = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
                const monthRate = getRateForMonth(txMonth, exchangeRates)
                const amtBrl = Number(tx.amount) || 0
                const formattedDate = tx.date
                  ? tx.date.slice(0, 10).split('-').reverse().join('/')
                  : formatMonthShort(txMonth)

                // Subcategoria de origem (quando for categoria mãe)
                const txCatId = tx.category || (tx.expand?.category ? tx.expand.category.id : '')
                const isSubItem = isMainCategory && txCatId && txCatId !== category.id
                const subName = isSubItem ? categoryNamesMap.get(txCatId) : null

                return (
                  <div
                    key={tx.id}
                    className="p-3 bg-white rounded-lg border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-500 tabular-nums flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {formattedDate}
                        </span>

                        {tx.source && (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] py-0 px-1.5 font-normal ${
                              tx.source === 'importado'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200/60'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {tx.source === 'importado' ? 'Extrato' : 'Manual'}
                          </Badge>
                        )}

                        {subName && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 font-medium border-slate-200 bg-slate-50 text-slate-600 truncate max-w-[180px]"
                            title={`Lançamento vinculado à subcategoria ${subName}`}
                          >
                            ↳ {subName}
                          </Badge>
                        )}
                      </div>

                      <p
                        className="text-xs font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors block w-full"
                        title={tx.description || 'Sem descrição'}
                      >
                        {tx.description || 'Sem descrição'}
                      </p>
                    </div>

                    <div className="text-right shrink-0 pl-3">
                      <div className="font-bold text-sm text-slate-900 tabular-nums">
                        {formatCurrency(amtBrl, currency, monthRate)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer com Total do Período */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total do Período (
              {selectedMonth !== 'all' ? formatMonthShort(selectedMonth) : 'Geral'})
            </span>
            <div className="text-xs text-slate-500">
              {sortedTransactions.length}{' '}
              {sortedTransactions.length === 1 ? 'item computado' : 'itens computados'}
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg font-bold text-slate-900 tabular-nums">
              {formatCurrency(
                totalBrl,
                currency,
                selectedMonth !== 'all'
                  ? getRateForMonth(selectedMonth, exchangeRates)
                  : getRateForMonth(undefined, exchangeRates),
              )}
            </div>
            {currency === 'EUR' && (
              <div className="text-[11px] text-slate-500 tabular-nums">
                R$ {totalBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
