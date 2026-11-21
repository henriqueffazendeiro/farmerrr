import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getMyCreator } from '@/lib/db/queries'
import { getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_SIZE = 5 * 1024 * 1024

export async function POST(request: Request) {
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })
  if (request.headers.get('origin') !== new URL(request.url).origin) return fail('Pedido inválido.', 403)
  const user = await getCurrentUser()
  if (!user) return fail('Inicia sessão para carregar uma imagem.', 401)
  const creator = await getMyCreator()
  if (!creator) return fail('Cria primeiro o teu perfil de criador.', 404)

  try {
    // Bound the body before parsing multipart data.
    const reader = request.body?.getReader()
    if (!reader) return fail('Seleciona uma imagem.')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_SIZE + 65536) {
        await reader.cancel()
        return fail('A imagem deve ter até 5 MB.', 413)
      }
      chunks.push(value)
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
    }).formData()
    const file = form.get('avatar')
    if (!(file instanceof File) || !file.size) return fail('Seleciona uma imagem.')
    if (file.size > MAX_SIZE) return fail('A imagem deve ter até 5 MB.', 413)
    const bytes = Buffer.from(await file.arrayBuffer())
    const extension = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null
    if (!extension) return fail('Usa uma imagem JPG, PNG ou WebP.')

    const admin = createAdminClient()
    const storage = admin.storage.from('thumbs')
    const path = `avatars/${user.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await storage.upload(path, bytes, {
      contentType: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
      upsert: false,
    })
    if (uploadError) return fail('Não foi possível carregar a imagem. Tenta novamente.', 500)
    const { data: { publicUrl } } = storage.getPublicUrl(path)
    const { data, error } = await admin.from('creators').update({ avatar_url: publicUrl })
      .eq('id', creator.id).eq('owner_id', user.id).select('id').maybeSingle()
    if (error || !data) {
      await storage.remove([path])
      return fail('Não foi possível guardar a imagem. Tenta novamente.', 500)
    }
    const prefix = storage.getPublicUrl(`avatars/${user.id}/`).data.publicUrl
    if (creator.avatar_url?.startsWith(prefix)) {
      const previous = creator.avatar_url.slice(prefix.length)
      if (/^[a-f0-9-]+\.(png|jpg|webp)$/.test(previous)) await storage.remove([`avatars/${user.id}/${previous}`])
    }
    revalidatePath('/', 'layout')
    return NextResponse.json({ url: publicUrl })
  } catch {
    return fail('Não foi possível carregar a imagem. Tenta novamente.', 500)
  }
}
