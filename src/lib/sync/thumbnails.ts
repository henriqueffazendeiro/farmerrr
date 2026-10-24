import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

const BUCKET = 'thumbs'
const MAX_BYTES = 2 * 1024 * 1024

/**
 * Copia a miniatura para o nosso Storage.
 *
 * O `cover_image_url` do TikTok expira em ~6 horas; guardar o link em bruto
 * dá páginas com imagens partidas. Se a cópia falhar devolvemos o URL
 * original — é melhor uma imagem temporária do que nenhuma.
 */
export async function persistThumbnail(
  admin: SupabaseClient<Database>,
  providerVideoId: string,
  sourceUrl: string | null,
): Promise<string | null> {
  if (!sourceUrl) return null

  const path = `${encodeURIComponent(providerVideoId)}.jpg`

  try {
    const response = await fetch(sourceUrl, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!response.ok) return sourceUrl

    const length = Number(response.headers.get('content-length') ?? 0)
    if (length > MAX_BYTES) return sourceUrl

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return sourceUrl

    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: response.headers.get('content-type') ?? 'image/jpeg',
      upsert: true,
    })
    if (error) return sourceUrl

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl ?? sourceUrl
  } catch {
    return sourceUrl
  }
}
