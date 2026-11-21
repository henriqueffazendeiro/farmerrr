import type { ClipperRow, VideoRow } from '@/lib/db/board'

export type ClipperDetails = { clipper: ClipperRow; videos: VideoRow[] }
type Entry = { at: number; promise: Promise<ClipperDetails>; value?: ClipperDetails }

const MAX_AGE = 60_000
const entries = new Map<string, Entry>()
const keyOf = (slug: string, participantId: string, periodKey: string) => `${slug}|${participantId}|${periodKey}`

/** Pede (ou reutiliza) os detalhes de um clipper. Chamado ao passar o rato, para o clique ser instantâneo. */
export function loadClipperDetails(slug: string, participantId: string, periodKey: string): Promise<ClipperDetails> {
  const key = keyOf(slug, participantId, periodKey)
  const cached = entries.get(key)
  if (cached && Date.now() - cached.at < MAX_AGE) return cached.promise
  const entry: Entry = { at: Date.now(), promise: Promise.resolve() as never }
  entry.promise = fetch(`/api/leaderboards/${encodeURIComponent(slug)}/clippers/${encodeURIComponent(participantId)}?periodo=${encodeURIComponent(periodKey)}`)
    .then(async response => {
      if (!response.ok) throw new Error('Clipper indisponível')
      const value = await response.json() as ClipperDetails
      entry.value = value
      return value
    })
    .catch(error => { entries.delete(key); throw error })
  entries.set(key, entry)
  return entry.promise
}

/** Detalhes já carregados (para mostrar logo no primeiro render do diálogo). */
export function cachedClipperDetails(slug: string, participantId: string, periodKey: string) {
  const entry = entries.get(keyOf(slug, participantId, periodKey))
  return entry && Date.now() - entry.at < MAX_AGE ? entry.value ?? null : null
}
