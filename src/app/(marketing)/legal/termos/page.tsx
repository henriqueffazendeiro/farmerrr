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
        {LEGAL.brand} fornece a ferramenta de contagem e, se o Streamer o escolher, um meio para pagar os prémios
        (ver <a href="#pagamento-premios">Pagamento de prémios</a>). O {LEGAL.brand} não organiza competições, não
        decide vencedores e não é responsável pelo montante dos prémios anunciados.
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
    id: 'pagamento-premios',
    title: 'Pagamento de prémios',
    content: <>
      <p>
        No fim de cada período da competição, o Streamer pode entregar os prémios de forma automática, através do
        Serviço, ou de forma manual, diretamente a cada Clipper. Os vencedores e os valores resultam da classificação
        final do período e dos prémios definidos pelo Streamer.
      </p>
      <p>Pagamento automático:</p>
      <ul>
        <li>O Streamer paga o valor total dos prémios através de um prestador de serviços de pagamento (Stripe), que detém e transfere os fundos. O {LEGAL.brand} não guarda dados bancários nem dados completos de cartões.</li>
        <li>É cobrada uma taxa de serviço de 5% sobre o valor de cada prémio, descontada ao montante recebido pelo Clipper. O Streamer não paga taxas adicionais.</li>
        <li>Para levantar o prémio, o Clipper cria uma conta junto do prestador de pagamentos e fornece os dados exigidos por lei, incluindo identificação e IBAN. O prestador pode pedir verificação adicional e atrasar ou recusar levantamentos, nos termos das suas próprias condições. O prestador pode exigir idade mínima de 18 anos.</li>
        <li>Os prazos de chegada do dinheiro dependem do prestador de pagamentos e do banco do Clipper.</li>
        <li>Os prémios de cada período só podem ser pagos uma vez. Pagamentos em duplicado são reembolsados.</li>
        <li>Se o pagamento do Streamer for reembolsado ou contestado, os prémios ainda não levantados são cancelados.</li>
      </ul>
      <p>Pagamento manual:</p>
      <ul>
        <li>O Streamer paga diretamente a cada Clipper, fora do Serviço, e regista no Serviço que os prémios foram entregues. Não é cobrada taxa.</li>
        <li>O {LEGAL.brand} não intervém, não verifica nem é responsável por estes pagamentos.</li>
      </ul>
      <p>
        Os prémios recebidos podem constituir rendimento sujeito a impostos. Cada Clipper é responsável pelo cumprimento
        das suas obrigações fiscais.
      </p>
    </>,
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
      <p>
        O software, o código-fonte, o design, a interface, os textos, os logótipos e a marca {LEGAL.brand} são
        propriedade do {LEGAL.brand} ou dos seus licenciadores e estão protegidos pelo Código do Direito de Autor e dos
        Direitos Conexos e pela legislação de propriedade industrial.
      </p>
      <p>Salvo autorização prévia e escrita do {LEGAL.brand}, não é permitido:</p>
      <ul>
        <li>copiar, reproduzir, modificar, distribuir ou publicar o Serviço ou qualquer parte dele, incluindo o código, o design e a interface;</li>
        <li>criar obras derivadas, imitações ou um serviço concorrente com base no Serviço;</li>
        <li>descompilar, desmontar ou fazer engenharia inversa do software, salvo nos casos expressamente permitidos por lei;</li>
        <li>utilizar a marca {LEGAL.brand} ou sinais semelhantes suscetíveis de causar confusão.</li>
      </ul>
      <p>
        O facto de parte do código ser transmitida para o navegador para o Serviço funcionar não confere qualquer licença
        de utilização. A violação destas regras pode levar à suspensão ou encerramento da conta e ao recurso aos meios
        legais adequados, incluindo pedidos de remoção junto dos prestadores de alojamento.
      </p>
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
        organização das competições, pela entrega de prémios em pagamento manual, por decisões do prestador de
        pagamentos, por falhas das Plataformas ou por conteúdo publicado pelos Utilizadores.
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
  { title: 'Pagamentos', icon: 'card', items: ['planos', 'pagamento-premios', 'livre-resolucao'] },
  { title: 'Regras de utilização', icon: 'shield', items: ['uso-aceitavel', 'conteudo', 'terceiros', 'disponibilidade', 'cessacao'] },
  { title: 'Disposições legais', icon: 'scale', items: ['responsabilidade', 'alteracoes', 'lei', 'contactos'] },
])

export default function TermsPage() {
  return <LegalPage title="Termos de Serviço" groups={groups} />
}
