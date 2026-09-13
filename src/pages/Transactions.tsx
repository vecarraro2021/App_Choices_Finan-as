import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getTransactions,
  getCategories,
  createTransaction,
  createTransactionsBatch,
  updateTransaction,
  deleteTransaction,
  getExchangeRates,
  getRateForMonth,
} from '@/services/financeService'
import { suggestCategory } from '@/lib/categorizer'
import { parseCSV, parseAmount, normalizeDate, ParsedRow } from '@/lib/fileParser'
import { formatCurrency, formatMonthShort } from '@/lib/formatters'
import { Transaction, Category, ExchangeRate } from '@/types/finance'
import { extractTextFromPDF } from '@/lib/pdfExtractor'
import { parsePDFStatement, PDFParsedTransaction } from '@/lib/pdfStatementParser'
import { useToast } from '@/hooks/use-toast'
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategorySelectCombobox } from '@/components/CategorySelectCombobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PlanningImporter from '@/components/PlanningImporter'
import { useNavigate } from 'react-router-dom'

interface PreviewTransaction {
  id: string
  date: string
  description: string
  amount: number // Em BRL (convertido se EUR)
  originalAmount?: number
  originalCurrency?: 'BRL' | 'EUR'
  category?: string
  month: string
  selected?: boolean
}

