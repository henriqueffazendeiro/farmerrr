import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, LegalTable, groupSections, type LegalSection } from '@/components/marketing/legal-page'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Tratamento de dados pessoais no farmerrr.',
  alternates: { canonical: '/legal/privacidade' },
}

const privacy = <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>

const sections: LegalSection[] = [
  {
    id: 'responsavel',
    title: 'Responsável pelo tratamento',
    content: <p>
      {LEGAL.entity}, NIF {LEGAL.taxId}, {LEGAL.address}. Contacto para questões de privacidade: {privacy}.
    </p>,
  },
  {
    id: 'dados',
    title: 'Dados tratados',
    content: <>
      <h4>Streamers</h4>
      <LegalTable head={['Categoria', 'Dados', 'Origem']} rows={[
        ['Conta', 'Email, nome de apresentação; nome e fotografia da conta Google, se usada para entrar', 'Utilizador / Google'],
        ['Autenticação', 'Password, guardada apenas em formato hash', 'Utilizador'],
        ['Página', 'Nome, endereço, imagem de perfil, regras, datas e prémios da competição', 'Utilizador'],
        ['Canais', 'URL, identificador e nome dos canais Twitch, YouTube ou Kick; título, miniatura e horário das lives públicas', 'Utilizador / Plataformas'],
        ['Programa para computador', 'Nome do dispositivo e credencial do dispositivo (cifrada)', 'Utilizador'],
      ]} />
      <h4>Clippers</h4>
      <LegalTable head={['Categoria', 'Dados', 'Origem']} rows={[
        ['Perfil TikTok', 'open_id, nome de utilizador, nome de apresentação, fotografia, ligação ao perfil, seguidores, gostos e número de vídeos', 'TikTok'],
        ['Vídeos', 'Identificador, ligação, miniatura, legenda, data, duração, visualizações, gostos, comentários e partilhas de vídeos públicos', 'TikTok'],
        ['Participação', 'Competições, posição no ranking e estado da participação', 'Serviço'],
        ['Recap', 'Vídeo enviado pelo vencedor mensal', 'Utilizador'],
      ]} />
      <h4>Visitantes</h4>
      <p>Endereço IP, tipo de navegador e registos de pedidos, tratados pelo fornecedor de alojamento.</p>
    </>,
  },
  {
    id: 'finalidades',
    title: 'Finalidades e fundamentos',
    content: <LegalTable head={['Finalidade', 'Fundamento (RGPD, art. 6.º, n.º 1)']} rows={[
      ['Gestão de contas, páginas e competições', 'Execução de contrato — al. b)'],
      ['Ligação ao TikTok e contagem de métricas', 'Execução de contrato — al. b)'],
      ['Apresentação pública de rankings, vídeos e Recaps', 'Execução de contrato — al. b)'],
      ['Apresentação das lives do Streamer', 'Execução de contrato — al. b)'],
      ['Faturação e obrigações fiscais', 'Obrigação legal — al. c)'],
      ['Segurança e prevenção de fraude', 'Interesse legítimo — al. f)'],
      ['Apoio e comunicações sobre o Serviço', 'Execução de contrato e interesse legítimo — als. b) e f)'],
    ]} />,
  },
  {
    id: 'autorizacoes',
    title: 'Autorizações nas Plataformas',
    content: <>
      <p>Apenas são pedidas autorizações de leitura:</p>
      <ul>
        <li>TikTok: <code>user.info.basic</code>, <code>user.info.profile</code>, <code>user.info.stats</code>, <code>video.list</code>.</li>
        <li>Google (login): email, nome e fotografia de perfil.</li>
        <li>YouTube, Twitch, Kick: dados do canal e estado das lives.</li>
      </ul>
      <p>
        O {LEGAL.brand} não publica, edita nem apaga conteúdo, e não acede a mensagens ou vídeos privados. As
        autorizações podem ser revogadas nas definições de cada Plataforma.
      </p>
    </>,
  },
  {
    id: 'publico',
    title: 'Dados públicos',
    content: <>
      <p>As páginas de competição são públicas e mostram:</p>
      <ul>
        <li>nome, imagem e lives públicas do Streamer;</li>
        <li>nome de utilizador, fotografia, vídeos públicos e métricas dos Clippers;</li>
        <li>Recaps mensais, incluindo o vídeo do vencedor.</li>
      </ul>
      <p>Emails, tokens de acesso e restantes dados de conta não são publicados.</p>
    </>,
  },
  {
    id: 'subcontratantes',
    title: 'Subcontratantes',
    content: <>
      <p>Os dados não são vendidos. São partilhados apenas com os seguintes fornecedores:</p>
      <LegalTable head={['Fornecedor', 'Função']} rows={[
        ['Supabase', 'Base de dados, autenticação e armazenamento'],
        ['Vercel', 'Alojamento'],
        ['Google', 'Login com Google e API do YouTube'],
        ['TikTok, Twitch, Kick', 'Dados das contas e canais ligados'],
        ['Prestador de pagamentos', 'Processamento de subscrições'],
      ]} />
      <p>Os dados podem ser comunicados às autoridades quando exigido por lei.</p>
    </>,
  },
  {
    id: 'transferencias',
    title: 'Transferências internacionais',
    content: <p>
      Quando há tratamento fora do Espaço Económico Europeu, aplicam-se as garantias do RGPD: decisões de adequação
      (incluindo o EU-U.S. Data Privacy Framework) ou cláusulas contratuais-tipo.
    </p>,
  },
  {
    id: 'conservacao',
    title: 'Conservação',
    content: <LegalTable head={['Dados', 'Prazo']} rows={[
      ['Conta de Streamer', 'Enquanto a conta estiver ativa; até 30 dias após pedido de eliminação'],
      ['Tokens de acesso do TikTok', 'Eliminados ao desligar a conta'],
      ['Restantes dados do Clipper', 'Até 30 dias após desligar a conta'],
      ['Métricas e rankings', 'Enquanto a competição existir'],
      ['Faturação', '10 anos (obrigação fiscal)'],
      ['Registos técnicos', 'Prazo definido pelo fornecedor de alojamento'],
    ]} />,
  },
  {
    id: 'seguranca',
    title: 'Segurança',
    content: <ul>
      <li>Comunicações cifradas (HTTPS).</li>
      <li>Tokens de acesso guardados cifrados e usados apenas no servidor.</li>
      <li>Passwords guardadas apenas em formato hash.</li>
      <li>Acesso aos dados restringido por regras na base de dados.</li>
    </ul>,
  },
  {
    id: 'cookies',
    title: 'Cookies',
    content: <>
      <p>São usados apenas cookies estritamente necessários. Não são usados cookies de análise nem de publicidade.</p>
      <LegalTable head={['Nome', 'Finalidade', 'Duração']} rows={[
        [<code key="sb">sb-*</code>, 'Sessão do Streamer', 'Até terminar sessão'],
        [<code key="clipper">farmerrr_clipper</code>, 'Sessão do Clipper', '7 dias'],
        [<code key="stream">farmerrr_stream_*</code>, 'Proteção da ligação de canais', '10 minutos'],
        [<code key="notice">onboarding-notice</code>, 'Aviso no fim da configuração (sessionStorage)', 'Até fechar o separador'],
      ]} />
    </>,
  },
  {
    id: 'direitos',
    title: 'Direitos dos titulares',
    content: <>
      <p>
        Acesso, retificação, apagamento, limitação, oposição, portabilidade e retirada de autorização. Os pedidos são
        enviados para {privacy} e respondidos no prazo de um mês.
      </p>
      <p>
        Reclamações podem ser apresentadas à <a href="https://www.cnpd.pt" target="_blank" rel="noreferrer">Comissão Nacional de Proteção de Dados</a>.
      </p>
    </>,
  },
  {
    id: 'menores',
    title: 'Menores',
    content: <p>
      Contas de Streamer: 18 anos ou mais. Clippers: idade mínima do TikTok; menores de 18 anos necessitam de
      autorização dos representantes legais.
    </p>,
  },
  {
    id: 'alteracoes',
    title: 'Alterações',
    content: <p>
      Alterações relevantes são comunicadas por email ou no Serviço antes de entrarem em vigor. Ver também os{' '}
      <Link href="/legal/termos">Termos de Serviço</Link>.
    </p>,
  },
]

const groups = groupSections(sections, [
  { title: 'Geral', icon: 'book', items: ['responsavel'] },
  { title: 'Dados pessoais', icon: 'database', items: ['dados', 'finalidades', 'autorizacoes', 'publico'] },
  { title: 'Partilha e conservação', icon: 'share', items: ['subcontratantes', 'transferencias', 'conservacao'] },
  { title: 'Segurança', icon: 'shield', items: ['seguranca', 'cookies'] },
  { title: 'Direitos', icon: 'scale', items: ['direitos', 'menores', 'alteracoes'] },
])

export default function PrivacyPage() {
  return <LegalPage title="Política de Privacidade" groups={groups} />
}
