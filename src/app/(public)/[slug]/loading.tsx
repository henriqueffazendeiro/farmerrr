import { Container } from '@/components/ui/container'

/** Mostrado logo no clique, enquanto o ranking carrega no servidor. */
export default function LeaderboardLoading() {
  return (
    <Container className="py-10">
      <div role="status" aria-busy="true" aria-label="A carregar ranking" className="animate-pulse">
        <div className="h-8 w-48 rounded-sm bg-surface" />
        <div className="mt-3 h-4 w-72 max-w-full rounded-sm bg-surface/70" />
        <div className="mt-10 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-14 rounded-sm border border-line/50 bg-surface/60" />
          ))}
        </div>
      </div>
    </Container>
  )
}
