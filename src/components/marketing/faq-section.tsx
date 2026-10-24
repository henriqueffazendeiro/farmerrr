'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Container } from '@/components/ui/container'

const QUESTIONS = [
  {
    question: 'O que é o FarmeRRR?',
    answer: 'Trabalhamos com a API do TikTok para acompanhar e contabilizar automaticamente as estatísticas dos clips relacionados com a tua stream. Assim, tens num só lugar uma visão clara do desempenho dos teus clips, dos teus clippers e do alcance que estão a gerar.',
  },
  {
    question: 'Como começo uma competição?',
    answer: 'Defines os prémios e as regras que queres usar. Depois, partilhas a tua página com a comunidade e nós tratamos de acompanhar os clips e atualizar a competição ao longo do mês. BTW, demora apenas 5 minutos.',
  },
  {
    question: 'Como é que os clippers participam?',
    answer: 'Basta clicar no botão “Participar” e ligar a conta de TikTok ao website. A partir daí, os clips publicados ficam associados à competição de forma simples e direta.',
  },
  {
    question: 'Como funcionam os ratings?',
    answer: 'Decidimos criar uma espécie de IMDb das tuas streams, como forma de gerar também mais conteúdo para a tua comunidade. Em cada stream, podes consultar o rating atribuído e rever todos os clips associados.',
  },
  {
    question: 'Como funciona a entrega dos prémios?',
    answer: 'A entrega dos prémios pode ser feita de forma automática, através de depósito, ou manualmente. Nesse caso, podes utilizar o contacto indicado por cada clipper para combinar diretamente a entrega do prémio.',
  },
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 border-t border-line/50 py-20 sm:py-28">
      <Container>
        <div className="flex w-full flex-col gap-10">
          <div>
            <h2 id="faq-title" className="text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">Perguntas frequentes<span className="text-accent">.</span></h2>
          </div>

          <div className="border-t border-line">
            {QUESTIONS.map(({ question, answer }, index) => {
              const isOpen = openIndex === index
              return (
                <div key={question} className="border-b border-line">
                  <h3>
                    <button type="button" id={`faq-question-${index}`} aria-expanded={isOpen} aria-controls={`faq-answer-${index}`} onClick={() => setOpenIndex(isOpen ? null : index)} className="flex w-full cursor-pointer items-center justify-between gap-6 rounded-sm py-6 text-left text-sm font-medium text-fg transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:text-base">
                      {question}
                      <Plus aria-hidden="true" size={18} className={`shrink-0 transition-[rotate,color] duration-300 ease-in-out motion-reduce:transition-none ${isOpen ? 'rotate-45 text-accent' : 'rotate-0 text-fg-subtle'}`} />
                    </button>
                  </h3>
                  <div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} aria-hidden={!isOpen} inert={!isOpen} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="min-h-0 overflow-hidden">
                      <p className="pb-6 text-justify text-sm leading-7 text-fg-muted sm:text-left">{answer}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Container>
    </section>
  )
}
