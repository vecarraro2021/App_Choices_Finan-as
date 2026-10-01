import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getTransactions,
  getCategories,
  createTransaction,
  createTransactionsBatch,
  updateTransaction,
  updateTransactionsMonthBatch,
  deleteTransaction,
  getExchangeRates,
  getRateForMonth,
} from '@/services/financeService'
import { suggestCategory, evaluateCategoryMatch } from '@/lib/categorizer'
import {
  parseCSV,
  parseAmount,
  normalizeDate,
  ParsedRow,
  parseStatementFile,
  validatePreviewSanity,
  isBinaryOrCorruptedText,
} from '@/lib/fileParser'
import { convertSheetToMarkdown } from '@/services/financeService'
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
  X,
  Calendar,
  CalendarCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useSearchParams } from 'react-router-dom'

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
  originalDate?: string
}

export default function TransactionsView() {
  const { user, currency } = useAuth()
  const { toast } = useToast()

  const [categories, setCategories] = useState<Category[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Read initial filters from search params (e.g. redirected from BudgetVsActual inline cell)
  const [searchParams] = useSearchParams()
  const initialMonth = searchParams.get('month') || 'all'
  const initialCat = searchParams.get('category') || 'all'

  // Filters
  const [filterMonth, setFilterMonth] = useState<string>(initialMonth)
  const [filterCategory, setFilterCategory] = useState<string>(initialCat)
  const [searchQuery, setSearchQuery] = useState('')

  // Multi-selection state
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([])
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)
  const [showBatchMonthModal, setShowBatchMonthModal] = useState(false)
  const [batchTargetMonth, setBatchTargetMonth] = useState('2026-09')
  const [batchAdjustDates, setBatchAdjustDates] = useState(true)
  const [isRelocatingBatch, setIsRelocatingBatch] = useState(false)

  // Upload & Mapping state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<ParsedRow[]>([])
  const [dateCol, setDateCol] = useState('')
  const [descCol, setDescCol] = useState('')
  const [amountCol, setAmountCol] = useState('')
  const [amountCurrency, setAmountCurrency] = useState<'EUR' | 'BRL'>('EUR') // Seletor de moeda da coluna de valores (padrão EUR)
  const [categoryCol, setCategoryCol] = useState('')
  const [importFileType, setImportFileType] = useState<'csv' | 'pdf'>('csv')
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [pdfMeta, setPdfMeta] = useState<{
    fileName: string
    currency: 'BRL' | 'EUR'
    year?: number
    totalPages: number
    detectedCompetenceMonth?: string
    detectedPeriodLabel?: string
    detectedDueDate?: string
    isCreditCardInvoice?: boolean
  } | null>(null)
  const [dateMode, setDateMode] = useState<'competence' | 'original'>('original')
  const [competenceMonth, setCompetenceMonth] = useState<string>('2026-09')
  const [rawParsedRows, setRawParsedRows] = useState<
    Array<{
      id: string
      date: string
      rawDate?: string
      description: string
      amount: number
      rawAmount?: number
      currency: 'BRL' | 'EUR'
      category?: string
      month: string
    }>
  >([])
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

  // Clear selection whenever filters or pagination changes so unviewed/filtered items are unselected
  useEffect(() => {
    setSelectedTxIds([])
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
      const initialPdfCurrency = parseResult.detectedCurrency || 'EUR'
      setAmountCurrency(initialPdfCurrency)
      setPdfMeta({
        fileName: file.name,
        currency: initialPdfCurrency,
        year: parseResult.detectedYear,
        totalPages: extracted.totalPages,
        detectedCompetenceMonth: parseResult.detectedCompetenceMonth,
        detectedPeriodLabel: parseResult.detectedPeriodLabel,
        detectedDueDate: parseResult.detectedDueDate,
        isCreditCardInvoice: parseResult.isCreditCardInvoice,
      })

      // Se for fatura de cartão de crédito e identificamos o mês de competência,
      // pré-selecionar 'competence' para que todas as despesas fiquem agrupadas no mês da fatura!
      const initialCompMonth =
        parseResult.detectedCompetenceMonth ||
        (parseResult.transactions[0] ? parseResult.transactions[0].month : '2026-09')
      setCompetenceMonth(initialCompMonth)

      const useCompetenceByInitial =
        parseResult.isCreditCardInvoice || Boolean(parseResult.detectedCompetenceMonth)
      setDateMode(useCompetenceByInitial ? 'competence' : 'original')

      const rawItems = parseResult.transactions.map((tx, idx) => {
        const matchResult = evaluateCategoryMatch(tx.description, categories)
        return {
          id: `pdf-raw-${idx}`,
          date: tx.date,
          rawDate: tx.rawDate,
          description: tx.description,
          amount: tx.amount,
          rawAmount: tx.amount,
          currency: initialPdfCurrency,
          category: matchResult.categoryId || undefined,
          month: tx.month,
        }
      })
      setRawParsedRows(rawItems)

      // Converter transações detectadas para o modelo PreviewTransaction aplicando modo de data
      const preview: PreviewTransaction[] = rawItems.map((raw, idx) => {
        const effectiveMonth = useCompetenceByInitial ? initialCompMonth : raw.month
        let effectiveDate = raw.date
        if (useCompetenceByInitial) {
          const rawDay = parseInt(raw.date.slice(8, 10), 10) || 1
          const [tY, tM] = initialCompMonth.split('-').map((v) => parseInt(v, 10))
          const maxDays = new Date(tY, tM, 0).getDate()
          const clamped = Math.min(Math.max(1, rawDay), maxDays)
          effectiveDate = `${initialCompMonth}-${String(clamped).padStart(2, '0')}`
        }

        const rateUsed = getRateForMonth(effectiveMonth, exchangeRates)
        let amountBrl = raw.amount
        if (initialPdfCurrency === 'EUR') {
          amountBrl = Math.round(raw.amount * rateUsed * 100) / 100
        }

        return {
          id: `pdf-preview-${idx}`,
          date: effectiveDate,
          originalDate: raw.date,
          description: raw.description,
          amount: amountBrl,
          originalAmount: raw.amount,
          originalCurrency: initialPdfCurrency,
          category: raw.category,
          month: effectiveMonth,
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

  // Handle file select (CSV, XLSX, XLS, TXT ou PDF)
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

      // Parse using parseStatementFile which checks magic bytes, handles binary abort, and supports XLSX
      const parsed = await parseStatementFile(file, convertSheetToMarkdown)

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast({
          title: 'Arquivo vazio ou formato não suportado',
          description: 'Não foi possível ler as colunas do arquivo enviado.',
          variant: 'destructive',
        })
        return
      }

      // Check sanity: prevent binary garbage in preview
      const sanity = validatePreviewSanity(parsed.rows)
      if (!sanity.isSane) {
        toast({
          title: 'Arquivo corrompido ou formato binário não reconhecido',
          description:
            sanity.reason ||
            'Não conseguimos ler este arquivo. Verifique se é um CSV ou planilha Excel válida (XLSX/XLS).',
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
      setAmountCurrency('EUR') // padrão EUR conforme especificação
      setCategoryCol(detectedCat)

      buildPreview(parsed.rows, detectedDate, detectedDesc, detectedAmount, detectedCat, 'EUR')
      setShowPreviewDialog(true)

      if (parsed.sourceType === 'xlsx') {
        toast({
          title: 'Planilha Excel identificada',
          description: `${parsed.rows.length} linhas lidas com sucesso. Confirme as colunas abaixo.`,
        })
      }
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Não conseguimos ler este arquivo',
        description: err.message || 'Verifique se é um CSV ou planilha Excel válida (XLSX/XLS).',
        variant: 'destructive',
      })
    } finally {
      setIsProcessingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Recalcula datas e meses de preview baseado no modo de competência escolhido
  const recalculatePreviewDates = (
    baseRows: typeof rawParsedRows,
    mode: 'competence' | 'original',
    targetMonth: string,
    curr: 'EUR' | 'BRL',
  ) => {
    return baseRows.map((raw, idx) => {
      const effectiveMonth = mode === 'competence' ? targetMonth : raw.month
      let effectiveDate = raw.date
      if (mode === 'competence') {
        const rawDay = parseInt(raw.date.slice(8, 10), 10) || 1
        const [tY, tM] = targetMonth.split('-').map((v) => parseInt(v, 10))
        const maxDays = new Date(tY, tM, 0).getDate()
        const clamped = Math.min(Math.max(1, rawDay), maxDays)
        effectiveDate = `${targetMonth}-${String(clamped).padStart(2, '0')}`
      }

      const rateUsed = getRateForMonth(effectiveMonth, exchangeRates)
      let amountBrl = raw.amount
      if (curr === 'EUR') {
        amountBrl = Math.round(raw.amount * rateUsed * 100) / 100
      }

      return {
        id: raw.id || `preview-${idx}`,
        date: effectiveDate,
        originalDate: raw.date,
        description: raw.description,
        amount: amountBrl,
        originalAmount: raw.rawAmount !== undefined ? raw.rawAmount : raw.amount,
        originalCurrency: curr,
        category: raw.category,
        month: effectiveMonth,
        selected: true,
      }
    })
  }

  // Build preview items with auto-categorization by keywords (CSV / XLSX)
  const buildPreview = (
    rows: ParsedRow[],
    dCol: string,
    descC: string,
    amtCol: string,
    cCol: string,
    colCurrency: 'EUR' | 'BRL' = amountCurrency,
    overrideMode: 'competence' | 'original' = dateMode,
    overrideCompMonth: string = competenceMonth,
  ) => {
    const rawItems = rows.map((r, i) => {
      const rawDate = r[dCol]
      const normDate = normalizeDate(rawDate)
      const desc = r[descC] || 'Sem descrição'
      const rawAmt = parseAmount(r[amtCol])
      const m = normDate.slice(0, 7)

      // Attempt matching category from file column or auto-categorizer
      let assignedCat: string | undefined
      if (cCol && cCol !== 'none' && r[cCol]) {
        const found = categories.find((c) => c.name.toLowerCase() === r[cCol].trim().toLowerCase())
        if (found) {
          assignedCat = found.id
        }
      }

      if (!assignedCat) {
        const matchResult = evaluateCategoryMatch(desc, categories)
        if (matchResult.categoryId) {
          assignedCat = matchResult.categoryId
        }
      }

      return {
        id: `csv-raw-${i}`,
        date: normDate,
        rawDate,
        description: desc,
        amount: rawAmt,
        rawAmount: rawAmt,
        currency: colCurrency,
        category: assignedCat,
        month: m,
      }
    })

    setRawParsedRows(rawItems)

    const preview = recalculatePreviewDates(rawItems, overrideMode, overrideCompMonth, colCurrency)
    setPreviewList(preview)
  }

  // Re-build preview when user changes currency in PDF mode
  const handlePdfCurrencyChange = (newCurr: 'EUR' | 'BRL') => {
    setAmountCurrency(newCurr)
    if (pdfMeta) {
      setPdfMeta({ ...pdfMeta, currency: newCurr })
    }
    setPreviewList((prev) =>
      prev.map((item) => {
        const rawAmt = item.originalAmount !== undefined ? item.originalAmount : item.amount
        const rateUsed = getRateForMonth(item.month, exchangeRates)
        let convertedBrl = rawAmt
        if (newCurr === 'EUR') {
          convertedBrl = Math.round(rawAmt * rateUsed * 100) / 100
        }
        return {
          ...item,
          amount: convertedBrl,
          originalAmount: rawAmt,
          originalCurrency: newCurr,
        }
      }),
    )
  }

  // Re-build preview when user manually adjusts column mapping or currency
  const handleApplyMapping = (forcedCurrency?: 'EUR' | 'BRL' | React.MouseEvent) => {
    const effCurr =
      typeof forcedCurrency === 'string' && (forcedCurrency === 'EUR' || forcedCurrency === 'BRL')
        ? forcedCurrency
        : amountCurrency
    buildPreview(
      rawRows,
      dateCol,
      descCol,
      amountCol,
      categoryCol,
      effCurr,
      dateMode,
      competenceMonth,
    )
  }

  // Alterna modo de datação (competência da fatura vs data original de cada transação)
  const handleDateModeChange = (
    newMode: 'competence' | 'original',
    targetMonth = competenceMonth,
  ) => {
    setDateMode(newMode)
    if (rawParsedRows.length > 0) {
      const updated = recalculatePreviewDates(rawParsedRows, newMode, targetMonth, amountCurrency)
      setPreviewList(updated)
    }
  }

  // Altera o mês de competência escolhido
  const handleCompetenceMonthChange = (newMonth: string) => {
    setCompetenceMonth(newMonth)
    if (dateMode === 'competence' && rawParsedRows.length > 0) {
      const updated = recalculatePreviewDates(rawParsedRows, 'competence', newMonth, amountCurrency)
      setPreviewList(updated)
    }
  }

  // Safety check on preview items: warns if suspiciously binary, unreadable or 100% 0 with identical date
  const previewSanityAlert = useMemo(() => {
    if (previewList.length === 0) return null

    const sample = previewList.slice(0, 30)
    let corruptedDescCount = 0
    let zeroCount = 0

    const firstDate = sample[0]?.date

    sample.forEach((item) => {
      // Check for binary garbage in description
      const desc = item.description || ''
      if (isBinaryOrCorruptedText(desc)) {
        corruptedDescCount++
      }
      if (item.amount === 0) {
        zeroCount++
      }
    })

    const isBinaryRatioHigh = corruptedDescCount / sample.length >= 0.2
    const allZeroSuspicious =
      zeroCount === sample.length && sample.every((it) => it.date === firstDate)

    if (isBinaryRatioHigh || (allZeroSuspicious && sample.length > 5)) {
      return {
        isCorrupted: true,
        message:
          'Atenção: Os dados pré-visualizados contêm caracteres binários ou descrições ilegíveis. O arquivo pode ser uma planilha Excel (XLSX) processada de forma incompatível.',
      }
    }

    return null
  }, [previewList])

  // Save imported transactions
  const handleConfirmImport = async () => {
    if (previewSanityAlert?.isCorrupted) {
      toast({
        title: 'Importação bloqueada por segurança',
        description:
          'Os dados contêm caracteres ilegíveis ou binários. Corrija o mapeamento ou envie o arquivo como planilha Excel válida.',
        variant: 'destructive',
      })
      return
    }

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
        amount_currency: item.originalCurrency || 'BRL',
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
      setSelectedTxIds((prev) => prev.filter((item) => item !== id))
      toast({ title: 'Lançamento excluído com sucesso.' })
      loadTransactionsList()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao excluir lançamento', variant: 'destructive' })
    }
  }

  // Batch selection handlers
  const visibleTxIds = useMemo(() => transactions.map((t) => t.id), [transactions])

  const areAllVisibleSelected = useMemo(() => {
    if (visibleTxIds.length === 0) return false
    return visibleTxIds.every((id) => selectedTxIds.includes(id))
  }, [visibleTxIds, selectedTxIds])

  const isSomeVisibleSelected = useMemo(() => {
    return visibleTxIds.some((id) => selectedTxIds.includes(id)) && !areAllVisibleSelected
  }, [visibleTxIds, selectedTxIds, areAllVisibleSelected])

  const handleToggleSelectAll = () => {
    if (areAllVisibleSelected) {
      // Unselect all visible
      setSelectedTxIds((prev) => prev.filter((id) => !visibleTxIds.includes(id)))
    } else {
      // Select all visible
      setSelectedTxIds((prev) => Array.from(new Set([...prev, ...visibleTxIds])))
    }
  }

  const handleToggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const handleClearSelection = () => {
    setSelectedTxIds([])
  }

  // Ação em lote: realocar mês/competência dos lançamentos selecionados
  const handleOpenBatchRelocate = () => {
    if (selectedTxIds.length === 0) return
    // Tenta sugerir o mês da primeira transação selecionada ou filterMonth ou setembro
    const firstSelected = transactions.find((t) => selectedTxIds.includes(t.id))
    const suggestedMonth = firstSelected?.month || (filterMonth !== 'all' ? filterMonth : '2026-09')
    setBatchTargetMonth(suggestedMonth)
    setShowBatchMonthModal(true)
  }

  const handleConfirmBatchRelocate = async () => {
    if (selectedTxIds.length === 0) return
    try {
      setIsRelocatingBatch(true)
      const res = await updateTransactionsMonthBatch(
        selectedTxIds,
        batchTargetMonth,
        batchAdjustDates,
      )
      toast({
        title: 'Competência realocada com sucesso!',
        description: `${res.updatedCount} lançamento(s) movidos para o mês ${formatMonthShort(
          batchTargetMonth,
        )}.`,
      })
      setShowBatchMonthModal(false)
      setSelectedTxIds([])
      loadTransactionsList()
    } catch (err: any) {
      console.error('Erro ao realocar em lote:', err)
      toast({
        title: 'Falha ao realocar competência',
        description: err.message || 'Ocorreu um erro ao atualizar os lançamentos.',
        variant: 'destructive',
      })
    } finally {
      setIsRelocatingBatch(false)
    }
  }

  const handleDeleteBatch = async () => {
    if (selectedTxIds.length === 0) return
    const count = selectedTxIds.length
    const message =
      count === 1
        ? 'Deseja realmente excluir o lançamento selecionado?'
        : `Deseja realmente excluir os ${count} lançamentos selecionados?`

    if (!confirm(message)) return

    try {
      setIsDeletingBatch(true)
      await Promise.all(selectedTxIds.map((id) => deleteTransaction(id)))
      toast({
        title:
          count === 1
            ? 'Lançamento excluído com sucesso.'
            : `${count} lançamentos excluídos com sucesso.`,
      })
      setSelectedTxIds([])
      loadTransactionsList()
    } catch (err) {
      console.error('Erro na exclusão em lote:', err)
      toast({
        title: 'Erro ao excluir lançamentos selecionados',
        description: 'Alguns itens podem não ter sido removidos.',
        variant: 'destructive',
      })
      loadTransactionsList()
    } finally {
      setIsDeletingBatch(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Extratos & Faturas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Importe extratos mensais ou faturas de cartão para alimentar seus relatórios.
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
                Upload
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

      {/* Standard Statement Importer Dropzone (CSV, XLSX, PDF) */}
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
          Categorização automática, detecção de valores, datas, descrições e câmbio mensal
          automático.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 flex-wrap justify-center">
          <span>
            PDFs de cartões & contas: Nubank, Itaú, Bradesco, Millennium BCP, CGD, Santander, Inter
            e C6
          </span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>

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
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Lançamentos Registrados ({totalItems})
            </CardTitle>
            <CardDescription className="text-xs">
              Histórico consolidado com categorias e método de inserção
            </CardDescription>
          </div>

          {/* Batch Action Bar */}
          {selectedTxIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs animate-in fade-in slide-in-from-top-1">
              <span className="font-semibold text-slate-700">
                {selectedTxIds.length} selecionado{selectedTxIds.length > 1 ? 's' : ''}
              </span>
              <div className="h-4 w-px bg-slate-300 mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenBatchRelocate}
                disabled={isDeletingBatch || isRelocatingBatch}
                className="h-7 px-2.5 text-xs font-semibold gap-1.5 bg-white border-blue-200 text-blue-700 hover:bg-blue-50 shadow-2xs"
                title="Mudar o mês de competência das transações selecionadas (ex: mover compras de agosto para setembro)"
              >
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                Realocar para o mês...
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteBatch}
                disabled={isDeletingBatch || isRelocatingBatch}
                className="h-7 px-2.5 text-xs font-semibold gap-1.5 shadow-2xs"
              >
                {isDeletingBatch ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Excluir selecionados
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                disabled={isDeletingBatch || isRelocatingBatch}
                className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 gap-1"
                title="Limpar seleção"
              >
                <X className="h-3.5 w-3.5" />
                Limpar
              </Button>
            </div>
          )}
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
                    <th className="py-3 px-3 w-10 text-center">
                      <Checkbox
                        checked={
                          areAllVisibleSelected
                            ? true
                            : isSomeVisibleSelected
                              ? 'indeterminate'
                              : false
                        }
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="Selecionar todos os lançamentos visíveis"
                        className="translate-y-[1px]"
                      />
                    </th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Origem</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const isSelected = selectedTxIds.includes(tx.id)
                    return (
                      <tr
                        key={tx.id}
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isSelected ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelectTx(tx.id)}
                            aria-label={`Selecionar ${tx.description}`}
                            className="translate-y-[1px]"
                          />
                        </td>
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
                    )
                  })}
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

          {/* Banner específico para importação de PDF com seletor de moeda */}
          {importFileType === 'pdf' && pdfMeta && (
            <div className="p-3 bg-blue-50/80 rounded-lg border border-blue-200 text-xs text-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  Arquivo: <strong>{pdfMeta.fileName}</strong> ({pdfMeta.totalPages} página(s))
                  {pdfMeta.year && ` • Ano: ${pdfMeta.year}`}
                  {pdfMeta.detectedPeriodLabel && (
                    <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-blue-100 text-blue-800 font-medium">
                      Período: {pdfMeta.detectedPeriodLabel}
                    </span>
                  )}
                  {pdfMeta.detectedDueDate && (
                    <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-medium">
                      Vencimento: {pdfMeta.detectedDueDate}
                    </span>
                  )}
                </span>
                <div className="inline-flex items-center gap-1.5 ml-2 bg-white px-2 py-1 rounded-md border border-slate-300">
                  <span className="text-[11px] font-semibold text-slate-700">Moeda:</span>
                  <div className="inline-flex rounded border border-slate-200 bg-slate-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => handlePdfCurrencyChange('EUR')}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                        amountCurrency === 'EUR'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Valores em Euro: serão convertidos para Real pela taxa média do mês"
                    >
                      € EUR
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePdfCurrencyChange('BRL')}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                        amountCurrency === 'BRL'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Valores em Reais: salvos sem conversão cambial"
                    >
                      R$ BRL
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
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

          {/* Seletor de Competência da Fatura / Modo de Datação */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="font-semibold text-slate-800 text-xs">
                  Competência dos Lançamentos (Mês da Fatura)
                </span>
                {pdfMeta?.isCreditCardInvoice && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px] py-0">
                    Fatura de Cartão Detectada
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Evita que compras do início do ciclo caiam no mês anterior já encerrado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Opção B: Atribuir todos ao mês da fatura (recomendada) */}
              <div
                onClick={() => handleDateModeChange('competence')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  dateMode === 'competence'
                    ? 'bg-blue-50/70 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="dateMode"
                    id="dateModeCompetence"
                    checked={dateMode === 'competence'}
                    onChange={() => handleDateModeChange('competence')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="dateModeCompetence"
                      className="font-semibold text-slate-900 cursor-pointer block text-xs"
                    >
                      Considerar todos os gastos no mês de competência da fatura (Recomendado)
                    </label>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Compras feitas no fim do mês anterior (ex: 31 AGO numa fatura fechada em SET)
                      serão contabilizadas integralmente no orçamento do mês da fatura.
                    </p>

                    {dateMode === 'competence' && (
                      <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-blue-100">
                        <Label
                          htmlFor="competenceSelect"
                          className="text-[11px] font-semibold text-blue-900 whitespace-nowrap"
                        >
                          Mês da fatura:
                        </Label>
                        <Select
                          value={competenceMonth}
                          onValueChange={(val) => handleCompetenceMonthChange(val)}
                        >
                          <SelectTrigger
                            id="competenceSelect"
                            className="h-7 text-xs bg-white border-blue-300 w-44"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMonths.map((m) => (
                              <SelectItem key={m} value={m}>
                                {formatMonthShort(m)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-[10px] text-blue-700 font-medium">
                          {previewList.length} lançamento(s) em {formatMonthShort(competenceMonth)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Opção A: Data original de cada compra */}
              <div
                onClick={() => handleDateModeChange('original')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  dateMode === 'original'
                    ? 'bg-blue-50/70 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="dateMode"
                    id="dateModeOriginal"
                    checked={dateMode === 'original'}
                    onChange={() => handleDateModeChange('original')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="dateModeOriginal"
                      className="font-semibold text-slate-900 cursor-pointer block text-xs"
                    >
                      Datar pela data original de cada transação
                    </label>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Cada gasto cai no dia exato em que ocorreu. Se o ciclo começou no mês
                      anterior, essas saídas cairão no mês passado.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Banner de alerta caso preview contenha anomalias ou dados binários */}
          {previewSanityAlert && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Aviso de formato ou compatibilidade:</span>
                <p>{previewSanityAlert.message}</p>
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
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-600">
                    Coluna de Valor
                  </Label>
                  <div className="inline-flex rounded border border-slate-300 bg-white p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => {
                        setAmountCurrency('EUR')
                        handleApplyMapping('EUR')
                      }}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                        amountCurrency === 'EUR'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Moeda de origem: Euro (€). Converterá para R$ pela taxa do mês."
                    >
                      €
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAmountCurrency('BRL')
                        handleApplyMapping('BRL')
                      }}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                        amountCurrency === 'BRL'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Moeda de origem: Real (R$). Grava sem conversão cambial."
                    >
                      R$
                    </button>
                  </div>
                </div>
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
                <p className="text-[10px] text-slate-500 mt-1">
                  Moeda:{' '}
                  <strong>
                    {amountCurrency === 'EUR' ? '€ Euro (converte)' : 'R$ Real (direto)'}
                  </strong>
                </p>
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
                    <SelectItem value="none">Auto-identificar por palavras-chave</SelectItem>
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
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md max-h-[50vh]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 sticky top-0 font-semibold text-slate-700 z-10 shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3 w-8 text-center">
                    <span className="sr-only">Selecionar</span>
                  </th>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3 min-w-[280px]">Categoria</th>
                  <th className="py-2.5 px-2 text-center w-24">Moeda</th>
                  <th className="py-2.5 px-3 text-right">Valor Final (R$ BRL)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewList.map((row, idx) => {
                  const isChecked = row.selected !== false
                  const rowCurr = row.originalCurrency || amountCurrency

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !isChecked ? 'opacity-40 bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
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
                      <td className="py-2.5 px-3 whitespace-nowrap tabular-nums font-medium text-slate-900">
                        {row.date.split('-').reverse().join('/')}
                      </td>
                      <td className="py-2.5 px-3 max-w-[220px]">
                        <div
                          className="truncate font-medium text-slate-800"
                          title={row.description}
                        >
                          {row.description}
                        </div>
                      </td>

                      {/* Coluna de Categoria com Combobox pesquisável */}
                      <td className="py-2.5 px-3">
                        <div className="w-full max-w-[270px]">
                          <CategorySelectCombobox
                            categories={categories}
                            value={row.category || 'none'}
                            onChange={(val) => {
                              const updated = [...previewList]
                              const chosen = val === 'none' ? undefined : val
                              updated[idx].category = chosen
                              setPreviewList(updated)
                            }}
                            triggerClassName="h-7 text-xs"
                            placeholder="Selecione a categoria..."
                            searchPlaceholder="Buscar categoria ou subcategoria..."
                            emptyText="Nenhuma categoria encontrada."
                            specialOption={{ id: 'none', label: 'Não Categorizado' }}
                          />
                        </div>
                      </td>

                      {/* Seletor individual de moeda da linha */}
                      <td className="py-2.5 px-2 text-center">
                        <div className="inline-flex rounded border border-slate-300 bg-white p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...previewList]
                              const raw =
                                row.originalAmount !== undefined ? row.originalAmount : row.amount
                              const rateUsed = getRateForMonth(row.month, exchangeRates)
                              const finalBrl = Math.round(raw * rateUsed * 100) / 100
                              updated[idx] = {
                                ...row,
                                amount: finalBrl,
                                originalAmount: raw,
                                originalCurrency: 'EUR',
                              }
                              setPreviewList(updated)
                            }}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              rowCurr === 'EUR'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Declarar este item em Euro (€)"
                          >
                            €
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...previewList]
                              const raw =
                                row.originalAmount !== undefined ? row.originalAmount : row.amount
                              updated[idx] = {
                                ...row,
                                amount: raw,
                                originalAmount: raw,
                                originalCurrency: 'BRL',
                              }
                              setPreviewList(updated)
                            }}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              rowCurr === 'BRL'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Declarar este item em Reais (R$)"
                          >
                            R$
                          </button>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        <div>
                          <span>{formatCurrency(row.amount, 'BRL')}</span>
                          {rowCurr === 'EUR' && row.originalAmount !== undefined ? (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              (orig: € {row.originalAmount.toFixed(2)})
                            </span>
                          ) : (
                            <span className="block text-[10px] text-emerald-600 font-normal">
                              (orig: R${' '}
                              {row.originalAmount !== undefined
                                ? row.originalAmount.toFixed(2)
                                : row.amount.toFixed(2)}
                              )
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

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 pt-2 border-t">
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
                disabled={
                  isImporting ||
                  previewSanityAlert?.isCorrupted ||
                  previewList.filter((it) => it.selected !== false).length === 0
                }
                className="bg-blue-600 hover:bg-blue-700 font-semibold shadow-xs"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Gravando lançamentos...
                  </>
                ) : (
                  'Importar Lançamentos'
                )}
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

      {/* REALOCAR COMPETÊNCIA EM LOTE MODAL */}
      <Dialog open={showBatchMonthModal} onOpenChange={setShowBatchMonthModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Realocar Competência em Lote
            </DialogTitle>
            <DialogDescription>
              Altere o mês de competência dos {selectedTxIds.length} lançamento(s) selecionados.
              Útil para corrigir compras importadas na data original que deveriam pertencer à fatura
              do mês seguinte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="target-batch-month" className="text-xs font-semibold text-slate-700">
                Novo Mês de Competência
              </Label>
              <Select value={batchTargetMonth} onValueChange={setBatchTargetMonth}>
                <SelectTrigger id="target-batch-month" className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonthShort(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <Checkbox
                id="adjust-batch-dates"
                checked={batchAdjustDates}
                onCheckedChange={(checked) => setBatchAdjustDates(checked === true)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor="adjust-batch-dates"
                  className="text-xs font-semibold text-slate-800 cursor-pointer block"
                >
                  Ajustar a data dos registros para o novo mês
                </Label>
                <p className="text-[11px] text-slate-500">
                  Mantém o dia da compra (ex: dia 31 vira 30 em setembro) e atualiza o ano/mês para
                  que filtros por data e relatórios fiquem 100% alinhados no mês escolhido.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBatchMonthModal(false)}
              disabled={isRelocatingBatch}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmBatchRelocate}
              disabled={isRelocatingBatch}
              className="bg-blue-600 hover:bg-blue-700 font-semibold gap-1.5 shadow-xs"
            >
              {isRelocatingBatch ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Realocando...
                </>
              ) : (
                `Mover para ${formatMonthShort(batchTargetMonth)}`
              )}
            </Button>
          </DialogFooter>
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
