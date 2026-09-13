import React from 'react'
import AssistantChatPanel from '@/components/AssistantChatPanel'
import { Bot, Sparkles } from 'lucide-react'

export default function AssistantView() {
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Assistente Financeiro de IA
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Nativo Skip Cloud
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Converse diretamente com o agente de inteligência financeira sobre seus gastos,
            histórico de lançamentos, orçamentos e regras aprendidas.
          </p>
        </div>
      </div>

      <AssistantChatPanel />
    </div>
  )
}
