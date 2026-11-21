import type { PeriodMode } from '@/lib/db/types'

export const ALL_TIME = 'all'
// Separate from SQL's legacy 'all', which represents competition dates.
export const HISTORY_PERIOD = 'history'

type PeriodSource = { period_mode: PeriodMode; timezone: string; ends_at?: string | null }

/**
 * Mensal com datas definidas pelo streamer (ex.: do dia 1 ao dia 21): o ranking conta só esse intervalo, depois
 * fica em pausa e as datas avançam um mês (ver migração 0020). Sem data de fim: meses do calendário.
 */
export const hasMonthlyDates = (lb: PeriodSource) => lb.period_mode === 'monthly' && !!lb.ends_at

/**
 * Chave do período corrente. Tem de dar o mesmo resultado que
 * `public.current_period_key` no Postgres — daí usar o fuso do leaderboard e não
 * o do servidor. Com datas definidas, é o mês em que a competição acaba.
 */
export function currentPeriodKey(lb: PeriodSource): string {
  if (lb.period_mode !== 'monthly') return ALL_TIME

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: lb.timezone || 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(hasMonthlyDates(lb) ? new Date(Date.parse(lb.ends_at!) - 1) : new Date())

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** '2026-09' → 'Setembro' · 'all' → 'Histórico geral' */
export function periodLabel(key: string): string {
  if (key === ALL_TIME) return 'Histórico geral'
  const [, month] = key.split('-')
  const name = MONTHS[Number(month) - 1]
  if (!name) return key
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Nome curto para títulos: 'Corrida de Setembro'. */
export function periodTitle(key: string): string {
  if (key === ALL_TIME) return 'Histórico geral'
  return `Corrida de ${periodLabel(key)}`
}

/** Deslocação do fuso, em ms, para um instante concreto (trata do horário de verão). */
function timezoneOffsetMs(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )

  return asUtc - at.getTime()
}

/** Instante UTC correspondente à meia-noite local do dia 1 do mês `key`. */
function monthStart(key: string, timeZone: string): Date {
  const [year, month] = key.split('-').map(Number)
  const guess = Date.UTC(year, month - 1, 1, 0, 0, 0)
  const offset = timezoneOffsetMs(new Date(guess), timeZone)
  return new Date(guess - offset)
}

function addMonth(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * Janela de datas de um período, já intersetada com as datas da competição.
 * Espelha a lógica de `public.recompute_leaderboard`.
 */
export function periodBounds(
  lb: { period_mode: PeriodMode; timezone: string; starts_at: string; ends_at: string | null },
  periodKey: string,
): { from: Date; to: Date } {
  if (hasMonthlyDates(lb) && periodKey === currentPeriodKey(lb)) return { from: new Date(lb.starts_at), to: new Date(lb.ends_at!) }
  const competitionFrom = new Date(lb.starts_at)
  const competitionTo = lb.ends_at ? new Date(lb.ends_at) : new Date()

  if (periodKey === ALL_TIME) {
    return { from: new Date(0), to: new Date() }
  }

  const tz = lb.timezone || 'Europe/Lisbon'
  const from = monthStart(periodKey, tz)
  const to = monthStart(addMonth(periodKey), tz)

  return {
    from: from > competitionFrom ? from : competitionFrom,
    to: to < competitionTo ? to : competitionTo,
  }
}

/** O mesmo dia e hora (no fuso da competição) `months` meses depois. 31 jan + 1 = 28/29 fev. */
export function addMonthsLocal(at: Date, months: number, timeZone: string): Date {
  const zone = timeZone || 'Europe/Lisbon'
  const local = new Date(at.getTime() + timezoneOffsetMs(at, zone))
  const year = local.getUTCFullYear(), month = local.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const guess = Date.UTC(year, month, Math.min(local.getUTCDate(), lastDay),
    local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds())
  return new Date(guess - timezoneOffsetMs(new Date(guess), zone))
}

/**
 * As datas da competição seguinte: os mesmos dias, um mês depois (ou mais, se o fim desse mês também já passou).
 */
export function nextMonthlyDates(lb: { timezone: string; starts_at: string; ends_at: string }, now = Date.now()) {
  for (let months = 1; months < 1200; months++) {
    const ends = addMonthsLocal(new Date(lb.ends_at), months, lb.timezone)
    if (ends.getTime() > now) return { starts: addMonthsLocal(new Date(lb.starts_at), months, lb.timezone), ends }
  }
  return { starts: new Date(lb.starts_at), ends: new Date(lb.ends_at) }
}

/** Mensal com datas cujo fim já passou: em pausa até à entrega dos prémios e ao dia de início seguinte. */
export function isPaused(lb: PeriodSource & { status?: string }, now = Date.now()) {
  return hasMonthlyDates(lb) && (!lb.status || lb.status === 'active') && Date.parse(lb.ends_at!) <= now
}

/**
 * Até onde conta o contador. Mensal com datas: até ao fim (ou até ao início, se ainda não começou); em pausa não há
 * contador (null: aparece o retângulo dos prémios). Mensal sem datas: o fim do mês. Data fixa: o fim, enquanto não passar.
 */
export function currentPeriodEnd(
  lb: { period_mode: PeriodMode; timezone: string; starts_at?: string; ends_at: string | null; status?: string },
  now = Date.now(),
): string | null {
  if (lb.status && lb.status !== 'active') return null
  if (hasMonthlyDates(lb)) {
    if (isPaused(lb, now)) return null
    return lb.starts_at && Date.parse(lb.starts_at) > now ? new Date(lb.starts_at).toISOString() : new Date(lb.ends_at!).toISOString()
  }
  const end = lb.ends_at && new Date(lb.ends_at).getTime() > now ? new Date(lb.ends_at) : null
  if (lb.period_mode !== 'monthly') return end?.toISOString() ?? null
  return monthStart(addMonth(currentPeriodKey(lb)), lb.timezone || 'Europe/Lisbon').toISOString()
}

/** Os períodos que fazem sentido oferecer nos separadores da página pública. */
export function availablePeriods(lb: PeriodSource): string[] {
  return lb.period_mode === 'monthly' ? [currentPeriodKey(lb), ALL_TIME] : [ALL_TIME]
}
