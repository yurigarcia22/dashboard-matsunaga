export interface LeadRaw {
  id: string
  nome: string
  pipeline: string
  etapa: string
  status: string
  cidade: string
  dataEntrada: string
  ultimaAtualizacao: string
  utmSource: string
  utmCampaign: string
}

export interface Lead extends Omit<LeadRaw, 'dataEntrada' | 'ultimaAtualizacao'> {
  dataEntrada: Date
  ultimaAtualizacao: Date
}

export interface Metrics {
  totalLeads: number
  leadsHoje: number
  leadsSemana: number
  leadsMes: number
  porPipeline: { name: string; value: number }[]
  porEtapa: { name: string; value: number }[]
  porFonte: { name: string; value: number; pct: number }[]
  porCidade: { name: string; value: number }[]
  porDia: { data: string; total: number }[]
  pipelines: string[]
}

export function parseLead(raw: LeadRaw): Lead {
  return {
    ...raw,
    dataEntrada: new Date(raw.dataEntrada),
    ultimaAtualizacao: new Date(raw.ultimaAtualizacao),
  }
}

const FONTE_MAP: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  google: 'Google Ads',
  instagram_bio_sp: 'Instagram',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  manychat: 'ManyChat',
}

function normalizeFonte(raw: string): string {
  const cleaned = raw.replace(/\{\{.*?\}\}/g, '').replace(/utm_\w+=\s*/gi, '').trim()
  if (!cleaned) return 'Orgânico'
  return FONTE_MAP[cleaned.toLowerCase()] ?? cleaned
}

// Etapas conhecidas - filtra lixo (IDs numéricos, etc)
const ETAPA_VALIDA = /^[A-Za-zÀ-ú\s\-_/]+$/

export function computeMetrics(leads: Lead[], now = new Date()): Metrics {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfDay.getDate() - 6)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const leadsHoje = leads.filter(l => l.dataEntrada >= startOfDay).length
  const leadsSemana = leads.filter(l => l.dataEntrada >= startOfWeek).length
  const leadsMes = leads.filter(l => l.dataEntrada >= startOfMonth).length

  const pipelineMap: Record<string, number> = {}
  const etapaMap: Record<string, number> = {}
  const fonteMap: Record<string, number> = {}
  const cidadeMap: Record<string, number> = {}
  const diaMap: Record<string, number> = {}

  for (const lead of leads) {
    const pipeline = lead.pipeline || 'Sem pipeline'
    pipelineMap[pipeline] = (pipelineMap[pipeline] || 0) + 1

    const etapa = lead.etapa?.trim()
    if (etapa && ETAPA_VALIDA.test(etapa)) {
      etapaMap[etapa] = (etapaMap[etapa] || 0) + 1
    }

    const fonte = normalizeFonte(lead.utmSource || '')
    fonteMap[fonte] = (fonteMap[fonte] || 0) + 1

    if (lead.cidade?.trim()) {
      cidadeMap[lead.cidade.trim()] = (cidadeMap[lead.cidade.trim()] || 0) + 1
    }

    if (lead.dataEntrada.getFullYear() > 2000) {
      const key = lead.dataEntrada.toISOString().split('T')[0]
      diaMap[key] = (diaMap[key] || 0) + 1
    }
  }

  const toArr = (m: Record<string, number>) =>
    Object.entries(m).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }))

  const pipelineArr = toArr(pipelineMap)
  const total = leads.length

  const fonteArr = toArr(fonteMap).map(f => ({
    ...f,
    pct: total > 0 ? Math.round((f.value / total) * 100) : 0,
  }))

  const porDia = Object.entries(diaMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([data, total]) => ({
      data: data.split('-').reverse().join('/').slice(0, 5),
      total,
    }))

  return {
    totalLeads: total,
    leadsHoje,
    leadsSemana,
    leadsMes,
    porPipeline: pipelineArr,
    porEtapa: toArr(etapaMap),
    porFonte: fonteArr,
    porCidade: toArr(cidadeMap).slice(0, 6),
    porDia,
    pipelines: pipelineArr.map(p => p.name),
  }
}

export type DateRange = 'hoje' | '7d' | '30d' | 'mes' | 'tudo'

export function filterLeads(
  leads: Lead[],
  dateRange: DateRange,
  pipeline: string,
  now = new Date()
): Lead[] {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const cutoffs: Record<DateRange, Date | null> = {
    hoje: startOfDay,
    '7d': new Date(startOfDay.getTime() - 6 * 86400000),
    '30d': new Date(startOfDay.getTime() - 29 * 86400000),
    mes: new Date(now.getFullYear(), now.getMonth(), 1),
    tudo: null,
  }
  const cutoff = cutoffs[dateRange]

  return leads.filter(l => {
    if (cutoff && l.dataEntrada < cutoff) return false
    if (pipeline !== 'todos' && l.pipeline !== pipeline) return false
    return true
  })
}
