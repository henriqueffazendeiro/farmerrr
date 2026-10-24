import type { PeriodMode } from '@/lib/db/types'

export const ALL_TIME = 'all'

type PeriodSource = { period_mode: PeriodMode; timezone: string }

/**
 * Chave do período corrente. Tem de dar o mesmo resultado que
 * `public.period_key_for` no Postgres — daí usar o fuso do leaderboard e não
 * o do servidor.
 */
export function currentPeriodKey(lb: PeriodSource): string {
  if (lb.period_mode !== 'monthly') return ALL_TIME

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: lb.timezone || 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())

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
  const competitionFrom = new Date(lb.starts_at)
  const competitionTo = lb.ends_at ? new Date(lb.ends_at) : new Date()

  if (periodKey === ALL_TIME) {
    return { from: competitionFrom, to: competitionTo }
  }

  const tz = lb.timezone || 'Europe/Lisbon'
  const from = monthStart(periodKey, tz)
  const to = monthStart(addMonth(periodKey), tz)

  return {
    from: from > competitionFrom ? from : competitionFrom,
    to: to < competitionTo ? to : competitionTo,
  }
}

/** Os períodos que fazem sentido oferecer nos separadores da página pública. */
export function availablePeriods(lb: { period_mode: PeriodMode; timezone: string }): string[] {
  return lb.period_mode === 'monthly' ? [currentPeriodKey(lb), ALL_TIME] : [ALL_TIME]
}
