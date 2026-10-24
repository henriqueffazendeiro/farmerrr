import { Database } from 'lucide-react'

/** Mostrado quando ainda não há credenciais do Supabase em .env.local. */
export function SetupNotice() {
  return (
    <div className="rounded-lg border border-gold/25 bg-gold/8 p-5">
      <Database className="h-5 w-5 text-gold" strokeWidth={1.8} />
      <h2 className="mt-3 text-sm font-semibold text-fg">Falta ligar a base de dados</h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        Cria um projeto no Supabase, corre as migrações de{' '}
        <code className="text-fg">supabase/migrations/</code> e preenche{' '}
        <code className="text-fg">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
        <code className="text-fg">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> e{' '}
        <code className="text-fg">SUPABASE_SERVICE_ROLE_KEY</code> em{' '}
        <code className="text-fg">.env.local</code>.
      </p>
      <p className="mt-3 text-xs text-fg-subtle">
        Os passos detalhados estão no README, secção “Ligar o Supabase”.
      </p>
    </div>
  )
}
