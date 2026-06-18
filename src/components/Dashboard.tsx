'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import {
  Users, UserCheck, TrendingUp, Calendar, RefreshCw, Activity,
  Filter, ChevronDown,
} from 'lucide-react'
import { KPICard } from './KPICard'
import {
  type LeadRaw, type Lead, type DateRange,
  parseLead, computeMetrics, filterLeads,
} from '@/lib/metrics'

const DATE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Este mês', value: 'mes' },
  { label: 'Tudo', value: 'tudo' },
]

const PALETTE = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
]

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-base font-bold text-emerald-600">{payload[0].value} leads</p>
      </div>
    )
  }
  return null
}

function Select({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  placeholder?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-sm text-gray-700 cursor-pointer hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
      >
        {placeholder && <option value="todos">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  )
}

// Agrupa itens de cauda como "Outros"
function topWithOthers(arr: { name: string; value: number }[], n = 7) {
  if (arr.length <= n) return arr
  const top = arr.slice(0, n)
  const outros = arr.slice(n).reduce((acc, i) => acc + i.value, 0)
  return [...top, { name: 'Outros', value: outros }]
}

export default function Dashboard() {
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)

  const [dateRange, setDateRange] = useState<DateRange>('tudo')
  const [pipeline, setPipeline] = useState('todos')

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/leads', { cache: 'no-store' })
      if (!res.ok) throw new Error('Erro ao buscar dados')
      const json = await res.json()
      const leads: Lead[] = (json.leads as LeadRaw[]).map(parseLead)
      setAllLeads(leads)
      setLastUpdate(new Date())
      setRefreshCount(c => c + 1)
    } catch {
      setError('Não foi possível carregar os dados da planilha.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const filteredLeads = useMemo(
    () => filterLeads(allLeads, dateRange, pipeline),
    [allLeads, dateRange, pipeline]
  )

  const metrics = useMemo(() => computeMetrics(filteredLeads), [filteredLeads])

  const pipelineOptions = useMemo(
    () => computeMetrics(allLeads).pipelines.map(p => ({ label: p, value: p })),
    [allLeads]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-medium">Carregando dados da planilha...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-sm text-center">
          <p className="text-red-600 font-semibold mb-2">Erro ao carregar</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const pipelineTop = topWithOthers(metrics.porPipeline)
  const etapaTop = metrics.porEtapa.slice(0, 8)

  const dateLabel = DATE_OPTIONS.find(d => d.value === dateRange)?.label ?? 'Tudo'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-bold text-gray-900">Dr. Danilo Matsunaga</h1>
              <p className="text-xs text-gray-400">Dashboard de Leads</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="hidden sm:block text-xs text-gray-400">
                Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {refreshCount > 1 && <span className="text-emerald-500 ml-1">· #{refreshCount}</span>}
              </span>
            )}
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-600 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 px-3 py-1.5 rounded-lg transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              Atualizar
            </button>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-5 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mr-1">
            <Filter className="w-3 h-3" />
            Filtros:
          </div>
          <Select
            value={dateRange}
            onChange={v => setDateRange(v as DateRange)}
            options={DATE_OPTIONS}
          />
          <Select
            value={pipeline}
            onChange={setPipeline}
            options={pipelineOptions}
            placeholder="Todos os pipelines"
          />
          {(dateRange !== 'tudo' || pipeline !== 'todos') && (
            <button
              onClick={() => { setDateRange('tudo'); setPipeline('todos') }}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium underline underline-offset-2"
            >
              Limpar filtros
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            Mostrando <span className="font-semibold text-gray-700">{metrics.totalLeads.toLocaleString('pt-BR')}</span> leads
            {(dateRange !== 'tudo' || pipeline !== 'todos') && (
              <span className="text-gray-400"> · {dateLabel}{pipeline !== 'todos' ? ` · ${pipeline}` : ''}</span>
            )}
          </span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total de Leads" value={metrics.totalLeads.toLocaleString('pt-BR')} subtitle="No período selecionado" icon={<Users className="w-4 h-4" />} color="green" />
          <KPICard title="Leads Hoje" value={metrics.leadsHoje} subtitle="Desde meia-noite" icon={<Calendar className="w-4 h-4" />} color="blue" />
          <KPICard title="Esta Semana" value={metrics.leadsSemana} subtitle="Últimos 7 dias" icon={<TrendingUp className="w-4 h-4" />} color="purple" />
          <KPICard title="Este Mês" value={metrics.leadsMes} subtitle={new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} icon={<UserCheck className="w-4 h-4" />} color="amber" />
        </div>

        {/* Linha do tempo */}
        {metrics.porDia.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Leads por Dia</h2>
                <p className="text-xs text-gray-400 mt-0.5">Evolução nos últimos 30 dias</p>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-600 font-medium px-2.5 py-1 rounded-full">
                Pico: {Math.max(...metrics.porDia.map(d => d.total))} leads/dia
              </span>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={metrics.porDia} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5}
                  dot={{ fill: '#10b981', r: 2.5, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pipeline + Etapas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Por Pipeline */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-gray-900">Por Pipeline</h2>
              <p className="text-xs text-gray-400 mt-0.5">Volume por funil de atendimento</p>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(200, pipelineTop.length * 36)}>
              <BarChart data={pipelineTop} layout="vertical" margin={{ left: 4, right: 40 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category" dataKey="name"
                  tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false}
                  width={160}
                />
                <Tooltip
                  formatter={(v: number) => [`${v} leads`, '']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {pipelineTop.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Por Etapa */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-gray-900">Por Etapa</h2>
              <p className="text-xs text-gray-400 mt-0.5">Posição dos leads no funil</p>
            </div>
            {etapaTop.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sem dados</div>
            ) : (
              <div className="space-y-2.5">
                {etapaTop.map((item, i) => {
                  const pct = metrics.totalLeads > 0 ? (item.value / metrics.totalLeads) * 100 : 0
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-700 font-medium truncate pr-2 max-w-[60%]">{item.name}</span>
                        <span className="text-gray-400 shrink-0">{item.value} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Fonte + Cidades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Origem */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-gray-900">Origem dos Leads</h2>
              <p className="text-xs text-gray-400 mt-0.5">Canal de aquisição (UTM Source)</p>
            </div>
            <div className="space-y-3">
              {metrics.porFonte.map((item, i) => (
                <div key={item.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{item.name}</span>
                    <span className="text-gray-400">{item.value} ({item.pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cidades */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-gray-900">Top Cidades</h2>
              <p className="text-xs text-gray-400 mt-0.5">Leads com cidade identificada</p>
            </div>
            {metrics.porCidade.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Nenhuma cidade registrada</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={metrics.porCidade} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip formatter={(v: number) => [`${v} leads`, '']} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={40}>
                    {metrics.porCidade.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-2">
          <p className="text-xs text-gray-400">
            Dados sincronizados automaticamente a cada 5 minutos · Sem custo de API · Dr. Danilo Matsunaga © 2026
          </p>
        </div>
      </main>
    </div>
  )
}
