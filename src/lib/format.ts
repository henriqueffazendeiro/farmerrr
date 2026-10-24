/**
 * Formatação de números e datas.
 * Nota: usar sempre a mesma função no servidor e no cliente para não haver
 * mismatch de hidratação.
 */

const PT = 'pt-PT'

/** 8421930 → "8,4M" — para cartões e destaques. */
export function compactNumber(input: number | string): string {
  const value = Number(input)
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) < 1000) return String(Math.round(value))

  const units: Array<[number, string]> = [
    [1_000_000_000, 'B'],
    [1_000_000, 'M'],
    [1_000, 'K'],
  ]

  for (const [threshold, suffix] of units) {
    if (Math.abs(value) >= threshold) {
      const scaled = value / threshold
      // 1 casa decimal abaixo de 10 (8,4M), nenhuma acima (24M)
      const decimals = Math.abs(scaled) < 10 ? 1 : 0
      const text = scaled.toFixed(decimals).replace('.', ',')
      return text.replace(/,0$/, '') + suffix
    }
  }

  return String(value)
}

/** 8421930 → "8 421 930" — para tabelas e valores exatos. */
export function fullNumber(input: number | string): string {
  const value = Number(input)
  return new Intl.NumberFormat(PT).format(Number.isFinite(value) ? Math.round(value) : 0)
}

/** Prémios: 50000 (cêntimos) → "500 €" */
export function money(amountCents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(PT, {
    style: 'currency',
    currency,
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100)
}

/** "12 set" */
export function shortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(PT, { day: 'numeric', month: 'short' }).format(d)
}

/** Contagem decrescente legível: "12d 04h", "4h 12m", "termina hoje". */
export function timeRemaining(endsAt: Date | string | null): string | null {
  if (!endsAt) return null
  const end = typeof endsAt === 'string' ? new Date(endsAt) : endsAt
  const ms = end.getTime() - Date.now()
  if (ms <= 0) return 'terminado'

  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days >= 1) return `${days}d ${String(hours % 24).padStart(2, '0')}h`
  if (hours >= 1) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
  return `${minutes}m`
}

/** Plural simples em português: plural(1, 'clip', 'clips') */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}
