'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { slugify, validateSlug, slugProblemMessage } from '@/lib/slug'

export type CreatorState = { error?: string }

const schema = z.object({
  name: z.string().trim().min(2, 'O nome precisa de pelo menos 2 caracteres.').max(60),
  handle: z.string().trim().min(3).max(40),
})

export async function createCreatorAction(
  _prev: CreatorState,
  formData: FormData,
): Promise<CreatorState> {
  const rawHandle = String(formData.get('handle') ?? '')
  const parsed = schema.safeParse({
    name: formData.get('name'),
    handle: slugify(rawHandle || String(formData.get('name') ?? '')),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const problem = validateSlug(parsed.data.handle)
  if (problem) return { error: slugProblemMessage(problem)! }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { error } = await supabase.from('creators').insert({
    owner_id: user.id,
    name: parsed.data.name,
    handle: parsed.data.handle,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: `O endereço "${parsed.data.handle}" já está ocupado. Escolhe outro.` }
    }
    return { error: 'Não foi possível criar o perfil. Tenta novamente.' }
  }

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}
