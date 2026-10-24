import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { readClipperSession } from '@/lib/recap/session'
import { summarizeRecap } from '@/lib/recap/model'
import { mp4Duration } from '@/lib/recap/mp4'

export const runtime = 'nodejs'
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status })
  if (request.headers.get('origin') !== new URL(request.url).origin) return fail('Origem inválida.', 403)
  const session = await readClipperSession()
  if (!session) return fail('Entra com a conta TikTok vencedora para enviar o vídeo.', 401)
  if (request.headers.get('content-type') !== 'video/mp4') return fail('Envia um ficheiro MP4.', 415)
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Recap inválido.', 400)
  const admin = createAdminClient()
  const { data: recap, error } = await admin.from('monthly_recaps').select('*').eq('id', id).maybeSingle()
  if (error || !recap) return fail('Recap não encontrado.', 404)
  const { data: lb } = await admin.from('leaderboards').select('is_public, status').eq('id', recap.leaderboard_id).single()
  if (!lb?.is_public || lb.status === 'draft') return fail('Recap não disponível.', 404)
  if (summarizeRecap(recap.snapshot).winner?.id !== session.participantId) return fail('Só o vencedor deste mês pode enviar o vídeo.', 403)
  const limit = 4 * 1024 * 1024
  if (Number(request.headers.get('content-length')) > limit) return fail('O limite é 4 MB.', 413)
  const reader = request.body?.getReader()
  if (!reader) return fail('Ficheiro em falta.', 400)
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) { await reader.cancel(); return fail('O limite é 4 MB.', 413) }
      chunks.push(chunk.value)
    }
    const bytes = Buffer.concat(chunks)
    try { mp4Duration(bytes) } catch (e) { return fail(e instanceof Error ? e.message : 'MP4 inválido.', 400) }
    const path = `${id}/${randomUUID()}.mp4`
    const { error: uploadError } = await admin.storage.from('recap-videos').upload(path, bytes, { contentType: 'video/mp4', upsert: false })
    if (uploadError) return fail('Não foi possível guardar o vídeo. Tenta novamente.', 500)
    const { error: updateError } = await admin.from('monthly_recaps').update({ winner_video_path: path }).eq('id', id)
    if (updateError) { await admin.storage.from('recap-videos').remove([path]); return fail('Não foi possível publicar o vídeo.', 500) }
    if (recap.winner_video_path) await admin.storage.from('recap-videos').remove([recap.winner_video_path])
    return NextResponse.json({ ok: true })
  } catch { return fail('O envio falhou. Tenta novamente.', 500) }
}
