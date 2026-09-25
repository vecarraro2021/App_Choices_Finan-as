import React from 'react'
import { TrendingDown, Calendar, Layers, TrendingUp } from 'lucide-react'

export const DashboardCardPreview: React.FC = () => {
  return (
    <div className="w-[580px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-5 text-slate-900 select-none pointer-events-none transform -rotate-2 hover:rotate-0 transition-transform duration-300">
      {/* Header mockup inside preview */}
      <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <span className="font-bold text-xs tracking-tight text-slate-800">
            Meu Planejamento Financeiro
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
            R$ BRL
          </span>
          <span className="text-[10px] font-medium text-slate-400">€ EUR</span>
        </div>
      </div>

      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 tracking-tight">Resumo Executivo</h4>
          <p className="text-[11px] text-slate-500">Visão consolidada do orçamento</p>
        </div>
        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Atualizado
        </span>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Total Gasto
            </span>
            <div className="h-4 w-4 rounded-md bg-blue-100/70 text-blue-600 flex items-center justify-center">
              <TrendingDown className="h-2.5 w-2.5" />
            </div>
          </div>
          <div className="text-sm font-extrabold text-slate-900 tracking-tight">R$ 8.420,00</div>
          <span className="text-[9px] text-slate-500 mt-0.5 block">7 meses analisados</span>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Total Orçado
            </span>
            <div className="h-4 w-4 rounded-md bg-slate-200/70 text-slate-600 flex items-center justify-center">
              <Layers className="h-2.5 w-2.5" />
            </div>
          </div>
          <div className="text-sm font-extrabold text-slate-900 tracking-tight">R$ 9.000,00</div>
          <span className="text-[9px] text-slate-500 mt-0.5 block">Meta consolidada</span>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700">
              Disponível
            </span>
            <div className="h-4 w-4 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="h-2.5 w-2.5" />
            </div>
          </div>
          <div className="text-sm font-extrabold text-emerald-700 tracking-tight">R$ 580,00</div>
          <span className="text-[9px] text-emerald-600/80 mt-0.5 block">6,4% de folga</span>
        </div>
      </div>

      {/* Chart Section */}
      <div className="rounded-xl border border-slate-200/70 bg-white p-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold text-slate-800">Gasto Real vs. Orçado</span>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-blue-600" />
              <span>Real</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-slate-300" />
              <span>Orçado</span>
            </div>
          </div>
        </div>

        {/* CSS Bar Chart replica */}
        <div className="h-28 flex items-end justify-between gap-2 pt-2 px-1 border-b border-slate-100">
          {[
            { month: 'Fev', real: 55, orcado: 70 },
            { month: 'Mar', real: 62, orcado: 70 },
            { month: 'Abr', real: 78, orcado: 70 },
            { month: 'Mai', real: 68, orcado: 70 },
            { month: 'Jun', real: 85, orcado: 70 },
            { month: 'Jul', real: 94, orcado: 70 },
            { month: 'Ago', real: 88, orcado: 70 },
          ].map((bar, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="w-full flex items-end justify-center gap-1 h-[88px]">
                {/* Real Bar */}
                <div
                  className="w-2.5 rounded-t-sm bg-blue-600 transition-all shadow-xs"
                  style={{ height: `${bar.real}%` }}
                />
                {/* Orçado Bar */}
                <div
                  className="w-2.5 rounded-t-sm bg-slate-300"
                  style={{ height: `${bar.orcado}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-400 font-medium">{bar.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
