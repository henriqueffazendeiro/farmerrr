import Link from 'next/link'
import { Container } from '@/components/ui/container'

const SOCIAL_LINKS = [
  { href: 'https://x.com/farmerrr', label: 'X (Twitter)', icon: XIcon },
  { href: 'https://discord.gg/farmerrr', label: 'Discord', icon: DiscordIcon },
] as const

const FOOTER_GROUPS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: 'Produto',
    links: [
      { href: '/#como-funciona', label: 'Como funciona' },
      { href: '/#como-funciona', label: 'Demo' },
      { href: '/#precos', label: 'Preços' },
      { href: '/luisferreira/recap', label: 'Recap' },
      { href: '/#como-funciona', label: 'Leaderboard' },
      { href: '/registar', label: 'Criar competição' },
    ],
  },
  {
    title: 'Comunidade',
    links: [
      { href: '/#comunidade', label: 'Para streamers' },
      { href: '/#como-funciona', label: 'Para clippers' },
      { href: '/#ecossistema', label: 'O Ecossistema' },
      { href: 'https://discord.gg/farmerrr', label: 'Discord', external: true },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { href: '/#faq', label: 'FAQ' },
      { href: '/#faq', label: 'Ajuda' },
      { href: 'mailto:suporte@farmerrr.app', label: 'Contacto', external: true },
      { href: '/#ecossistema', label: 'Integrações' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/termos', label: 'Termos de Serviço' },
      { href: '/legal/privacidade', label: 'Política de Privacidade' },
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line/50 bg-canvas pt-16 sm:pt-20">
      <Container className="relative z-10">
        <div className="grid gap-10 border-b border-line/50 pb-12 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="max-w-md">
            <span className="inline-flex h-8 w-[79.8px] items-center whitespace-nowrap text-[18px] font-semibold tracking-[-0.04em] text-white select-none">
              <span className="inline-flex items-baseline gap-[4px] leading-none">
                <span>farme</span><span className="shrink-0 rounded-[calc(var(--radius-ui)/2)] bg-accent px-[4px] py-[2px] text-black">rrr.</span>
              </span>
            </span>
            <p className="mt-5 text-sm leading-relaxed text-fg-muted">
              Juntamos streamers e clippers num ranking vivo, com views contadas,
              competições partilháveis e momentos prontos para voltar à stream.
            </p>
          </div>

          <nav aria-label="Redes sociais" className="flex gap-3 lg:justify-end">
            {SOCIAL_LINKS.map((link) => {
              const Icon = link.icon

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={link.label}
                  className="grid h-10 w-10 place-items-center rounded-xs border border-line text-fg-muted transition-colors hover:border-accent/50 hover:text-accent"
                >
                  <Icon />
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-semibold text-fg">{group.title}</h2>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noreferrer' : undefined}
                      className="text-sm text-fg-muted transition-colors hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-line/50 py-6">
          <p className="text-sm text-fg-subtle">
            © 2026 FarmeRRR. Todos os direitos reservados.
          </p>
        </div>
      </Container>

      <div
        aria-hidden
        className="pointer-events-none mt-2 flex justify-center overflow-hidden px-5 pb-4 select-none sm:px-8"
      >
        <svg
          viewBox="0 0 1000 190"
          className="w-full max-w-[1100px]"
          role="presentation"
          style={{ overflow: 'visible' }}
        >
          <text
            x="0"
            y="160"
            textLength="1000"
            lengthAdjust="spacing"
            fontSize={200}
            fontWeight={600}
            fill="color-mix(in oklab, var(--color-fg) 3.5%, var(--color-canvas))"
            style={{ fontFamily: 'inherit' }}
          >
            farmerrr
          </text>
        </svg>
      </div>
    </footer>
  )
}

function XIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M13.8 10.5 21 2h-1.7l-6.2 7.3L8.1 2H2.4l7.6 11.1L2.4 22h1.7l6.7-7.8 5.3 7.8h5.7l-8-11.5Zm-2.4 2.8-.8-1.1L4.5 3.3h2.8l4.9 7.1.8 1.1 6.4 9.3h-2.8l-5.2-7.5Z" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M19.5 5.3A16 16 0 0 0 15.6 4l-.5 1.1a14.7 14.7 0 0 0-4.3 0L10.3 4a16 16 0 0 0-3.9 1.3C4 8.8 3.4 12.2 3.7 15.6a16 16 0 0 0 4.8 2.4l1-1.6a10.2 10.2 0 0 1-1.6-.8l.4-.3a11.5 11.5 0 0 0 7.4 0l.4.3a10.2 10.2 0 0 1-1.6.8l1 1.6a16 16 0 0 0 4.8-2.4c.4-4-.6-7.3-2.8-10.3ZM9.3 13.6c-.9 0-1.6-.8-1.6-1.8S8.4 10 9.3 10s1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm5.4 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z" />
    </svg>
  )
}
