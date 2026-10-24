import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal-page'

export const metadata: Metadata = {
  title: 'Termos de Serviço',
  description: 'As regras de utilização do Farmerrr.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Serviço" updatedAt="setembro de 2026">
      <p>
        Ao usar o Farmerrr concordas com estes termos. Estão escritos para serem lidos, não para
        serem saltados.
      </p>

      <h2>O serviço</h2>
      <p>
        O Farmerrr recolhe, através das APIs oficiais das plataformas, as métricas públicas dos
        vídeos das contas que voluntariamente se ligam a uma competição, e apresenta um ranking.
        Não somos afiliados do TikTok nem de nenhuma outra plataforma.
      </p>

      <h2>Contas</h2>
      <ul>
        <li>És responsável pela atividade da tua conta e por manter a password segura.</li>
        <li>Um clipper liga a sua própria conta e pode desligá-la quando quiser.</li>
        <li>
          O organizador de uma competição pode desqualificar participantes ou excluir vídeos da
          contagem, de acordo com as regras que publicar.
        </li>
      </ul>

      <h2>Competições e prémios</h2>
      <p>
        As competições, as suas regras e os prémios são definidos e atribuídos pelo organizador.
        O Farmerrr é apenas a ferramenta que conta as visualizações — <strong>não organiza as
        competições nem paga prémios</strong>, e não é responsável por disputas entre
        organizadores e participantes.
      </p>

      <h2>Exatidão dos dados</h2>
      <p>
        As métricas vêm das APIs das plataformas e são atualizadas periodicamente. Podem existir
        atrasos ou diferenças face ao que a aplicação da plataforma mostra num dado momento. O
        ranking é apresentado tal como recebido, sem garantia de exatidão em tempo real.
      </p>

      <h2>Uso aceitável</h2>
      <ul>
        <li>Não usar o serviço para atividades ilegais ou para assediar terceiros.</li>
        <li>Não tentar contornar limites técnicos, nem automatizar acessos fora do previsto.</li>
        <li>Não inflacionar métricas artificialmente. Contas suspeitas podem ser suspensas.</li>
      </ul>

      <h2>Subscrição e pagamento</h2>
      <p>
        A subscrição é mensal e renova automaticamente até ser cancelada. O cancelamento produz
        efeito no fim do período já pago. Períodos experimentais não são cobrados se cancelados
        antes do fim.
      </p>

      <h2>Cessação</h2>
      <p>
        Podes apagar a tua conta a qualquer momento. Podemos suspender contas que violem estes
        termos ou os termos das plataformas integradas.
      </p>

      <h2>Contacto</h2>
      <p>suporte@farmerrr.app</p>
    </LegalPage>
  )
}
