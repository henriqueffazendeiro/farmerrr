import { Container } from '@/components/ui/container'

export default function NewLeaderboardLoading() {
  return (
    <Container className="py-10">
      <div role="status" aria-busy="true" aria-label="A carregar" className="mx-auto max-w-xl animate-pulse">
        <div className="h-2 rounded-full bg-surface" />
        <div className="mt-8 h-8 w-64 max-w-full rounded-sm bg-surface" />
        <div className="mt-6 h-40 rounded-sm border border-line/50 bg-surface/60" />
      </div>
    </Container>
  )
}
