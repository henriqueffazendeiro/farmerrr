import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Que dados o Farmerrr recolhe, porquê, e como os podes apagar.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="setembro de 2026">
      <p>
        O Farmerrr ajuda streamers a acompanhar as visualizações dos clips que a sua comunidade
        publica. Esta página explica, sem rodeios, que dados recolhemos e o que fazemos com eles.
      </p>

      <h2>Que dados recolhemos</h2>
      <p>
        <strong>Do streamer:</strong> email, nome de apresentação e a informação das competições
        que cria (nome, datas, regras, prémios, logo).
      </p>
      <p>
        <strong>Do clipper:</strong> quando liga a conta de TikTok, recolhemos através da API
        oficial o identificador da conta (<em>open&nbsp;id</em>), o nome de utilizador, o nome de
        apresentação e a fotografia de perfil. Recolhemos também, para cada vídeo público
        publicado durante a competição: identificador, ligação, miniatura, legenda, data de
        publicação, duração e o número de visualizações, gostos, comentários e partilhas.
      </p>

      <h2>O que não fazemos</h2>
      <ul>
        <li>Não publicamos, editamos nem apagamos conteúdo em nome de ninguém.</li>
        <li>Não acedemos a mensagens privadas nem a vídeos privados.</li>
        <li>Não vendemos dados a terceiros nem os usamos para publicidade.</li>
        <li>Não recolhemos dados através de <em>scraping</em>: usamos apenas a API oficial.</li>
      </ul>

      <h2>Autorizações pedidas ao TikTok</h2>
      <p>
        Pedimos duas autorizações: <strong>user.info.basic</strong>, para saber quem é a conta que
        se ligou, e <strong>video.list</strong>, para ler a lista de vídeos públicos e as
        respetivas métricas. Nada mais.
      </p>

      <h2>Durante quanto tempo guardamos</h2>
      <p>
        As métricas dos vídeos são guardadas enquanto a competição existir, mais o histórico
        necessário para mostrar a evolução do ranking. Se apagares a tua ligação, apagamos os
        tokens de acesso de imediato e os dados associados no prazo de 30 dias.
      </p>

      <h2>Como desligar a tua conta</h2>
      <p>
        Podes revogar o acesso a qualquer momento nas definições da tua conta de TikTok, ou
        pedir-nos a remoção por email. Podes também remover a autorização a partir da tua página
        de clipper.
      </p>

      <h2>Os teus direitos</h2>
      <p>
        Ao abrigo do RGPD, tens direito a aceder, corrigir, exportar e apagar os teus dados
        pessoais. Basta pedir por email e respondemos no prazo legal.
      </p>

      <h2>Contacto</h2>
      <p>Para qualquer questão sobre privacidade: privacidade@farmerrr.app</p>
    </LegalPage>
  )
}
