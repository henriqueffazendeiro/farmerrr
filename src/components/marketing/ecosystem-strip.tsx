import { cn } from '@/lib/utils'
import { Container } from '@/components/ui/container'

const PLATFORMS: { name: string; logoSrc: string; className?: string }[] = [
  {
    name: 'Twitch',
    logoSrc:
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/Twitch_logo_(wordmark_only).svg',
  },
  {
    name: 'YouTube',
    logoSrc:
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/YouTube_2024_(white_text).svg',
  },
  {
    name: 'Kick',
    logoSrc: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Kick_logo.svg',
  },
  {
    name: 'TikTok',
    logoSrc: '/tiktok-logo-white-cropped.png',
    className: 'h-8 max-w-36',
  },
] as const

export function EcosystemStrip() {
  return (
    <section id="ecossistema" className="scroll-mt-20 bg-canvas py-8">
      <Container className="grid gap-6 overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-fg sm:text-3xl">
            O Ecossistema
          </h2>
        </div>

        <div className="relative min-w-0 max-w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="ecosystem-marquee flex w-max items-center gap-4">
            <LogoSet />
            <LogoSet ariaHidden />
          </div>
        </div>
      </Container>
    </section>
  )
}

function LogoSet({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div aria-hidden={ariaHidden} className="flex items-center gap-4">
      {PLATFORMS.map((platform) => {

        return (
          <div
            key={platform.name}
            className="flex h-16 w-44 shrink-0 items-center justify-center px-4"
          >
            <img
              src={platform.logoSrc}
              alt={platform.name}
              width={128}
              height={40}
              draggable={false}
              className={cn('w-auto object-contain', platform.className ?? 'h-8 max-w-32')}
              decoding="async"
            />
          </div>
        )
      })}
    </div>
  )
}
