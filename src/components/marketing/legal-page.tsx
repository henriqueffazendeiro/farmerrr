import { Container } from '@/components/ui/container'
import { LEGAL } from '@/lib/legal'
import { type LegalIcon } from './legal-icons'
import { LegalSidebar, type SidebarGroup } from './legal-sidebar'

export type LegalSection = { id: string; title: string; content: React.ReactNode }
export type LegalGroup = { title: string; icon: LegalIcon; sections: LegalSection[] }

/** Junta as secções (definidas por ordem) em grupos; falha se faltar ou sobrar alguma. */
export function groupSections(sections: LegalSection[], spec: { title: string; icon: LegalIcon; items: string[] }[]): LegalGroup[] {
  const byId = new Map(sections.map((section) => [section.id, section]))
  const groups = spec.map((group) => ({ title: group.title, icon: group.icon, sections: group.items.map((id) => {
    const section = byId.get(id)
    if (!section) throw new Error(`Secção legal desconhecida: ${id}`)
    byId.delete(id)
    return section
  }) }))
  if (byId.size) throw new Error(`Secções legais sem grupo: ${[...byId.keys()].join(', ')}`)
  return groups
}

/**
 * Layout das páginas legais, em estilo documentação: o conteúdo usa o scroll
 * normal da página; o índice fica fixo à esquerda com scroll próprio (sem barra visível).
 * Os URLs têm de estar publicados e verificados por domínio para a app review do TikTok.
 */
export function LegalPage({ title, groups }: { title: string; groups: LegalGroup[] }) {
  let counter = 0
  const numbered = groups.map((group) => ({ ...group, sections: group.sections.map((section) => ({ ...section, number: ++counter })) }))
  const sidebar: SidebarGroup[] = groups.map((group) => ({ title: group.title, icon: group.icon,
    items: group.sections.map(({ id, title: itemTitle }) => ({ id, title: itemTitle })) }))

  // Mesma largura e margens do Container do site, para alinhar com a barra de navegação e o rodapé.
  return (
    <Container className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-12">
      <nav aria-label="Índice"
        className="hidden overscroll-contain pt-12 pb-16 [scrollbar-width:none]! lg:sticky lg:top-16 lg:block lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto [&::-webkit-scrollbar]:hidden">
        <LegalSidebar groups={sidebar} />
      </nav>

      <div className="min-w-0 py-12 lg:py-10">
        <div className="max-w-[720px]">
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mt-2 text-sm text-fg-subtle">Última atualização: {LEGAL.updatedAt}</p>

          <div className="text-[15px] leading-7 text-fg-muted [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-accent [&_code]:rounded-[3px] [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-fg [&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:text-[15px] [&_h4]:font-medium [&_h4]:text-fg [&_li]:pl-1 [&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            {numbered.map((group) => (
              <div key={group.title} className="mt-14 first:mt-12">
                <h2 className="border-b border-line/60 pb-3 text-[13px] font-semibold text-fg-subtle">{group.title}</h2>
                {group.sections.map((section) => (
                  <section key={section.id} id={section.id} className="scroll-mt-24 pt-8">
                    <h3 className="mb-3 text-lg font-semibold tracking-tight text-fg">{section.number}. {section.title}</h3>
                    {section.content}
                  </section>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Container>
  )
}

/** Tabela com scroll horizontal próprio, para não alargar a página no telemóvel. */
export function LegalTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line">{head.map((cell) => <th key={cell} scope="col" className="py-2 pr-4 font-medium text-fg">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/50 align-top">
              {row.map((cell, j) => <td key={j} className="py-2.5 pr-4">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
