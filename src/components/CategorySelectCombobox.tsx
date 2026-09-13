import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Category } from '@/types/finance'

export interface CategoryOption {
  id: string
  name: string
  type?: 'main' | 'sub' | 'special'
  parent?: string
}

interface CategorySelectComboboxProps {
  categories: Category[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  excludeCategoryId?: string
  /**
   * If provided, adds a special option with this ID and label, e.g.
   * { id: 'none', label: '↳ Não Categorizado' } or { id: 'none', label: 'Deixar sem categoria' }
   */
  specialOption?: {
    id: string
    label: string
  }
}

// Remove accents and normalize for search
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function CategorySelectCombobox({
  categories,
  value,
  onChange,
  placeholder = 'Selecione uma categoria',
  searchPlaceholder = 'Buscar categoria...',
  emptyText = 'Nenhuma categoria encontrada.',
  disabled = false,
  className,
  triggerClassName,
  excludeCategoryId,
  specialOption,
}: CategorySelectComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // Filter out excluded category
  const filteredCategories = React.useMemo(() => {
    return categories.filter((c) => c.id !== excludeCategoryId)
  }, [categories, excludeCategoryId])

  // Build hierarchical list: Main category followed by its subcategories, then orphaned subcategories
  const organizedOptions = React.useMemo(() => {
    const list: CategoryOption[] = []

    const mainCats = filteredCategories.filter((c) => c.type === 'main')
    const subCats = filteredCategories.filter((c) => c.type === 'sub')

    mainCats.forEach((main) => {
      list.push({
        id: main.id,
        name: main.name,
        type: 'main',
      })
      const subs = subCats.filter((sc) => sc.parent === main.id)
      subs.forEach((sub) => {
        list.push({
          id: sub.id,
          name: sub.name,
          type: 'sub',
          parent: main.id,
        })
      })
    })

    // Any subcategory whose parent is not in mainCats
    const addedSubIds = new Set(list.filter((c) => c.type === 'sub').map((c) => c.id))
    const orphanSubs = subCats.filter((sc) => !addedSubIds.has(sc.id))
    orphanSubs.forEach((sub) => {
      list.push({
        id: sub.id,
        name: sub.name,
        type: 'sub',
        parent: sub.parent,
      })
    })

    return list
  }, [filteredCategories])

  // Find current label to display in the button trigger
  const selectedLabel = React.useMemo(() => {
    if (specialOption && value === specialOption.id) {
      return specialOption.label
    }
    if (!value || value === 'none') {
      if (specialOption && specialOption.id === 'none') {
        return specialOption.label
      }
      return placeholder
    }
    const found = organizedOptions.find((c) => c.id === value)
    if (found) {
      return found.type === 'sub' ? `↳ ${found.name}` : found.name
    }
    // Fallback search across all categories (in case not in organized list)
    const fallback = categories.find((c) => c.id === value)
    if (fallback) {
      return fallback.type === 'sub' ? `↳ ${fallback.name}` : fallback.name
    }
    return placeholder
  }, [value, specialOption, placeholder, organizedOptions, categories])

  // Custom filter function for cmdk that ignores accents and case
  const filterFunction = React.useCallback((value: string, search: string) => {
    if (!search) return 1
    const normValue = normalizeText(value)
    const normSearch = normalizeText(search.trim())
    return normValue.includes(normSearch) ? 1 : 0
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal text-left h-10 px-3 bg-white border-slate-200 text-slate-800 hover:bg-slate-50',
            !value && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'w-[var(--radix-popover-trigger-width)] p-0 shadow-lg border-slate-200',
          className,
        )}
        align="start"
      >
        <Command filter={filterFunction}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {specialOption && (
                <CommandItem
                  key={specialOption.id}
                  value={specialOption.label}
                  onSelect={() => {
                    onChange(specialOption.id)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between cursor-pointer py-2"
                >
                  <span className="truncate">{specialOption.label}</span>
                  <Check
                    className={cn(
                      'ml-2 h-4 w-4 shrink-0',
                      value === specialOption.id ? 'opacity-100 text-blue-600' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              )}
              {organizedOptions.map((opt) => {
                const isSelected = value === opt.id
                const displayName = opt.type === 'sub' ? `↳ ${opt.name}` : opt.name
                // Value for search matching includes both name and display name
                const searchValue = `${opt.name} ${displayName}`

                return (
                  <CommandItem
                    key={opt.id}
                    value={searchValue}
                    onSelect={() => {
                      onChange(opt.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex items-center justify-between cursor-pointer py-1.5',
                      opt.type === 'main'
                        ? 'font-semibold text-slate-900'
                        : 'font-normal text-slate-700 pl-4',
                    )}
                  >
                    <span className="truncate">{displayName}</span>
                    <Check
                      className={cn(
                        'ml-2 h-4 w-4 shrink-0',
                        isSelected ? 'opacity-100 text-blue-600' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
