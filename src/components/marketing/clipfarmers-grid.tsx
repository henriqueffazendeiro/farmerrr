import { Container } from '@/components/ui/container'

type Clipfarmer = {
  name: string
  handle: string
  line: string
}

/**
 * Grelha de clipfarmers, ao estilo da secção de parceiros do momentum.
 *
 * São exemplos — está dito por baixo, em letra pequena. Enquanto não houver
 * clientes reais aqui não entram nomes de gente que não usa o produto.
 */
const EXAMPLES: Clipfarmer[] = [
  { name: 'João Clips', handle: '@joaoclips', line: '8,4M views · 34 clips' },
  { name: 'Miguel Cortes', handle: '@miguelcortes', line: '6,8M views · 27 clips' },
  { name: 'Pedro', handle: '@pedro.clips', line: '4,2M views · 20 clips' },
  { name: 'Diogo', handle: '@diogoclipa', line: '2,8M views · 34 clips' },
  { name: 'André Cuts', handle: '@andrecuts', line: '1,9M views · 28 clips' },
  { name: 'Rita', handle: '@ritaclips', line: '1,2M views · 19 clips' },
  { name: 'Tomás', handle: '@tomasclips', line: '940K views · 12 clips' },
  { name: 'Bea', handle: '@beaclips', line: '610K views · 9 clips' },
]

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function ClipfarmersGrid() {
  return (
    <section className="pb-20 sm:pb-28">
      <Container>
        <p className="text-center text-[11px] font-medium tracking-[0.2em] text-fg-subtle uppercase">
          TOP Clipfarmers
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLES.map((farmer) => (
            <div
              key={farmer.handle}
              className="flex items-center gap-3.5 rounded-lg border border-line bg-surface/70 p-4"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-surface-3 text-xs font-semibold text-fg-muted">
                {initials(farmer.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight text-fg">
                  {farmer.handle}
                </span>
                <span className="nums block truncate text-xs text-fg-muted">{farmer.line}</span>
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-fg-subtle">
          Exemplo de uma competição — cada clipfarmer entra sozinho pelo link de convite
        </p>
      </Container>
    </section>
  )
}
