import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, groupSections, type LegalSection } from '@/components/marketing/legal-page'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Termos de Serviço',
  description: 'Condições de utilização do farmerrr.',
  alternates: { canonical: '/legal/termos' },
}

const support = <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>

const sections: LegalSection[] = [
  {
    id: 'ambito',
    title: 'Âmbito',
    content: <>
      <p>
        O {LEGAL.brand} é explorado por {LEGAL.entity}, NIF {LEGAL.taxId}, com sede em {LEGAL.address}.
      </p>
      <p>
        Estes Termos regulam a utilização do site, das páginas de competição, do painel do streamer e do programa para
        computador (o &quot;Serviço&quot;). O tratamento de dados pessoais é descrito na{' '}
        <Link href="/legal/privacidade">Política de Privacidade</Link>.
      </p>
    </>,
  },
  {
    id: 'definicoes',
    title: 'Definições',
    content: <ul>
      <li>Streamer: titular de uma conta que organiza uma competição.</li>
      <li>Clipper: titular de uma conta TikTok que participa numa competição.</li>
      <li>Competição: página pública com o ranking, as regras e os prémios definidos pelo Streamer.</li>
      <li>Plataformas: serviços de terceiros integrados, como TikTok, Twitch, YouTube e Kick.</li>
    </ul>,
  },
  {
    id: 'elegibilidade',
    title: 'Aceitação e elegibilidade',
    content: <>
      <p>A utilização do Serviço implica a aceitação destes Termos.</p>
      <ul>
        <li>Streamers: idade mínima de 18 anos.</li>
        <li>Clippers: idade mínima exigida pelo TikTok. Menores de 18 anos necessitam de autorização dos representantes legais, incluindo para receber prémios.</li>
        <li>Quem utilize o Serviço em nome de uma empresa declara ter poderes para a vincular.</li>
      </ul>
    </>,
  },
  {
    id: 'contas',
    title: 'Contas',
    content: <ul>
      <li>Os Streamers registam-se com email e password ou com uma conta Google.</li>
      <li>Os Clippers acedem através da autorização oficial do TikTok. A password do TikTok não é partilhada com o {LEGAL.brand}.</li>
      <li>O titular é responsável pela segurança das credenciais e pela atividade da conta.</li>
      <li>Cada conta de Streamer tem uma competição.</li>
      <li>O Clipper pode desligar a conta TikTok a qualquer momento.</li>
    </ul>,
  },
  {
    id: 'servico',
    title: 'Descrição do Serviço',
    content: <>
      <p>
        O Serviço apresenta o ranking dos Clippers de uma competição com base nas métricas públicas dos seus vídeos,
        mostra as lives do Streamer e gera resumos mensais (Recap).
      </p>
      <ul>
        <li>As métricas são obtidas através das APIs oficiais das Plataformas, com autorização do titular da conta, ou a partir de dados públicos do canal.</li>
        <li>O programa para computador consulta apenas dados públicos dos canais ligados pelo próprio Streamer.</li>
        <li>O {LEGAL.brand} não é afiliado ao TikTok, à Twitch, à Google/YouTube nem ao Kick.</li>
      </ul>
    </>,
  },
  {
    id: 'competicoes',
    title: 'Competições e prémios',
    content: <>
      <p>
        As competições são organizadas exclusivamente pelo Streamer, que define datas, regras e prémios. O{' '}
        {LEGAL.brand} fornece apenas a ferramenta de contagem e não organiza competições nem paga prémios.
      </p>
      <ul>
        <li>O Streamer é responsável por publicar as regras, cumpri-las e entregar os prémios anunciados, de acordo com a lei aplicável.</li>
        <li>O Streamer pode desqualificar Clippers ou excluir vídeos da contagem, de acordo com as regras publicadas.</li>
        <li>Reclamações sobre prémios devem ser dirigidas ao Streamer.</li>
        <li>O nome de utilizador, a fotografia de perfil, os vídeos públicos e as métricas do Clipper são mostrados na página da competição e nos Recaps.</li>
      </ul>
    </>,
  },
  {
    id: 'metricas',
    title: 'Métricas',
    content: <p>
      As métricas são atualizadas periodicamente a partir dos dados das Plataformas e podem apresentar atrasos ou
      diferenças face às aplicações das Plataformas. O {LEGAL.brand} pode corrigir erros e recalcular rankings, mas não
      garante a exatidão dos dados fornecidos pelas Plataformas.
    </p>,
  },
  {
    id: 'planos',
    title: 'Planos e pagamentos',
    content: <ul>
      <li>Planos mensal e anual, aos preços indicados em <Link href="/precos">Preços</Link> na data de contratação, com impostos incluídos.</li>
      <li>Período experimental de 14 dias. O cancelamento durante este período não gera cobrança.</li>
      <li>A subscrição renova automaticamente por períodos iguais até ser cancelada.</li>
      <li>Alterações de preço são comunicadas com 30 dias de antecedência.</li>
      <li>O cancelamento produz efeito no fim do período pago.</li>
      <li>Períodos iniciados não são reembolsados, salvo o disposto na secção seguinte ou na lei.</li>
      <li>A falta de pagamento pode levar à suspensão das funcionalidades pagas.</li>
      <li>Os pagamentos são processados por um prestador de serviços de pagamento. O {LEGAL.brand} não guarda dados completos de cartões.</li>
    </ul>,
  },
  {
    id: 'livre-resolucao',
    title: 'Livre resolução',
    content: <p>
      Os consumidores podem resolver o contrato no prazo de 14 dias após a celebração, sem indicar motivo, nos termos
      do Decreto-Lei n.º 24/2014, através de comunicação para {support}. Se o Serviço pago tiver começado a pedido do
      consumidor durante esse prazo, é devido o valor proporcional ao período utilizado. O reembolso é feito em 14 dias,
      pelo meio de pagamento original.
    </p>,
  },
  {
    id: 'uso-aceitavel',
    title: 'Uso aceitável',
    content: <>
      <p>Não é permitido:</p>
      <ul>
        <li>inflacionar métricas por meios artificiais (bots, visualizações compradas, redes de contas);</li>
        <li>publicar conteúdo ilegal ou que viole direitos de terceiros ou os termos das Plataformas;</li>
        <li>ligar contas de terceiros ou fazer-se passar por outra pessoa;</li>
        <li>aceder a dados ou áreas sem autorização, ou contornar limites técnicos;</li>
        <li>extrair dados de forma automatizada, fazer engenharia inversa ou sobrecarregar o Serviço.</li>
      </ul>
    </>,
  },
  {
    id: 'conteudo',
    title: 'Conteúdo e propriedade intelectual',
    content: <>
      <p>
        O Utilizador mantém os direitos sobre o conteúdo que fornece e concede ao {LEGAL.brand} uma licença não
        exclusiva e gratuita para o alojar e apresentar no âmbito do Serviço. A licença cessa com a remoção do conteúdo.
      </p>
      <p>O software, o design e a marca {LEGAL.brand} são propriedade do {LEGAL.brand} ou dos seus licenciadores.</p>
    </>,
  },
  {
    id: 'terceiros',
    title: 'Serviços de terceiros',
    content: <p>
      O Serviço depende das Plataformas e de fornecedores de infraestrutura, cujos termos se aplicam. Alterações ou
      limitações nas APIs das Plataformas podem afetar funcionalidades do Serviço.
    </p>,
  },
  {
    id: 'disponibilidade',
    title: 'Disponibilidade',
    content: <p>
      O Serviço pode ser interrompido por manutenção, falhas técnicas ou causas externas. Funcionalidades podem ser
      alteradas ou descontinuadas. Uma redução significativa do Serviço pago é comunicada com antecedência e permite o
      cancelamento com reembolso proporcional.
    </p>,
  },
  {
    id: 'cessacao',
    title: 'Suspensão e cessação',
    content: <>
      <p>O Utilizador pode pedir a eliminação da conta a qualquer momento através de {support}.</p>
      <p>
        O {LEGAL.brand} pode suspender ou encerrar contas em caso de violação destes Termos ou dos termos das
        Plataformas, fraude, manipulação de métricas, ordem de autoridade ou risco para a segurança do Serviço.
      </p>
    </>,
  },
  {
    id: 'responsabilidade',
    title: 'Responsabilidade',
    content: <>
      <p>
        Na medida permitida por lei, o {LEGAL.brand} não responde por danos indiretos ou lucros cessantes, pela
        organização das competições e entrega de prémios, por falhas das Plataformas ou por conteúdo publicado pelos
        Utilizadores.
      </p>
      <p>
        Esta limitação não se aplica em caso de dolo, culpa grave ou danos à vida e à saúde, nem afasta os direitos
        imperativos dos consumidores.
      </p>
    </>,
  },
  {
    id: 'alteracoes',
    title: 'Alterações',
    content: <p>
      Alterações relevantes a estes Termos são comunicadas por email ou no Serviço com 15 dias de antecedência.
    </p>,
  },
  {
    id: 'lei',
    title: 'Lei aplicável e litígios',
    content: <>
      <p>
        Aplica-se a lei portuguesa, sem prejuízo das normas imperativas de proteção do consumidor do país de residência.
      </p>
      <ul>
        <li>Resolução alternativa de litígios de consumo: {LEGAL.adrEntity}. Informação em <a href="https://www.consumidor.gov.pt" target="_blank" rel="noreferrer">consumidor.gov.pt</a>.</li>
        <li><a href="https://www.livroreclamacoes.pt" target="_blank" rel="noreferrer">Livro de Reclamações Eletrónico</a>.</li>
        <li>Tribunais competentes: os tribunais portugueses, salvo disposição legal em contrário.</li>
      </ul>
    </>,
  },
  {
    id: 'contactos',
    title: 'Contactos',
    content: <ul>
      <li>Apoio: {support}</li>
      <li>Privacidade: <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a></li>
      <li>Morada: {LEGAL.address}</li>
    </ul>,
  },
]

const groups = groupSections(sections, [
  { title: 'Geral', icon: 'book', items: ['ambito', 'definicoes', 'elegibilidade'] },
  { title: 'Conta e serviço', icon: 'grid', items: ['contas', 'servico', 'competicoes', 'metricas'] },
  { title: 'Pagamentos', icon: 'card', items: ['planos', 'livre-resolucao'] },
  { title: 'Regras de utilização', icon: 'shield', items: ['uso-aceitavel', 'conteudo', 'terceiros', 'disponibilidade', 'cessacao'] },
  { title: 'Disposições legais', icon: 'scale', items: ['responsabilidade', 'alteracoes', 'lei', 'contactos'] },
])

export default function TermsPage() {
  return <LegalPage title="Termos de Serviço" groups={groups} />
}
