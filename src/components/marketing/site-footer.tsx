import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { SOCIAL_LINKS } from './site-nav'

type FooterLink = { href: string; label: string; external?: boolean }

// Cada link aponta para um sítio diferente que existe mesmo. As secções da
// página inicial (#como-funciona, #ecossistema, #precos, #faq) estão em (marketing)/page.tsx.
const FOOTER_GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Produto',
    links: [
      { href: '/#como-funciona', label: 'Como funciona' },
      { href: '/#ecossistema', label: 'Integrações' },
      { href: '/precos', label: 'Preços' },
      { href: '/entrar?seguinte=/dashboard/novo', label: 'Criar competição' },
    ],
  },
  {
    title: 'Comunidade',
    links: SOCIAL_LINKS.map((link) => ({ ...link, external: true })),
  },
  {
    title: 'Recursos',
    links: [
      { href: '/#faq', label: 'Perguntas frequentes' },
      { href: 'mailto:suporte@farmerrr.app', label: 'Contacto' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/termos', label: 'Termos de Serviço' },
      { href: '/legal/privacidade', label: 'Política de Privacidade' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line/50 bg-canvas pt-16 sm:pt-20">
      <Container className="relative z-10">
        <div className="border-b border-line/50 pb-12">
          <div className="max-w-md">
            <Link href="/" aria-label="farmerrr — página inicial" className="inline-flex h-8 w-[79.8px] items-center whitespace-nowrap text-[18px] font-semibold tracking-[-0.04em] text-white select-none">
              <span className="inline-flex items-baseline gap-[4px] leading-none">
                <span>farme</span><span className="shrink-0 rounded-[calc(var(--radius-ui)/2)] bg-accent px-[4px] py-[2px] text-black">rrr.</span>
              </span>
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-fg-muted">
              Juntamos streamers e clippers num ranking vivo, com views contadas,
              competições partilháveis e momentos prontos para voltar à stream.
            </p>
          </div>

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
            © {new Date().getFullYear()} farmerrr. Todos os direitos reservados.
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
