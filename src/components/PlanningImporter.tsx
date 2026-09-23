import React, { useState, useRef, useEffect } from 'react'
import {
  PlanningParsedData,
  PlanningSection,
  PlanningItem,
  parsePlanningMarkdown,
} from '@/lib/planningParser'
import { convertSheetToMarkdown, importPlanningData } from '@/services/financeService'
import { formatCurrency, formatMonthShort } from '@/lib/formatters'
import { getExchangeRates, getRateForMonth, convertEurToBrl } from '@/services/financeService'
import { ExchangeRate } from '@/types/finance'
import { useToast } from '@/hooks/use-toast'
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Info,
  Check,
  AlertTriangle,
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
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

interface PlanningImporterProps {
  onSuccess: () => void
  onNavigateToBudgetVsActual: () => void
  onNavigateToOverview: () => void
}

export default function PlanningImporter({
  onSuccess,
  onNavigateToBudgetVsActual,
  onNavigateToOverview,
}: PlanningImporterProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [parsedData, setParsedData] = useState<PlanningParsedData | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // Configuration in preview
  const [importYear, setImportYear] = useState<number>(2026)
  const [importCurrency, setImportCurrency] = useState<'EUR' | 'BRL'>('EUR') // padrão EUR conforme especificação
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true) // default: substituir
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  // Success summary modal
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [importSummary, setImportSummary] = useState<{
    mainCategoriesCreated: number
    subCategoriesCreated: number
    categoriesUpdated: number
    transactionsCreated: number
    transactionsDeleted: number
    year: number
  } | null>(null)

  // Load exchange rates when mounting
  useEffect(() => {
    getExchangeRates().then(setExchangeRates).catch(console.error)
  }, [])

  // Toggle section expansion in preview
  const toggleSection = (secName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [secName]: !prev[secName],
    }))
  }

  // Handle file selection (drag-and-drop or click)
  const handleFile = async (file: File) => {
    if (!file) return

    try {
      setIsUploading(true)

      let markdown = ''
      const lowerName = file.name.toLowerCase()
      let isXlsx =
        lowerName.endsWith('.xlsx') ||
        lowerName.endsWith('.xls') ||
        lowerName.endsWith('.xlsm') ||
        lowerName.endsWith('.xlsb') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel')

      // Also check magic bytes (ZIP signature PK\x03\x04)
      if (!isXlsx) {
        try {
          const slice = file.slice(0, 16)
          const buf = await slice.arrayBuffer()
          const bytes = new Uint8Array(buf)
          if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
            isXlsx = true
          }
        } catch {
          // ignore
        }
      }

      if (isXlsx) {
        // Send to backend $documents.toMarkdown
        markdown = await convertSheetToMarkdown(file)
      } else {
        // CSV or TXT file can be read as text directly
        markdown = await file.text()
        // If content is actually binary / PK ZIP signature, re-route to XLSX backend converter
        if (
          markdown.includes('xl/') ||
          markdown.includes('[Content_Types]') ||
          (markdown.charCodeAt(0) === 0x50 && markdown.charCodeAt(1) === 0x4b)
        ) {
          markdown = await convertSheetToMarkdown(file)
        }
      }

      const parsed = parsePlanningMarkdown(markdown)

      if (parsed.sections.length === 0 || parsed.totalTransactionsCount === 0) {
        toast({
          title: 'Planilha não reconhecida ou vazia',
          description:
            'Não foram identificadas seções em maiúsculas ou colunas mensais (Jan-Ago) no layout esperado.',
          variant: 'destructive',
        })
        return
      }

      setParsedData(parsed)
      // Expand first 2 sections by default
      const initialExp: Record<string, boolean> = {}
      parsed.sections.slice(0, 3).forEach((s) => {
        initialExp[s.name] = true
      })
      setExpandedSections(initialExp)
      setShowPreviewModal(true)
    } catch (err: any) {
      console.error('Erro ao ler planilha de planejamento:', err)
      toast({
        title: 'Erro ao processar planilha',
        description:
          err.message ||
          'Verifique se o arquivo possui a aba "Plano Financeiro" e formato XLSX válido.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  // Execute import
  const handleConfirmImport = async () => {
    if (!parsedData) return

    try {
      setIsImporting(true)

      const monthsToImport = parsedData.detectedMonths.map((m) => m.index)

      const result = await importPlanningData({
        year: importYear,
        sections: parsedData.sections,
        replaceExisting,
        monthsToImport,
        rates: exchangeRates,
        currencyMode: importCurrency,
      })

      setImportSummary({
        ...result,
        year: importYear,
      })

      setShowPreviewModal(false)
      setShowSuccessModal(true)
      onSuccess()

      toast({
        title: 'Planejamento importado com sucesso!',
        description: `${result.transactionsCreated} lançamentos históricos criados para ${importYear}.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar planejamento:', err)
      toast({
        title: 'Falha na gravação dos dados',
        description: err.message || 'Ocorreu um erro ao persistir categorias ou transações.',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Zone for Planning Sheet */}
      <div
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files?.[0]
          if (file) handleFile(file)
        }}
        className={`group relative cursor-pointer rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/20 p-8 text-center transition-all hover:border-emerald-500 hover:bg-emerald-50/40 ${
          isUploading ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-bold text-slate-900">
          {isUploading
            ? 'Processando planilha de planejamento...'
            : 'Clique ou arraste sua planilha de planejamento (XLSX / CSV)'}
        </h3>
        <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
          Reconhece o layout de seções (MORADIA, CUIDADOS PESSOAIS, etc.), subcategorias com
          estimado e valores mensais realizados de <strong>Janeiro a Agosto</strong>.
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          Valores em Euros (€) convertidos para R$ pela taxa média de cada mês
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Info Card explaining how the planning import works */}
      <Card className="border-slate-200 bg-slate-50/60 shadow-xs">
        <CardContent className="p-4 flex items-start gap-3 text-xs text-slate-600">
          <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">
              Como funciona a importação do histórico de planejamento:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
              <li>
                <strong>Categorias & Subcategorias:</strong> vincula automaticamente cada linha à
                categoria principal correspondente e atualiza a coluna de orçamento estimado.
              </li>
              <li>
                <strong>Lançamentos Históricos:</strong> gera transações mensais (YYYY-MM-01) para
                cada valor realizado preenchido entre Jan e Ago.
              </li>
              <li>
                <strong>Câmbio por Mês:</strong> cada mês usa sua taxa de câmbio mensal
                correspondente (ex: Jan 2026 usa a taxa de Jan/2026, Fev/2026 usa a taxa de
                Fev/2026).
              </li>
              <li>
                <strong>Idempotência:</strong> você pode optar por substituir importações anteriores
                desses mesmos meses ou somar a novos registros.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* PREVIEW & CONFIRMATION MODAL */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Pré-visualização: Planilha de Planejamento Mensal
            </DialogTitle>
            <DialogDescription className="text-xs">
              Revise as seções, subcategorias e meses detectados antes de salvar no Skip Cloud.
            </DialogDescription>
          </DialogHeader>

          {parsedData && (
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Year & Replacement & Currency Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <Label htmlFor="plan-year" className="text-xs font-semibold text-slate-700">
                    Ano de Referência dos Meses (Padrão: 2026)
                  </Label>
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    Os meses Jan–Ago serão gravados como {importYear}-01 até {importYear}-08.
                  </p>
                  <Input
                    id="plan-year"
                    type="number"
                    min={2020}
                    max={2035}
                    value={importYear}
                    onChange={(e) => setImportYear(parseInt(e.target.value, 10) || 2026)}
                    className="h-8 text-xs w-32"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Moeda dos Valores Realizados
                  </Label>
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    {importCurrency === 'EUR'
                      ? 'Valores em € convertidos pela taxa de cada mês.'
                      : 'Valores em R$ gravados diretamente, sem conversão.'}
                  </p>
                  <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setImportCurrency('EUR')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        importCurrency === 'EUR'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      € Euro (EUR)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportCurrency('BRL')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        importCurrency === 'BRL'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      R$ Real (BRL)
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Idempotência (Lançamentos)
                  </Label>
                  <RadioGroup
                    value={replaceExisting ? 'replace' : 'keep'}
                    onValueChange={(v) => setReplaceExisting(v === 'replace')}
                    className="space-y-1.5 mt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="replace" id="r-replace" />
                      <Label
                        htmlFor="r-replace"
                        className="text-xs font-normal text-slate-800 cursor-pointer"
                      >
                        <strong>Substituir</strong> anteriores
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="keep" id="r-keep" />
                      <Label
                        htmlFor="r-keep"
                        className="text-xs font-normal text-slate-800 cursor-pointer"
                      >
                        <strong>Manter</strong> existentes
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                    Seções Detectadas
                  </span>
                  <span className="font-bold text-emerald-800 text-base">
                    {parsedData.sections.length}
                  </span>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                    Subcategorias
                  </span>
                  <span className="font-bold text-blue-800 text-base">
                    {parsedData.totalItemsCount}
                  </span>
                </div>
                <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-100">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                    Lançamentos (Valores &gt; 0)
                  </span>
                  <span className="font-bold text-indigo-800 text-base">
                    {parsedData.totalTransactionsCount}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                    Meses Identificados
                  </span>
                  <span className="font-bold text-slate-800 text-xs">
                    {parsedData.detectedMonths.map((m) => m.name).join(', ')}
                  </span>
                </div>
              </div>

              {/* Sections Breakdown Accordion */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                <div className="bg-slate-50 p-2.5 text-[11px] font-semibold text-slate-600 flex justify-between items-center">
                  <span>Estrutura de Categorias e Lançamentos Identificados</span>
                  <span className="text-slate-400 font-normal">
                    Clique na seção para expandir/recolher
                  </span>
                </div>

                {parsedData.sections.map((section) => {
                  const isExp = !!expandedSections[section.name]
                  const sectionEstimatedTotal = section.items.reduce(
                    (acc, it) => acc + (it.estimated || 0),
                    0,
                  )
                  const sectionTxCount = section.items.reduce(
                    (acc, it) => acc + Object.keys(it.monthlyValues).length,
                    0,
                  )

                  return (
                    <div key={section.name} className="overflow-hidden">
                      <div
                        onClick={() => toggleSection(section.name)}
                        className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-100/60 cursor-pointer select-none transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <button className="text-slate-400">
                            {isExp ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <span className="font-bold text-slate-900 text-xs tracking-wide">
                            {section.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-slate-200 text-slate-700 py-0"
                          >
                            {section.items.length} subitens
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-slate-500 text-[11px]">
                            Estimado:{' '}
                            <strong>{formatCurrency(sectionEstimatedTotal, 'EUR')}</strong>
                          </span>
                          <span className="text-emerald-700 font-semibold text-[11px]">
                            {sectionTxCount} valores
                          </span>
                        </div>
                      </div>

                      {isExp && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100/70 text-[10px] uppercase font-semibold text-slate-600">
                              <tr>
                                <th className="py-2 px-3 pl-8">Subcategoria</th>
                                <th className="py-2 px-3">Grupo (Col C)</th>
                                <th className="py-2 px-3 text-right">Estimado (Col D)</th>
                                {parsedData.detectedMonths.map((m) => (
                                  <th key={m.index} className="py-2 px-2 text-center">
                                    {m.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px]">
                              {section.items.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                  <td className="py-2 px-3 pl-8 font-medium text-slate-800">
                                    {item.name}
                                  </td>
                                  <td className="py-2 px-3 text-slate-500">
                                    {item.subgroup ? (
                                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                        {item.subgroup}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right font-medium text-slate-700 tabular-nums">
                                    {item.estimated > 0
                                      ? formatCurrency(item.estimated, 'EUR')
                                      : '—'}
                                  </td>
                                  {parsedData.detectedMonths.map((m) => {
                                    const val = item.monthlyValues[String(m.index)]
                                    const mStr = `${importYear}-${String(m.index).padStart(2, '0')}`
                                    const mRate = getRateForMonth(mStr, exchangeRates)
                                    return (
                                      <td
                                        key={m.index}
                                        className={`py-2 px-2 text-center tabular-nums ${
                                          val > 0
                                            ? 'font-bold text-slate-900 bg-emerald-50/40'
                                            : 'text-slate-300'
                                        }`}
                                        title={
                                          val > 0
                                            ? `€ ${val} × R$ ${mRate.toFixed(2)} = R$ ${(val * mRate).toFixed(2)}`
                                            : undefined
                                        }
                                      >
                                        {val > 0 ? (
                                          <div>
                                            <div>{formatCurrency(val, 'EUR')}</div>
                                            <div className="text-[9px] text-slate-500 font-normal">
                                              ≈ R${' '}
                                              {(val * mRate).toLocaleString('pt-BR', {
                                                maximumFractionDigits: 0,
                                              })}
                                            </div>
                                          </div>
                                        ) : (
                                          '—'
                                        )}
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between mt-3 pt-2 border-t">
            <span className="text-xs text-slate-500">
              Pronto para importar <strong>{parsedData?.totalTransactionsCount}</strong> lançamentos
              em <strong>{parsedData?.sections.length}</strong> categorias.
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreviewModal(false)}
                disabled={isImporting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="bg-emerald-600 hover:bg-emerald-700 font-semibold"
              >
                {isImporting ? 'Gravando no banco...' : 'Confirmar e Importar Histórico'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SUCCESS MODAL / INVITE TO BUDGET VS ACTUAL */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <DialogTitle className="text-lg font-bold text-slate-900">
            Histórico Importado com Sucesso!
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600">
            Os dados da sua planilha foram integrados com sucesso às coleções do Skip Cloud.
          </DialogDescription>

          {importSummary && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1.5 my-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Categorias Principais:</span>
                <span className="font-semibold text-slate-800">
                  {importSummary.mainCategoriesCreated} criadas
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Subcategorias:</span>
                <span className="font-semibold text-slate-800">
                  {importSummary.subCategoriesCreated} criadas / {importSummary.categoriesUpdated}{' '}
                  atualizadas
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lançamentos Históricos:</span>
                <span className="font-bold text-emerald-700">
                  {importSummary.transactionsCreated} transações criadas
                </span>
              </div>
              {importSummary.transactionsDeleted > 0 && (
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Substituídas anteriores:</span>
                  <span>{importSummary.transactionsDeleted} transações</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Button
              onClick={() => {
                setShowSuccessModal(false)
                onNavigateToBudgetVsActual()
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
            >
              Ver na Matriz Orçado vs Realizado
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setShowSuccessModal(false)
                onNavigateToOverview()
              }}
              className="w-full border-slate-300"
            >
              Ir para Visão Geral
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
