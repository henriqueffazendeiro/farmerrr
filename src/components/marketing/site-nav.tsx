import Link from 'next/link'
import { BrandLogo } from '@/components/ui/brand-logo'
import { ButtonLink } from '@/components/ui/button'
import { Container } from '@/components/ui/container'

const SOCIAL_LINKS = [
  { href: 'https://x.com/farmerrr', label: 'Twitter' },
  { href: 'https://discord.gg/farmerrr', label: 'Discord' },
] as const

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/50 bg-canvas/70 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-center sm:justify-between">
        <Link href="/">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-2 sm:flex">
          {SOCIAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm px-3 py-2 text-sm text-fg-muted transition-colors hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
          <ButtonLink href="/registar" size="sm">
            Começar
          </ButtonLink>
        </nav>
      </Container>
    </header>
  )
}
