import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/financeService'
import { Category } from '@/types/finance'
import { formatCurrency } from '@/lib/formatters'
import { parseAmount } from '@/lib/fileParser'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Edit2,
  Trash2,
  FolderTree,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  Tag,
  DollarSign,
  Palette,
  Home,
  Heart,
  Car,
  Coffee,
  BookOpen,
  Layers,
  FileText,
  CreditCard,
  Briefcase,
  Gift,
  PlusCircle,
  TrendingUp,
  ArrowLeftRight,
  GripVertical,
  CornerDownRight,
  MoveRight,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategorySelectCombobox } from '@/components/CategorySelectCombobox'

export default function CategoriesView() {
  const { user, currency } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Add category / subcategory modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalType, setModalType] = useState<'main' | 'sub'>('main')
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('none')
  const [estimated, setEstimated] = useState('')
  const [color, setColor] = useState('#2563EB')
  const [saving, setSaving] = useState(false)

  // Edit inline modal
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [editEstimated, setEditEstimated] = useState('')
  const [editColor, setEditColor] = useState('#2563EB')
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete modal
  const [deletingCat, setDeletingCat] = useState<Category | null>(null)
  const [reassignTo, setReassignTo] = useState<string>('none')
  const [deleting, setDeleting] = useState(false)

  // Move subcategory modal (Mobile / Accessibility / Menu)
  const [movingSubCategory, setMovingSubCategory] = useState<Category | null>(null)
  const [targetParentId, setTargetParentId] = useState<string>('')
  const [moving, setMoving] = useState(false)

  // Drag & drop state
  const [draggedSubId, setDraggedSubId] = useState<string | null>(null)
  const [dragOverMainId, setDragOverMainId] = useState<string | null>(null)
  const [dragOverSubId, setDragOverSubId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const cats = await getCategories()
      setCategories(cats)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  useRealtime('categories', () => loadData())

  const mainCategories = categories.filter((c) => c.type === 'main')
  const subCategories = categories.filter((c) => c.type === 'sub')

  const getSubcategories = (mainId: string) => {
    return subCategories.filter((sc) => sc.parent === mainId)
  }

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Open add modal
  const handleOpenAdd = (type: 'main' | 'sub', defaultParentId?: string) => {
    setModalType(type)
    setName('')
    setParentId(defaultParentId || (mainCategories[0]?.id ?? 'none'))
    setEstimated('')
    setColor(type === 'main' ? '#2563EB' : '#64748B')
    setShowAddModal(true)
  }

  // Submit Add
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setSaving(true)
      const estNum = parseAmount(estimated)

      await createCategory({
        name: name.trim(),
        type: modalType,
        parent: modalType === 'sub' && parentId !== 'none' ? parentId : undefined,
        estimated: estNum || 0,
        color: modalType === 'main' ? color : undefined,
      })

      toast({ title: 'Categoria cadastrada com sucesso!' })
      setShowAddModal(false)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao cadastrar categoria', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Open Edit
  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat)
    setEditName(cat.name)
    setEditEstimated(cat.estimated ? String(cat.estimated) : '')
    setEditColor(cat.color || '#2563EB')
  }

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory || !editName.trim()) return

    try {
      setSavingEdit(true)
      const estNum = parseAmount(editEstimated)

      await updateCategory(editingCategory.id, {
        name: editName.trim(),
        estimated: estNum || 0,
        color: editingCategory.type === 'main' ? editColor : undefined,
      })

      toast({ title: 'Categoria atualizada com sucesso!' })
      setEditingCategory(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao atualizar categoria', variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  // Move subcategory function (used by both Drag & Drop and Move Dialog)
  const handleMoveSubCategory = async (subCatId: string, newParentId: string) => {
    const subToMove = categories.find((c) => c.id === subCatId)
    if (!subToMove || subToMove.parent === newParentId) {
      return
    }

    const targetParent = categories.find((c) => c.id === newParentId && c.type === 'main')
    if (!targetParent) {
      toast({ title: 'Categoria de destino inválida', variant: 'destructive' })
      return
    }

    // Optimistic UI update
    const previousCategories = [...categories]
    setCategories((prev) =>
      prev.map((c) =>
        c.id === subCatId ? { ...c, parent: newParentId, color: targetParent.color || c.color } : c,
      ),
    )

    // Automatically expand target parent so user sees the moved item immediately
    setCollapsed((prev) => ({ ...prev, [newParentId]: false }))

    try {
      await updateCategory(subCatId, {
        parent: newParentId,
        color: targetParent.color || undefined,
      })

      toast({
        title: `Subcategoria movida!`,
        description: `"${subToMove.name}" agora pertence a "${targetParent.name}".`,
      })
    } catch (err) {
      console.error('Erro ao mover subcategoria:', err)
      // Rollback optimistic update
      setCategories(previousCategories)
      toast({
        title: 'Erro ao mover subcategoria',
        description: 'Não foi possível atualizar no servidor.',
        variant: 'destructive',
      })
    }
  }

  // Open Move Dialog (Modal / Mobile / Accessibility)
  const handleOpenMove = (sub: Category) => {
    setMovingSubCategory(sub)
    // Find first other main category as default
    const currentParentId = sub.parent
    const otherMain = mainCategories.find((m) => m.id !== currentParentId)
    setTargetParentId(otherMain ? otherMain.id : '')
  }

  const handleConfirmMove = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!movingSubCategory || !targetParentId) return

    setMoving(true)
    try {
      await handleMoveSubCategory(movingSubCategory.id, targetParentId)
      setMovingSubCategory(null)
    } finally {
      setMoving(false)
    }
  }

  // Reorder or move subcategory relative to another subcategory
  const handleReorderSubCategory = async (
    sourceSubId: string,
    targetSubId: string,
    position: 'above' | 'below',
  ) => {
    if (sourceSubId === targetSubId) return

    const source = categories.find((c) => c.id === sourceSubId)
    const target = categories.find((c) => c.id === targetSubId)
    if (!source || !target || !target.parent) return

    const targetParent = categories.find((c) => c.id === target.parent && c.type === 'main')
    const needsParentChange = source.parent !== target.parent

    // Reorder in local state
    const previousCategories = [...categories]
    setCategories((prev) => {
      // Remove source from current position
      const withoutSource = prev.filter((c) => c.id !== sourceSubId)
      // Updated source item
      const updatedSource: Category = {
        ...source,
        parent: target.parent,
        color: targetParent?.color || source.color,
      }

      const targetIndex = withoutSource.findIndex((c) => c.id === targetSubId)
      if (targetIndex === -1) return prev

      const insertIndex = position === 'above' ? targetIndex : targetIndex + 1
      const nextList = [...withoutSource]
      nextList.splice(insertIndex, 0, updatedSource)
      return nextList
    })

    // If target parent was different, update in backend
    if (needsParentChange) {
      try {
        await updateCategory(sourceSubId, {
          parent: target.parent,
          color: targetParent?.color || undefined,
        })
        toast({
          title: 'Subcategoria movida!',
          description: targetParent
            ? `"${source.name}" agora pertence a "${targetParent.name}".`
            : undefined,
        })
      } catch (err) {
        console.error('Erro ao reordenar subcategoria:', err)
        setCategories(previousCategories)
        toast({
          title: 'Erro ao mover subcategoria',
          variant: 'destructive',
        })
      }
    }
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, sub: Category) => {
    e.dataTransfer.setData('text/plain', sub.id)
    e.dataTransfer.setData('application/json', JSON.stringify({ id: sub.id, parent: sub.parent }))
    e.dataTransfer.effectAllowed = 'move'
    setDraggedSubId(sub.id)
  }

  const handleDragEnd = () => {
    setDraggedSubId(null)
    setDragOverMainId(null)
    setDragOverSubId(null)
    setDropPosition(null)
  }

  const handleDragOverMain = (e: React.DragEvent, mainId: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverMainId !== mainId) {
      setDragOverMainId(mainId)
    }
  }

  const handleDragLeaveMain = (e: React.DragEvent, mainId: string) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear if actually leaving the card
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return
    }
    if (dragOverMainId === mainId) {
      setDragOverMainId(null)
    }
  }

  const handleDropOnMain = async (e: React.DragEvent, targetMainId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverMainId(null)
    setDragOverSubId(null)
    setDropPosition(null)

    const subId = e.dataTransfer.getData('text/plain') || draggedSubId
    setDraggedSubId(null)

    if (!subId) return
    await handleMoveSubCategory(subId, targetMainId)
  }

  const handleDragOverSub = (e: React.DragEvent, sub: Category) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'

    // Don't show drop indicator on self
    if (draggedSubId === sub.id) return

    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const pos = e.clientY < midY ? 'above' : 'below'

    if (dragOverSubId !== sub.id || dropPosition !== pos) {
      setDragOverSubId(sub.id)
      setDropPosition(pos)
    }
  }

  const handleDragLeaveSub = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOverSubId(null)
    setDropPosition(null)
  }

  const handleDropOnSub = async (e: React.DragEvent, targetSub: Category) => {
    e.preventDefault()
    e.stopPropagation()

    const sourceSubId = e.dataTransfer.getData('text/plain') || draggedSubId
    const pos = dropPosition || 'below'

    setDragOverMainId(null)
    setDragOverSubId(null)
    setDropPosition(null)
    setDraggedSubId(null)

    if (!sourceSubId || sourceSubId === targetSub.id) return
    await handleReorderSubCategory(sourceSubId, targetSub.id, pos)
  }

  // Open Delete dialog
  const handleOpenDelete = (cat: Category) => {
    setDeletingCat(cat)
    // Find "Não Categorizado" or fallback to 'none'
    const uncategorized = categories.find(
      (c) => c.name.toLowerCase().includes('não categorizado') && c.id !== cat.id,
    )
    setReassignTo(uncategorized ? uncategorized.id : 'none')
  }

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingCat) return

    try {
      setDeleting(true)
      await deleteCategory(deletingCat.id, reassignTo !== 'none' ? reassignTo : undefined)

      toast({ title: 'Categoria removida com sucesso.' })
      setDeletingCat(null)
      loadData()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao excluir categoria', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Taxonomia de Categorias
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Estrutura de 2 níveis com orçamentos mensais estimados. Totalmente editável e
            personalizável.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/cambio')}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <ArrowLeftRight className="mr-2 h-4 w-4 text-blue-600" />
            Tabela de Câmbio
          </Button>

          <Button
            variant="outline"
            onClick={() => handleOpenAdd('sub')}
            className="border-slate-300 hover:bg-slate-100"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Subcategoria
          </Button>

          <Button
            onClick={() => handleOpenAdd('main')}
            className="bg-blue-600 hover:bg-blue-700 font-semibold shadow-xs"
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            Nova Categoria Principal
          </Button>
        </div>
      </div>

      {/* Categories Tree Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-blue-600" />
              Árvore de Categorias ({mainCategories.length} principais, {subCategories.length}{' '}
              subcategorias)
            </CardTitle>
            <CardDescription className="text-xs">
              Organize seus centros de custo e defina os orçamentos mensais de referência
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Carregando taxonomia...</div>
          ) : mainCategories.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Nenhuma categoria cadastrada.
            </div>
          ) : (
            mainCategories.map((main) => {
              const subs = getSubcategories(main.id)
              const isCollapsed = !!collapsed[main.id]

              const isDropTarget = dragOverMainId === main.id
              const isCurrentParentOfDragged =
                draggedSubId && subs.some((s) => s.id === draggedSubId)

              return (
                <div
                  key={main.id}
                  onDragOver={(e) => handleDragOverMain(e, main.id)}
                  onDragLeave={(e) => handleDragLeaveMain(e, main.id)}
                  onDrop={(e) => handleDropOnMain(e, main.id)}
                  className={`rounded-xl border transition-all duration-150 overflow-hidden shadow-2xs ${
                    isDropTarget
                      ? 'border-blue-500 ring-2 ring-blue-400/50 bg-blue-50/30'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Main Category Row */}
                  <div
                    className={`flex items-center justify-between p-3.5 transition-colors ${
                      isDropTarget ? 'bg-blue-100/60' : 'bg-slate-50/70 hover:bg-slate-100/60'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2.5 cursor-pointer select-none min-w-0"
                      onClick={() => toggleCollapse(main.id)}
                    >
                      <button
                        type="button"
                        aria-label={isCollapsed ? 'Expandir categoria' : 'Recolher categoria'}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      <div
                        className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 shadow-2xs text-white"
                        style={{ backgroundColor: main.color || '#2563EB' }}
                      >
                        {main.icon === 'Home' && <Home className="h-3.5 w-3.5" />}
                        {main.icon === 'Heart' && <Heart className="h-3.5 w-3.5" />}
                        {main.icon === 'Car' && <Car className="h-3.5 w-3.5" />}
                        {main.icon === 'Coffee' && <Coffee className="h-3.5 w-3.5" />}
                        {main.icon === 'BookOpen' && <BookOpen className="h-3.5 w-3.5" />}
                        {main.icon === 'Layers' && <Layers className="h-3.5 w-3.5" />}
                        {main.icon === 'FileText' && <FileText className="h-3.5 w-3.5" />}
                        {main.icon === 'CreditCard' && <CreditCard className="h-3.5 w-3.5" />}
                        {main.icon === 'Briefcase' && <Briefcase className="h-3.5 w-3.5" />}
                        {main.icon === 'Gift' && <Gift className="h-3.5 w-3.5" />}
                        {main.icon === 'PlusCircle' && <PlusCircle className="h-3.5 w-3.5" />}
                        {main.icon === 'TrendingUp' && <TrendingUp className="h-3.5 w-3.5" />}
                        {!main.icon && <Tag className="h-3.5 w-3.5" />}
                      </div>

                      <span className="font-bold text-slate-900 text-sm truncate">{main.name}</span>

                      <Badge
                        variant="secondary"
                        className={`text-[10px] transition-colors ${
                          isDropTarget
                            ? 'bg-blue-200 text-blue-900 font-bold'
                            : 'bg-slate-200/70 text-slate-700'
                        }`}
                      >
                        {subs.length} {subs.length === 1 ? 'subitem' : 'subitens'}
                      </Badge>

                      {isDropTarget && !isCurrentParentOfDragged && (
                        <span className="text-[11px] font-medium text-blue-700 bg-blue-100/90 px-2 py-0.5 rounded-md hidden sm:inline-flex items-center gap-1 animate-pulse">
                          <CornerDownRight className="h-3 w-3" /> Solte aqui para mover
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Orçamento Mensal
                        </span>
                        <span className="text-xs font-bold text-slate-800 tabular-nums">
                          {formatCurrency(main.estimated || 0, currency)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-blue-600"
                          onClick={() => handleOpenAdd('sub', main.id)}
                          title="Adicionar subcategoria nesta categoria"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-blue-600"
                          onClick={() => handleOpenEdit(main)}
                          title="Editar categoria"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-red-600"
                          onClick={() => handleOpenDelete(main)}
                          title="Excluir categoria"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Subcategories items */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100 bg-white">
                      {subs.length === 0 ? (
                        <div className="py-4 px-10 text-xs text-slate-400 italic flex items-center justify-between">
                          <span>Nenhuma subcategoria vinculada.</span>
                          <span className="text-[11px] text-slate-400 not-italic hidden sm:inline">
                            Arraste subitens de outras categorias para cá
                          </span>
                        </div>
                      ) : (
                        subs.map((sub) => {
                          const isThisBeingDragged = draggedSubId === sub.id
                          const isTargetOfDrop = dragOverSubId === sub.id && !isThisBeingDragged

                          return (
                            <div
                              key={sub.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, sub)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => handleDragOverSub(e, sub)}
                              onDragLeave={handleDragLeaveSub}
                              onDrop={(e) => handleDropOnSub(e, sub)}
                              className={`group/sub relative flex items-center justify-between py-2 px-6 sm:px-8 transition-all text-xs cursor-grab active:cursor-grabbing ${
                                isThisBeingDragged
                                  ? 'opacity-40 bg-blue-50/70 border border-dashed border-blue-400'
                                  : 'hover:bg-slate-50/70'
                              }`}
                              title="Arraste para mover para outra categoria"
                            >
                              {/* Line drop indicators */}
                              {isTargetOfDrop && dropPosition === 'above' && (
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10 pointer-events-none" />
                              )}
                              {isTargetOfDrop && dropPosition === 'below' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10 pointer-events-none" />
                              )}

                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="text-slate-300 group-hover/sub:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                                  title="Clique e arraste para mover"
                                >
                                  <GripVertical className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-slate-300 shrink-0">↳</span>
                                <span className="font-medium text-slate-700 truncate">
                                  {sub.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {sub.estimated && sub.estimated > 0 ? (
                                  <span className="tabular-nums text-slate-500">
                                    {formatCurrency(sub.estimated, currency)}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">—</span>
                                )}

                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-slate-400 hover:text-blue-600"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenMove(sub)
                                    }}
                                    title="Mover para outra categoria..."
                                  >
                                    <MoveRight className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-slate-400 hover:text-blue-600"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenEdit(sub)
                                    }}
                                    title="Editar subcategoria"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-slate-400 hover:text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenDelete(sub)
                                    }}
                                    title="Excluir subcategoria"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* ADD CATEGORY / SUBCATEGORY MODAL */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modalType === 'main' ? 'Nova Categoria Principal' : 'Nova Subcategoria'}
            </DialogTitle>
            <DialogDescription>
              {modalType === 'main'
                ? 'Crie um novo centro de custo de nível superior.'
                : 'Vincule um subitem a uma categoria mãe para detalhamento analítico.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                placeholder="Ex: Cuidados Pessoais ou Farmácia"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {modalType === 'sub' && (
              <div className="space-y-1.5">
                <Label htmlFor="cat-parent">Categoria Mãe</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger id="cat-parent">
                    <SelectValue placeholder="Selecione a categoria principal" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cat-est">Orçamento Estimado Mensal (R$ BRL)</Label>
              <Input
                id="cat-est"
                placeholder="Ex: 500,00"
                value={estimated}
                onChange={(e) => setEstimated(e.target.value)}
              />
            </div>

            {modalType === 'main' && (
              <div className="space-y-1.5">
                <Label htmlFor="cat-color">Cor de Destaque (Gráficos)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="cat-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? 'Criando...' : 'Salvar Categoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
            <DialogDescription>Renomeie ou altere o orçamento estimado.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="e-cat-name">Nome da Categoria</Label>
              <Input
                id="e-cat-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-cat-est">Orçamento Estimado Mensal (R$ BRL)</Label>
              <Input
                id="e-cat-est"
                value={editEstimated}
                onChange={(e) => setEditEstimated(e.target.value)}
              />
            </div>

            {editingCategory?.type === 'main' && (
              <div className="space-y-1.5">
                <Label htmlFor="e-cat-col">Cor de Destaque</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="e-cat-col"
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingEdit} className="bg-blue-600 hover:bg-blue-700">
                {savingEdit ? 'Salvando...' : 'Atualizar Categoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE / REASSIGN MODAL */}
      <Dialog open={!!deletingCat} onOpenChange={(open) => !open && setDeletingCat(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Excluir Categoria</DialogTitle>
            <DialogDescription>
              Você está excluindo a categoria <strong>{deletingCat?.name}</strong>. Para não perder
              o histórico, selecione para onde reatribuir os lançamentos existentes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Reatribuir lançamentos para:</Label>
              <CategorySelectCombobox
                categories={categories}
                value={reassignTo}
                onChange={setReassignTo}
                excludeCategoryId={deletingCat?.id}
                placeholder="Selecione categoria de destino"
                searchPlaceholder="Buscar categoria..."
                emptyText="Nenhuma categoria encontrada."
                specialOption={
                  categories.some(
                    (c) =>
                      c.name.toLowerCase().includes('não categorizado') && c.id !== deletingCat?.id,
                  )
                    ? undefined
                    : { id: 'none', label: '↳ Não Categorizado' }
                }
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setDeletingCat(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MOVE SUBCATEGORY MODAL (Mobile / Accessible Alternative) */}
      <Dialog
        open={!!movingSubCategory}
        onOpenChange={(open) => !open && setMovingSubCategory(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-blue-600" />
              Mover Subcategoria
            </DialogTitle>
            <DialogDescription>
              Altere a categoria mãe de <strong>{movingSubCategory?.name}</strong> para reorganizar
              a árvore.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmMove} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nova Categoria Principal</Label>
              <CategorySelectCombobox
                categories={mainCategories}
                value={targetParentId}
                onChange={setTargetParentId}
                excludeCategoryId={movingSubCategory?.parent}
                placeholder="Selecione a categoria principal de destino"
                searchPlaceholder="Buscar categoria principal..."
                emptyText="Nenhuma categoria encontrada."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setMovingSubCategory(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={moving || !targetParentId || targetParentId === movingSubCategory?.parent}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {moving ? 'Movendo...' : 'Mover Subcategoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
