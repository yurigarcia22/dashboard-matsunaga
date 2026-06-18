const SPREADSHEET_ID = '1l5UcSQpfZoVJ2ozz_4a6fRjEQdi33O5O-3f9SgP9NmY'
const LEADS_GID = '1703058783' // aba "Leads Consulta"

export interface Lead {
  id: string
  nome: string
  pipeline: string
  etapa: string
  status: string
  cidade: string
  dataEntrada: Date
  ultimaAtualizacao: Date
  utmSource: string
  utmCampaign: string
}

export interface DashboardData {
  leads: Lead[]
  totalLeads: number
  leadsHoje: number
  leadsSemana: number
  leadsMes: number
  porPipeline: Record<string, number>
  porEtapa: Record<string, number>
  porFonte: Record<string, number>
  porCidade: Record<string, number>
  porDia: { data: string; total: number }[]
}

function parseDate(raw: string): Date {
  if (!raw) return new Date(0)
  const [datePart, timePart] = raw.split(', ')
  if (!datePart) return new Date(0)
  const [day, month, year] = datePart.split('/')
  const timeStr = timePart || '00:00:00'
  return new Date(`${year}-${month}-${day}T${timeStr}`)
}

function parseLeadRows(rows: unknown[][]): Lead[] {
  const leads: Lead[] = []
  for (const row of rows) {
    const cells = row as (string | number | null | undefined)[]
    const get = (i: number) => (cells[i] != null ? String(cells[i]) : '').trim()
    const idRaw = get(0)
    if (!/^\d{7,10}$/.test(idRaw)) continue
    leads.push({
      id: idRaw,
      nome: get(1),
      pipeline: get(2),
      etapa: get(3),
      status: get(4),
      cidade: get(5),
      dataEntrada: parseDate(get(6)),
      ultimaAtualizacao: parseDate(get(7)),
      utmSource: get(8),
      utmCampaign: get(9),
    })
  }
  return leads
}

// Opção 1: Apps Script URL (mais seguro, planilha pode ser privada)
async function fetchViaAppsScript(url: string): Promise<Lead[]> {
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`Apps Script retornou ${res.status}`)
  const rows: unknown[][] = await res.json()
  // Apps Script retorna array de arrays; filtra header e linhas inválidas
  const dataRows = rows.filter((r) => {
    const id = r[0] != null ? String(r[0]).trim() : ''
    return /^\d{7,10}$/.test(id)
  })
  return parseLeadRows(dataRows)
}

interface GvizCell {
  v?: string | number | null
  f?: string | null
}

function parseGvizDate(cell: GvizCell | null | undefined): Date {
  if (!cell) return new Date(0)
  // Prefere campo formatado "18/06/2026, 11:05:24"
  if (cell.f) return parseDate(cell.f)
  // Fallback: formato "Date(2026,5,18,11,5,24)" — mês é 0-indexed
  if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
    const parts = cell.v.replace('Date(', '').replace(')', '').split(',').map(Number)
    return new Date(parts[0], parts[1], parts[2], parts[3] || 0, parts[4] || 0, parts[5] || 0)
  }
  return new Date(0)
}

// Opção 2: gviz API (planilha precisa ser pública - "Qualquer pessoa com o link")
async function fetchViaGviz(): Promise<Lead[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${LEADS_GID}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`gviz retornou ${res.status}`)
  const text = await res.text()
  const start = text.indexOf('setResponse(')
  if (start === -1) throw new Error('Resposta gviz inválida')
  const jsonStr = text.substring(start + 'setResponse('.length, text.lastIndexOf(')'))
  const json = JSON.parse(jsonStr)

  const rows: { c?: (GvizCell | null)[] }[] = json?.table?.rows ?? []
  const leads: Lead[] = []

  for (const row of rows) {
    const cells = row.c ?? []
    // Usa 'f' (valor formatado) quando disponível, senão 'v' (valor bruto)
    const getStr = (i: number) => {
      const cell = cells[i]
      if (!cell) return ''
      return String(cell.f ?? cell.v ?? '').trim()
    }
    const idRaw = getStr(0)
    if (!/^\d{7,10}$/.test(idRaw)) continue

    leads.push({
      id: idRaw,
      nome: getStr(1),
      pipeline: getStr(2),
      etapa: getStr(3),
      status: getStr(4),
      cidade: getStr(5),
      dataEntrada: parseGvizDate(cells[6]),
      ultimaAtualizacao: parseGvizDate(cells[7]),
      utmSource: getStr(8),
      utmCampaign: getStr(9),
    })
  }

  return leads
}

export async function fetchLeads(): Promise<Lead[]> {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL
  if (appsScriptUrl) {
    return fetchViaAppsScript(appsScriptUrl)
  }
  return fetchViaGviz()
}

export function buildDashboardData(leads: Lead[]): DashboardData {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const leadsHoje = leads.filter(l => l.dataEntrada >= startOfDay).length
  const leadsSemana = leads.filter(l => l.dataEntrada >= startOfWeek).length
  const leadsMes = leads.filter(l => l.dataEntrada >= startOfMonth).length

  const porPipeline: Record<string, number> = {}
  const porEtapa: Record<string, number> = {}
  const porFonte: Record<string, number> = {}
  const porCidade: Record<string, number> = {}
  const porDiaMap: Record<string, number> = {}

  for (const lead of leads) {
    const pipeline = lead.pipeline || 'Sem pipeline'
    porPipeline[pipeline] = (porPipeline[pipeline] || 0) + 1

    const etapa = lead.etapa || 'Sem etapa'
    porEtapa[etapa] = (porEtapa[etapa] || 0) + 1

    let fonteRaw = lead.utmSource
      .replace(/\{\{.*?\}\}/g, '') // remove {{placeholders}} do Meta
      .replace(/utm_\w+=\s*/gi, '') // remove chaves UTM soltas
      .trim()
    // Normaliza nomes comuns
    const fonteMap: Record<string, string> = {
      meta_ads: 'Meta Ads',
      google_ads: 'Google Ads',
      google: 'Google Ads',
      instagram_bio_sp: 'Instagram',
      instagram: 'Instagram',
      youtube: 'YouTube',
      tiktok: 'TikTok',
    }
    const fonte = fonteRaw ? (fonteMap[fonteRaw.toLowerCase()] ?? fonteRaw) : 'Orgânico'
    porFonte[fonte] = (porFonte[fonte] || 0) + 1

    if (lead.cidade) porCidade[lead.cidade] = (porCidade[lead.cidade] || 0) + 1

    const dataKey = lead.dataEntrada.toISOString().split('T')[0]
    if (dataKey && lead.dataEntrada.getFullYear() > 2000) {
      porDiaMap[dataKey] = (porDiaMap[dataKey] || 0) + 1
    }
  }

  const porDia = Object.entries(porDiaMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([data, total]) => ({
      data: data.split('-').reverse().join('/').slice(0, 5),
      total,
    }))

  return {
    leads,
    totalLeads: leads.length,
    leadsHoje,
    leadsSemana,
    leadsMes,
    porPipeline,
    porEtapa,
    porFonte,
    porCidade,
    porDia,
  }
}
