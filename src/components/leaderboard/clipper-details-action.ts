'use server'

import { loadClipperDetails } from '@/lib/leaderboards/clipper-details'

export async function getClipperDetails(slug: string, participantId: string, periodKey: string) {
  const details = await loadClipperDetails(slug, participantId, periodKey)
  if (!details) throw new Error('Clipper indisponível')
  return details
}
