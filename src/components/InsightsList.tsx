import React from 'react'
import { InsightItem } from '@/lib/insightsEngine'
import { AlertTriangle, Sparkles, CheckCircle2, Repeat, Target } from 'lucide-react'

export interface InsightsListProps {
  insights: InsightItem[]
  limit?: number
  emptyMessage?: string
}

export function renderInsightIcon(iconType: InsightItem['iconType']): React.ReactNode {
  switch (iconType) {
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-red-500" />
    case 'economy':
      return <Sparkles className="h-5 w-5 text-blue-500" />
    case 'success':
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
    case 'repeat':
      return <Repeat className="h-5 w-5 text-blue-500" />
    case 'target':
      return <Target className="h-5 w-6 text-purple-600" />
    default:
      return <Sparkles className="h-5 w-5 text-blue-500" />
  }
}

export function InsightsList({
  insights,
  limit,
  emptyMessage = 'Nenhuma recomendação ou insight identificado para o período.',
}: InsightsListProps) {
  const displayed = limit ? insights.slice(0, limit) : insights

  if (displayed.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {displayed.map((insight) => (
        <div
          key={insight.id}
          className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start gap-3.5"
        >
          <div className="p-2 rounded-lg bg-white border border-slate-200/60 shadow-2xs shrink-0 mt-0.5">
            {renderInsightIcon(insight.iconType)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-xs text-slate-900 truncate">{insight.title}</h4>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${insight.badgeColor}`}
              >
                {insight.badgeText}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
              {insight.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
