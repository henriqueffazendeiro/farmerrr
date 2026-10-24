import type { Metadata } from 'next'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { getMyCreator, getMyProfile } from '@/lib/db/queries'
import { signOutAction } from '@/lib/auth/actions'
import { StreamConnections } from '@/components/dashboard/stream-connections'

export const metadata: Metadata = { title: 'Conta' }

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ streams?: string }> }) {
  const { streams } = await searchParams
  const [profile, creator] = await Promise.all([getMyProfile(), getMyCreator()])

  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          <Row label="Email" value={profile?.email ?? '—'} />
          <Row label="Nome" value={profile?.display_name ?? '—'} />
          <Row label="Creator" value={creator?.name ?? '—'} />
          <Row label="Endereço público" value={creator ? `/${creator.handle}` : '—'} />
        </CardBody>
      </Card>

      {creator && <StreamConnections creatorId={creator.id} notice={streams} />}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Subscrição</CardTitle>
        </CardHeader>
        <CardBody className="text-sm text-fg-muted">
          A faturação entra na última etapa. Por agora tens acesso completo.
        </CardBody>
      </Card>

      <form action={signOutAction} className="mt-8">
        <Button type="submit" variant="secondary">
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Terminar sessão
        </Button>
      </form>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/50 pb-3 last:border-0 last:pb-0">
      <span className="text-fg-subtle">{label}</span>
      <span className="truncate text-fg">{value}</span>
    </div>
  )
}