export default function TransactionsView() {
  const { user, currency } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Upload & Mapping state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<ParsedRow[]>([])
  const [dateCol, setDateCol] = useState('')
  const [descCol, setDescCol] = useState('')
  const [amountCol, setAmountCol] = useState('')
  const [categoryCol, setCategoryCol] = useState('')
  const [importFileType, setImportFileType] = useState<'csv' | 'pdf'>('csv')
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [pdfMeta, setPdfMeta] = useState<{
    fileName: string
    currency: 'BRL' | 'EUR'
    year?: number
    totalPages: number
  } | null>(null)
  const [previewList, setPreviewList] = useState<PreviewTransaction[]>([])
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // Manual entry state
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10))
  const [manualDesc, setManualDesc] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [manualCategory, setManualCategory] = useState('')
  const [savingManual, setSavingManual] = useState(false)

  // Edit entry state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Load Categories
  const loadCategories = async () => {
    try {
      const [cats, ratesList] = await Promise.all([getCategories(), getExchangeRates()])
      setCategories(cats)
      setExchangeRates(ratesList)
    } catch (e) {
      console.error(e)
    }
  }

  // Load Transactions with Filters
  const loadTransactionsList = async () => {
    try {
      setLoading(true)
      const res = await getTransactions({
        page,
        perPage: 25,
        month: filterMonth !== 'all' ? filterMonth : undefined,
        category: filterCategory !== 'all' ? filterCategory : undefined,
        search: searchQuery.trim() || undefined,
      })
      setTransactions(res.items)
      setTotalItems(res.totalItems)
      setTotalPages(res.totalPages)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadTransactionsList()
  }, [page, filterMonth, filterCategory, searchQuery])

  useRealtime('transactions', () => loadTransactionsList())

  // Available unique months from all transactions
  const availableMonths = useMemo(() => {
    const list = [
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]
    return list
  }, [])

  // Processamento de arquivo PDF (client-side)
  const processPdfFile = async (file: File) => {
    try {
      setIsProcessingFile(true)
      const extracted = await extractTextFromPDF(file)

      if (!extracted.fullText || extracted.fullText.trim().length === 0) {
        toast({
          title: 'Não foi possível identificar transações neste PDF',
          description:
            'O arquivo pode ser protegido por senha, digitalizado como imagem sem camada de texto pesquisável ou estar em branco.',
          variant: 'destructive',
        })
        return
      }

      // Reunir todas as linhas de todas as páginas
      const allLines = extracted.pages.flatMap((p) => p.lines)
      const parseResult = parsePDFStatement(allLines, extracted.fullText)

      if (parseResult.transactions.length === 0) {
        toast({
          title: 'Não foi possível identificar transações neste PDF',
          description:
            parseResult.reason ||
            'Não foram reconhecidas linhas com data, descrição e valor válidos nos padrões comuns de extratos ou faturas.',
          variant: 'destructive',
        })
        return
      }

      setImportFileType('pdf')
      setPdfMeta({
        fileName: file.name,
        currency: parseResult.detectedCurrency || 'BRL',
        year: parseResult.detectedYear,
        totalPages: extracted.totalPages,
      })

      // Converter transações detectadas para o modelo PreviewTransaction
      // Aplicando conversão cambial se moeda for EUR e categorização automática inteligente
      const preview: PreviewTransaction[] = parseResult.transactions.map((tx, idx) => {
        const assignedCat = suggestCategory(tx.description, categories)
        const rateUsed = getRateForMonth(tx.month, exchangeRates)

        // Se o PDF foi emitido em EUR, converte para BRL usando a taxa do mês
        let amountBrl = tx.amount
        if (tx.currency === 'EUR') {
          amountBrl = Math.round(tx.amount * rateUsed * 100) / 100
        }

        return {
          id: `pdf-preview-${idx}`,
          date: tx.date,
          description: tx.description,
          amount: amountBrl,
          originalAmount: tx.amount,
          originalCurrency: tx.currency,
          category: assignedCat,
          month: tx.month,
          selected: true,
        }
      })

      setPreviewList(preview)
      setShowPreviewDialog(true)

      toast({
        title: 'Extrato PDF processado!',
        description: `${parseResult.transactions.length} transações identificadas em ${extracted.totalPages} página(s).`,
      })
    } catch (err: any) {
      console.error('Erro na extração de PDF:', err)
      toast({
        title: 'Falha ao ler arquivo PDF',
        description:
          err.message ||
          'Não foi possível extrair o texto deste PDF no seu navegador. Verifique se o arquivo não está corrompido.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Handle file select (CSV, TXT ou PDF)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      await processPdfFile(file)
      return
    }

    try {
      setIsProcessingFile(true)
      setImportFileType('csv')
      setPdfMeta(null)

      const text = await file.text()
      const parsed = parseCSV(text)

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast({
          title: 'Arquivo vazio ou formato não suportado',
          description: 'Não foi possível ler as colunas do arquivo enviado.',
          variant: 'destructive',
        })
        return
      }

      setUploadedHeaders(parsed.headers)
      setRawRows(parsed.rows)

      // Auto-detect columns
      const lowerHeaders = parsed.headers.map((h) => h.toLowerCase())

      const dIdx = lowerHeaders.findIndex((h) => h.includes('data') || h.includes('date'))
      const descIdx = lowerHeaders.findIndex(
        (h) =>
          h.includes('desc') ||
          h.includes('hist') ||
          h.includes('lancamento') ||
          h.includes('estabelecimento'),
      )
      const valIdx = lowerHeaders.findIndex(
        (h) =>
          h.includes('val') || h.includes('quantia') || h.includes('amount') || h.includes('total'),
      )
      const catIdx = lowerHeaders.findIndex(
        (h) => h.includes('cat') || h.includes('tag') || h.includes('classe'),
      )

      const detectedDate = dIdx !== -1 ? parsed.headers[dIdx] : parsed.headers[0]
      const detectedDesc =
        descIdx !== -1 ? parsed.headers[descIdx] : parsed.headers[1] || parsed.headers[0]
      const detectedAmount =
        valIdx !== -1 ? parsed.headers[valIdx] : parsed.headers[2] || parsed.headers[0]
      const detectedCat = catIdx !== -1 ? parsed.headers[catIdx] : 'none'

      setDateCol(detectedDate)
      setDescCol(detectedDesc)
      setAmountCol(detectedAmount)
      setCategoryCol(detectedCat)

      buildPreview(parsed.rows, detectedDate, detectedDesc, detectedAmount, detectedCat)
      setShowPreviewDialog(true)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao processar arquivo',
        description: 'Verifique se o arquivo é um CSV, XLSX ou extrato válido.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Build preview items with auto-categorization
  const buildPreview = (
    rows: ParsedRow[],
    dCol: string,
    descC: string,
    amtCol: string,
    cCol: string,
  ) => {
    const preview: PreviewTransaction[] = rows.map((r, i) => {
      const rawDate = r[dCol]
      const normDate = normalizeDate(rawDate)
      const desc = r[descC] || 'Sem descrição'
      const amt = parseAmount(r[amtCol])
      const month = normDate.slice(0, 7)

      // Attempt matching category from file column or auto-categorizer
      let assignedCat: string | undefined
      if (cCol && cCol !== 'none' && r[cCol]) {
        const found = categories.find((c) => c.name.toLowerCase() === r[cCol].trim().toLowerCase())
        if (found) assignedCat = found.id
      }

      if (!assignedCat) {
        assignedCat = suggestCategory(desc, categories)
      }

      return {
        id: `preview-${i}`,
        date: normDate,
        description: desc,
        amount: amt,
        category: assignedCat,
        month,
        selected: true,
      }
    })

    setPreviewList(preview)
  }

  // Re-build preview when user manually adjusts column mapping
  const handleApplyMapping = () => {
    buildPreview(rawRows, dateCol, descCol, amountCol, categoryCol)
  }

  // Save imported transactions
  const handleConfirmImport = async () => {
    const itemsToSave = previewList.filter((item) => item.selected !== false)
    if (itemsToSave.length === 0) {
      toast({
        title: 'Nenhuma transação selecionada',
        description: 'Selecione pelo menos uma transação para salvar.',
        variant: 'destructive',
      })
      return
    }
    setIsImporting(true)

    try {
      const toInsert = itemsToSave.map((item) => ({
        date: item.date,
        description: item.description,
        amount: item.amount,
        category: item.category || undefined,
        source: 'importado' as const,
        month: item.month,
      }))

      const count = await createTransactionsBatch(toInsert)

      toast({
        title: 'Importação concluída',
        description: `${count} lançamentos importados com sucesso!`,
      })

      setShowPreviewDialog(false)
      setPreviewList([])
      setRawRows([])
      setPage(1)
      loadTransactionsList()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro na importação',
        description: 'Ocorreu uma falha ao gravar alguns lançamentos.',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }

  // Add manual transaction
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualDesc || !manualAmount) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }

    try {
      setSavingManual(true)
      const amt = parseAmount(manualAmount)
      const month = manualDate.slice(0, 7)

      await createTransaction({
        date: manualDate,
        description: manualDesc,
        amount: amt,
        category: manualCategory || undefined,
        source: 'manual',
        month,
      })

      toast({ title: 'Lançamento manual registrado!' })
      setShowManualDialog(false)
      setManualDesc('')
      setManualAmount('')
      setManualCategory('')
      loadTransactionsList()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao registrar lançamento', variant: 'destructive' })
    } finally {
      setSavingManual(false)
    }
  }

  // Open edit modal
  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx)
    setEditDate(tx.date ? tx.date.slice(0, 10) : '')
    setEditDesc(tx.description)
    setEditAmount(String(tx.amount))
    setEditCategory(tx.category || '')
  }

  // Save edited transaction
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTx) return

    try {
      setSavingEdit(true)
      const amt = parseAmount(editAmount)
      const month = editDate.slice(0, 7)

      await updateTransaction(editingTx.id, {
        date: editDate,
        description: editDesc,
        amount: amt,
        category: editCategory || undefined,
        month,
      })

      toast({ title: 'Lançamento atualizado!' })
      setEditingTx(null)
      loadTransactionsList()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao salvar alteração', variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete transaction
  const handleDeleteTx = async (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return
    try {
      await deleteTransaction(id)
      toast({ title: 'Lançamento excluído com sucesso.' })
      loadTransactionsList()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao excluir lançamento', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Extratos & Faturas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Importe extratos mensais ou o histórico da planilha de planejamento para alimentar seus
            relatórios.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowManualDialog(true)}
            variant="outline"
            className="border-slate-300 hover:bg-slate-100"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Lançamento Manual
          </Button>

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFile}
            className="bg-blue-600 hover:bg-blue-700 font-semibold shadow-xs"
          >
            {isProcessingFile ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Lendo Arquivo...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload de Extrato / PDF
              </>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.tsv,.xlsx,.xls,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Tabs for choosing Importer mode */}
      <Tabs defaultValue="planning" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xl bg-slate-100 p-1">
          <TabsTrigger
            value="planning"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
            Planilha de Planejamento (Histórico Jan–Ago)
          </TabsTrigger>
          <TabsTrigger
            value="statement"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs"
          >
            <UploadCloud className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
            Extratos & Faturas (Mapeamento de Colunas)
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Planning Sheet Importer */}
        <TabsContent value="planning" className="pt-3">
          <PlanningImporter
            onSuccess={() => {
              loadCategories()
              loadTransactionsList()
            }}
            onNavigateToBudgetVsActual={() => navigate('/orcado-vs-realizado')}
            onNavigateToOverview={() => navigate('/')}
          />
        </TabsContent>

        {/* Tab 2: Standard Statement Importer (CSV, XLSX, PDF) */}
        <TabsContent value="statement" className="pt-3">
          <div
            onClick={() => !isProcessingFile && fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files?.[0]
              if (file) {
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                  processPdfFile(file)
                } else {
                  // CSV / TXT / XLS
                  const dt = new DataTransfer()
                  dt.items.add(file)
                  if (fileInputRef.current) {
                    fileInputRef.current.files = dt.files
                    fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
                  }
                }
              }
            }}
            className={`group relative cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center transition-all hover:border-blue-500 hover:bg-blue-50/20 ${
              isProcessingFile ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
              {isProcessingFile ? (
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              ) : (
                <div className="flex items-center -space-x-1.5">
                  <FileText className="h-6 w-6 text-red-500" />
                  <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                </div>
              )}
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-900">
              {isProcessingFile
                ? 'Processando documento no navegador...'
                : 'Clique ou arraste seu extrato bancário ou fatura (CSV, XLSX ou PDF)'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Extração 100% no seu navegador com detecção de valores, datas, descrições e câmbio
              mensal automático.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 flex-wrap justify-center">
              <span>
                PDFs de cartões & contas: Nubank, Itaú, Bradesco, Millennium BCP, CGD, Santander,
                Inter e C6
              </span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Filters Bar */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por descrição (ex: Mercado, Uber, Spotify)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9 text-xs"
              />
            </div>

            {/* Month Filter */}
            <div className="w-full sm:w-48">
              <Select
                value={filterMonth}
                onValueChange={(val) => {
                  setFilterMonth(val)
                  setPage(1)
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Filtrar por Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Meses</SelectItem>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonthShort(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="w-full sm:w-56">
              <CategorySelectCombobox
                categories={categories}
                value={filterCategory}
                onChange={(val) => {
                  setFilterCategory(val)
                  setPage(1)
                }}
                triggerClassName="text-xs h-9"
                placeholder="Todas as Categorias"
                searchPlaceholder="Buscar categoria..."
                emptyText="Nenhuma categoria encontrada."
                specialOption={{ id: 'all', label: 'Todas as Categorias' }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Lançamentos Registrados ({totalItems})
            </CardTitle>
            <CardDescription className="text-xs">
              Histórico consolidado com categorias e método de inserção
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Carregando lançamentos...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center">
              <FileSpreadsheet className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Nenhum lançamento encontrado</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Importe seu primeiro extrato ou adicione lançamentos manuais acima.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/70 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Origem</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-900 tabular-nums">
                        {tx.date ? normalizeDate(tx.date).split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 max-w-xs truncate">
                        {tx.description}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge
                          variant="secondary"
                          className="font-medium text-xs bg-slate-100 text-slate-700"
                        >
                          {tx.expand?.category?.name || 'Não Categorizado'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            tx.source === 'importado'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {tx.source === 'importado' ? 'Importado' : 'Manual'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {(() => {
                          const txMonth = tx.month || (tx.date ? tx.date.slice(0, 7) : '')
                          const rateUsed = getRateForMonth(txMonth, exchangeRates)
                          const isEurView = currency === 'EUR'

                          // If currency is EUR: tx.amount is stored in EUR (from sheet) or in BRL?
                          // In the sheet import, amount was stored in EUR (val) or in BRL.
                          // When displaying, formatCurrency uses rateUsed.
                          // If stored in BRL: formatCurrency(tx.amount, currency, rateUsed)
                          // If stored in EUR: format in EUR, converted to BRL is tx.amount * rateUsed
                          // Since transactions are all entries in EUR converted to real:
                          // Let's display with formatCurrency passing the month rate:
                          return (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-slate-900">
                                {formatCurrency(tx.amount, currency, rateUsed)}
                              </span>
                              <span
                                className="text-[10px] text-slate-400 font-normal hover:text-slate-700 cursor-help"
                                title={`Convertido usando a taxa média de ${txMonth}: € 1 = R$ ${rateUsed.toFixed(2)}`}
                              >
                                {isEurView
                                  ? `câmbio R$ ${rateUsed.toFixed(2)}`
                                  : `× ${rateUsed.toFixed(2)}`}
                              </span>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-blue-600"
                          onClick={() => handleOpenEdit(tx)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-red-600"
                          onClick={() => handleDeleteTx(tx.id)}
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 p-4">
              <span className="text-xs text-slate-500">
                Página {page} de {totalPages} ({totalItems} itens)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 text-xs"
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* IMPORT PREVIEW & COLUMN MAPPING MODAL */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              {importFileType === 'pdf'
                ? 'Revisão do Extrato PDF Extraído'
                : 'Mapeamento de Colunas e Pré-visualização'}
            </DialogTitle>
            <DialogDescription>
              {importFileType === 'pdf'
                ? 'Revise os lançamentos identificados no PDF, ajuste categorias e desmarque os que não desejar incluir.'
                : 'Confirme qual coluna corresponde a cada dado e revise as categorias sugeridas antes de salvar.'}
            </DialogDescription>
          </DialogHeader>

          {/* Banner específico para importação de PDF */}
          {importFileType === 'pdf' && pdfMeta && (
            <div className="p-3 bg-blue-50/80 rounded-lg border border-blue-200 text-xs text-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  Arquivo: <strong>{pdfMeta.fileName}</strong> ({pdfMeta.totalPages} página(s))
                  {pdfMeta.year && ` • Ano: ${pdfMeta.year}`}
                  {pdfMeta.currency === 'EUR' && (
                    <Badge
                      variant="outline"
                      className="ml-2 bg-amber-50 text-amber-800 border-amber-200 text-[10px]"
                    >
                      Valores em EUR convertidos para R$ pela taxa média de cada mês
                    </Badge>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = previewList.every((it) => it.selected !== false)
                    setPreviewList(previewList.map((it) => ({ ...it, selected: !allSelected })))
                  }}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  {previewList.every((it) => it.selected !== false)
                    ? 'Desmarcar todos'
                    : 'Marcar todos'}
                </button>
              </div>
            </div>
          )}

          {/* Column selector form (apenas para CSV) */}
          {importFileType === 'csv' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Coluna de Data</Label>
                <Select
                  value={dateCol}
                  onValueChange={(v) => {
                    setDateCol(v)
                  }}
                >
                  <SelectTrigger className="h-8 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {uploadedHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  Coluna de Descrição
                </Label>
                <Select
                  value={descCol}
                  onValueChange={(v) => {
                    setDescCol(v)
                  }}
                >
                  <SelectTrigger className="h-8 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {uploadedHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600">Coluna de Valor</Label>
                <Select
                  value={amountCol}
                  onValueChange={(v) => {
                    setAmountCol(v)
                  }}
                >
                  <SelectTrigger className="h-8 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {uploadedHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600">
                  Coluna de Categoria (Opcional)
                </Label>
                <Select
                  value={categoryCol}
                  onValueChange={(v) => {
                    setCategoryCol(v)
                  }}
                >
                  <SelectTrigger className="h-8 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Auto-identificar por IA</SelectItem>
                    {uploadedHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 md:col-span-4 flex justify-end mt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleApplyMapping}
                  className="text-xs h-7"
                >
                  Reaplicar Mapeamento
                </Button>
              </div>
            </div>
          )}

          {/* Preview rows */}
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 sticky top-0 font-semibold text-slate-700">
                <tr>
                  {importFileType === 'pdf' && (
                    <th className="py-2 px-3 w-8 text-center">
                      <span className="sr-only">Selecionar</span>
                    </th>
                  )}
                  <th className="py-2 px-3">Data</th>
                  <th className="py-2 px-3">Descrição</th>
                  <th className="py-2 px-3">Categoria Sugerida</th>
                  <th className="py-2 px-3 text-right">Valor (BRL)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewList.map((row, idx) => {
                  const isChecked = row.selected !== false
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !isChecked ? 'opacity-40 bg-slate-50/50' : ''
                      }`}
                    >
                      {importFileType === 'pdf' && (
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = [...previewList]
                              updated[idx].selected = e.target.checked
                              setPreviewList(updated)
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-2 px-3 whitespace-nowrap tabular-nums font-medium text-slate-900">
                        {row.date.split('-').reverse().join('/')}
                      </td>
                      <td className="py-2 px-3 max-w-[240px] truncate font-medium text-slate-800">
                        {row.description}
                      </td>
                      <td className="py-2 px-3">
                        <Select
                          value={row.category || 'none'}
                          onValueChange={(val) => {
                            const updated = [...previewList]
                            updated[idx].category = val === 'none' ? undefined : val
                            setPreviewList(updated)
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-[190px]">
                            <SelectValue placeholder="Selecione categoria" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            <SelectItem value="none">Não Categorizado</SelectItem>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.type === 'sub' ? `↳ ${c.name}` : c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                        <div>
                          <span>{formatCurrency(row.amount, 'BRL')}</span>
                          {row.originalCurrency === 'EUR' && row.originalAmount && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              (orig: € {row.originalAmount.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter className="flex items-center justify-between mt-3 pt-2 border-t">
            <span className="text-xs text-slate-500 font-medium">
              Total selecionado:{' '}
              <strong>
                {previewList.filter((it) => it.selected !== false).length} de {previewList.length}{' '}
                lançamentos
              </strong>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreviewDialog(false)}
                disabled={isImporting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="bg-blue-600 hover:bg-blue-700 font-semibold"
              >
                {isImporting ? 'Gravando lançamentos...' : 'Importar Lançamentos'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MANUAL ENTRY MODAL */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Lançamento Manual</DialogTitle>
            <DialogDescription>
              Cadastre despesas avulsas ou despesas não constantes nas faturas importadas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveManual} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-date">Data da Despesa</Label>
              <Input
                id="m-date"
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-desc">Descrição</Label>
              <Input
                id="m-desc"
                placeholder="Ex: Almoço no Restaurante X"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-amt">Valor (R$ BRL)</Label>
              <Input
                id="m-amt"
                type="text"
                placeholder="Ex: 85,50"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-cat">Categoria</Label>
              <CategorySelectCombobox
                categories={categories}
                value={manualCategory}
                onChange={setManualCategory}
                placeholder="Selecione uma categoria"
                searchPlaceholder="Buscar categoria..."
                emptyText="Nenhuma categoria encontrada."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowManualDialog(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingManual}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savingManual ? 'Salvando...' : 'Salvar Lançamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT ENTRY MODAL */}
      <Dialog open={!!editingTx} onOpenChange={(open) => !open && setEditingTx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Lançamento</DialogTitle>
            <DialogDescription>
              Altere valores, datas ou reatribua a categoria deste registro.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="e-date">Data</Label>
              <Input
                id="e-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-desc">Descrição</Label>
              <Input
                id="e-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-amt">Valor (R$ BRL)</Label>
              <Input
                id="e-amt"
                type="text"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-cat">Categoria</Label>
              <CategorySelectCombobox
                categories={categories}
                value={editCategory}
                onChange={setEditCategory}
                placeholder="Selecione uma categoria"
                searchPlaceholder="Buscar categoria..."
                emptyText="Nenhuma categoria encontrada."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingTx(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingEdit} className="bg-blue-600 hover:bg-blue-700">
                {savingEdit ? 'Salvando...' : 'Atualizar Lançamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
