'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { publicEnv } from '@/lib/config/env'

export type AuthState = { error?: string; notice?: string }

const credentials = z.object({
  email: z.string().email('Escreve um email válido.'),
  password: z.string().min(8, 'A password precisa de pelo menos 8 caracteres.'),
})

const signUpSchema = credentials.extend({
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, { message: 'As passwords não coincidem.' })

/** Traduz os erros mais comuns do Supabase Auth. */
function translate(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email ou password errados.'
  if (m.includes('email not confirmed')) return 'Confirma o email antes de entrar.'
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Já existe uma conta com esse email. Tenta entrar.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiadas tentativas. Espera um minuto e tenta outra vez.'
  }
  if (m.includes('password')) return 'Password demasiado fraca.'
  return 'Não foi possível concluir. Tenta novamente.'
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: translate(error.message) }

  const next = String(formData.get('next') || '/dashboard')
  revalidatePath('/', 'layout')
  redirect(next.startsWith('/') ? next : '/dashboard')
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const next = String(formData.get('next') || '/dashboard')
  const destination = next.startsWith('/') ? next : '/dashboard'

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Sem nome no registo: o trigger handle_new_user usa a parte do email antes do @.
      // O destino viaja no link do email para o separador que o abre também
      // acabar no sítio certo.
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(destination)}`,
    },
  })
  if (error) return { error: translate(error.message) }

  // Com a confirmação de email ativa no Supabase, ainda não há sessão.
  if (!data.session) {
    return {
      notice: 'Enviámos-te um email para confirmares a conta. Abre o link que lá está.',
    }
  }

  revalidatePath('/', 'layout')
  redirect(destination)
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
