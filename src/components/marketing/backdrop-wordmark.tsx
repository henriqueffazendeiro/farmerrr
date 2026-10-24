import { cn } from '@/lib/utils'

/**
 * A marca escrita em grande por trás do conteúdo, quase à cor do fundo — só
 * o suficiente para se adivinhar, nunca para se ler de longe.
 *
 * Desenhada em SVG de propósito: com `textLength` + `lengthAdjust="spacing"`
 * a palavra ocupa **exatamente** a largura da coluna de conteúdo (os mesmos
 * 1100px do Container), qualquer que seja a fonte que o browser acabe por
 * usar. O espaçamento entre letras é só o que sobra para lá chegar — por
 * isso sai subtil, nunca arbitrado à mão.
 *
 * O `size` mexe apenas na altura; o comprimento é sempre o mesmo.
 */
const FONT_SIZE = { sm: 150, md: 200, lg: 260 } as const

export function BackdropWordmark({
  text = 'farmerrr',
  className,
  size = 'md',
}: {
  text?: string
  className?: string
  size?: keyof typeof FONT_SIZE
}) {
  const fontSize = FONT_SIZE[size]
  // A haste do "f" sobe até ~0.73em acima da linha de base; 0.80em dá folga
  // para não ficar rapada no topo.
  const baseline = Math.round(fontSize * 0.8)
  const height = Math.round(fontSize * 0.88)

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden',
        className,
      )}
    >
      {/* Mesma largura e mesmo padding do Container, para a palavra alinhar
          exatamente com as margens do texto. */}
      <div className="w-full max-w-[1100px] px-5 sm:px-8">
        {/* A caixa fica baixa para não empurrar nada; `overflow: visible`
            deixa as hastes das letras desenharem fora dela sem serem cortadas. */}
        <svg
          viewBox={`0 0 1000 ${height}`}
          className="w-full select-none"
          role="presentation"
          style={{ overflow: 'visible' }}
        >
          <text
            x="0"
            y={baseline}
            textLength="1000"
            lengthAdjust="spacing"
            fontSize={fontSize}
            fontWeight={600}
            fill="color-mix(in oklab, var(--color-fg) 3.5%, var(--color-canvas))"
            style={{ fontFamily: 'inherit' }}
          >
            {text}
          </text>
        </svg>
      </div>
    </div>
  )
}
