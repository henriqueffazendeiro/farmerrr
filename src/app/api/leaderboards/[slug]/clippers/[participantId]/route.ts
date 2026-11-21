import { NextResponse } from 'next/server'
import { loadClipperDetails } from '@/lib/leaderboards/clipper-details'

// Rota GET (e não server action) para os pedidos correrem em paralelo
// e poderem ser feitos antecipadamente quando o rato passa por cima de um clipper.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; participantId: string }> }) {
  const { slug, participantId } = await params
  const periodKey = new URL(request.url).searchParams.get('periodo') ?? ''
  const details = await loadClipperDetails(slug, participantId, periodKey)
  if (!details) return NextResponse.json({ error: 'Clipper indisponível' }, { status: 404 })
  return NextResponse.json(details, { headers: { 'Cache-Control': 'private, max-age=30' } })
}
