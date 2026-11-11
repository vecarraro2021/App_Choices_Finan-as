import React from 'react'
import { FileText, ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const BASE_URL = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '')

export interface AttachmentChipProps {
  fileName: string
  kind: string
  /** Nome do arquivo salvo no storage do PocketBase, para montar a URL da miniatura */
  storedName?: string
  /** Id do registro do anexo (consulta a coleção para a URL do arquivo) */
  recordId?: string
  /** Em modo "enviando" (upload em curso), mostra spinner */
  loading?: boolean
  onRemove?: () => void
  variant?: 'composer' | 'message'
  className?: string
}

/**
 * Chip de anexo exibido no composer (antes de enviar) e nas mensagens da
 * conversa. Para imagens já enviadas mostra miniatura; para PDF mostra ícone.
 */
export function AttachmentChip({
  fileName,
  kind,
  storedName,
  recordId,
  loading,
  onRemove,
  variant = 'message',
  className,
}: AttachmentChipProps) {
  const isImage = kind === 'image'
  const fileUrl =
    isImage && recordId && storedName
      ? `${BASE_URL}/api/files/consultor_attachments/${recordId}/${storedName}`
      : null

  return (
    <div
      className={cn(
        'relative inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs shadow-2xs transition-all',
        variant === 'composer'
          ? 'border-slate-200 bg-white text-slate-700'
          : 'border-white/30 bg-white/15 text-white',
        className,
      )}
    >
      {isImage && fileUrl ? (
        <img
          src={fileUrl}
          alt={fileName}
          className="h-9 w-9 rounded-lg object-cover border border-slate-200"
        />
      ) : (
        <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          {kind === 'pdf' ? (
            <FileText className="h-4 w-4 text-red-500" />
          ) : (
            <ImageIcon className="h-4 w-4 text-blue-500" />
          )}
        </div>
      )}

      <span className="max-w-[140px] truncate font-medium" title={fileName}>
        {fileName}
      </span>

      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}

      {onRemove && !loading && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover anexo"
          className="ml-0.5 h-4 w-4 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-[10px] leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}
