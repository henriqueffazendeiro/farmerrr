import { Container } from '@/components/ui/container'

/**
 * Layout partilhado das páginas legais.
 * Estas páginas não são decorativas: os URLs de Termos e Privacidade têm de
 * estar publicados e verificados por domínio para a app review do TikTok.
 */
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: React.ReactNode
}) {
  return (
    <section className="py-16 sm:py-20">
      <Container className="max-w-[720px]">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 text-sm text-fg-subtle">Última atualização: {updatedAt}</p>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-fg-muted [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-fg [&_ul]:space-y-2">
          {children}
        </div>

        <p className="mt-12 rounded-md border border-gold/25 bg-gold/8 p-4 text-xs leading-relaxed text-gold">
          Rascunho técnico. Antes de submeter a app ao TikTok ou de aceitar o primeiro
          pagamento, este texto deve ser revisto por um jurista — as regras de proteção de
          dados e de faturação variam com o país onde a empresa está registada.
        </p>
      </Container>
    </section>
  )
}
