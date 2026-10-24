# Recap mensal

Página pública: `/{slug}/recap`. A query `?mes=YYYY-MM` abre uma edição específica.
Sem Supabase, `/luisferreira/recap` usa o último mês fechado de demonstração.
As outras edições continuam acessíveis através de `?mes=YYYY-MM`.

## Primeira versão visual

Nesta fase estão disponíveis apenas três cenas: abertura,
antecipação das views e revelação do total. O botão Monthly Recap na página da
comunidade abre esta experiência independente. As restantes cenas aguardam validação.

O palco ocupa toda a largura e altura da janela, sem limite de proporção. Não há
scroll nem avanço automático: direita/Espaço avançam; esquerda volta; as margens,
setas e três pontos de progresso também permitem navegar. Os controlos aparecem
ao mover o rato e desaparecem após 1,6 segundos de inatividade. As setas também
aparecem junto às margens; o foco de teclado mantém cada controlo acessível.
Ecrã inteiro e saída estão no canto superior direito. Na última cena, o ícone
no canto inferior direito permite rever a abertura.

O conteúdo principal está centrado horizontal e verticalmente em todas as cenas.
A abertura reúne o logótipo, «MONTHLY RECAP» e a edição mensal no centro; nas
restantes cenas o logótipo desaparece. Não existem cabeçalho, rodapé, selo DEMO,
nome do streamer, instruções ou contador de cenas no palco. Os dados de demonstração
continuam limitados à comunidade demo.

A paleta usa os tokens do site: quase preto como base, branco/off-white para o
conteúdo e laranja apenas nos detalhes. Não há superfícies laranja permanentes.
O centro é reservado à leitura; o movimento ocupa a periferia da composição.

As animações decorativas usam sobretudo transform e opacity. O contador atualiza
apenas o seu texto e a intensidade do cenário, sem renderizar a árvore React a cada
frame. A sua aceleração alimenta os traços radiais; no final, uma onda
de impacto dá lugar a movimento ambiente mais lento. As animações CSS pausam quando
o separador fica oculto.

`prefers-reduced-motion` elimina animações e apresenta o valor final diretamente.
As mesmas frases e composições ficam disponíveis. O Espaço em botões mantém a
ação nativa do botão; campos de formulário e controlos de vídeo ficam livres para
as interações das próximas cenas.
O total vem do snapshot mensal existente, sem valores de apresentação inventados.

### Sistema de cenas e transições

`src/components/recap/use-recap-navigation.ts` concentra a navegação manual, os
limites e o bloqueio de entradas repetidas durante uma transição. A lista `scenes`
em `recap-experience.tsx` define as cenas disponíveis e os nomes acessíveis.
As transições que envolvem a abertura expandem um círculo; entre a antecipação
e as views, três barras alargam-se até preencher o ecrã. As formas assumem a cor
do destino e tornam-se o seu fundo. O conteúdo muda aos 450 ms, com o palco
totalmente coberto. Não há fade de página. Com movimento reduzido,
a troca é imediata. Não existem temporizadores de avanço automático entre cenas.

A abertura usa círculos segmentados centrados à volta do título, com rotações
independentes e oscilações de escala. A antecipação apresenta «VOCÊS CLIPARAM.
NÓS CONTÁMOS.» em duas linhas centradas, entre faixas que circulam nas margens
superior e inferior. As views mantêm os 36 elementos radiais, a rotação, a pulsação,
a reação ao contador e a onda de impacto: número branco sobre preto, linhas
brancas e cinzento escuro, com apenas seis traços laranja. Cada grafismo continua
em movimento enquanto o streamer mantém a cena. As restantes cenas não estão ativadas.

## Ativação

1. Configurar as variáveis de Supabase, TikTok, `CLIPPER_SESSION_SECRET` e `CRON_SECRET` indicadas em `.env.example`. Usar `SOCIAL_PROVIDER=tiktok`; o provider simulado não autoriza a publicação do vídeo.
2. Aplicar `supabase/migrations/0006_monthly_recaps.sql` depois das migrações existentes.
3. Publicar com o cron de `vercel.json`. `/api/cron/recaps` corre à hora e cinco,
   autenticado com `Authorization: Bearer <CRON_SECRET>`. Pode ser invocado pelo
   operador com a mesma autenticação para gerar as primeiras edições.

## Resultados

O fecho respeita o fuso horário de cada competição mensal. Só entram vídeos
publicados dentro do mês e das datas da competição, nas plataformas permitidas,
de participantes ativos, sem vídeos apagados ou excluídos.

O snapshot usa **as métricas sincronizadas disponíveis quando é gerado**; não
representa o aumento de views ocorrido exclusivamente durante o mês. Ao ativar
pela primeira vez, as edições anteriores usam as métricas disponíveis nessa data.
O momento de captura fica guardado no snapshot. Repetir o cron não altera edições existentes.

O vencedor soma as views de todos os seus clips. Os desempates seguem o ranking:
mais clips, depois ID de participante. Os prémios de likes e partilhas consideram
todos os vídeos elegíveis, independentemente do número de views. O clipper mais
ativo é quem publicou mais clips. Meses vazios não têm vencedor.

## Vídeo do vencedor

A infraestrutura abaixo está preservada, mas a cena e os controlos de envio não
fazem parte desta primeira versão visual.

Entrar com TikTok no último slide estabelece uma sessão assinada, HttpOnly e
válida por sete dias. O endpoint verifica a identidade contra o vencedor do
snapshot, valida origem, tamanho e duração MP4 no servidor e guarda o ficheiro
num bucket privado. O recap recebe um URL assinado válido por uma hora; recarregar
a página renova esse URL. Substituir um vídeo remove o ficheiro anterior.

Limites: MP4 convencional, até 30 segundos e 4 MiB. O limite de tamanho permite
enviar pelo endpoint em alojamentos com limite de corpo próximo de 4,5 MB.
O vídeo é publicado diretamente pelo vencedor. A experiência é um recap web
partilhável, com ecrã inteiro; não exporta uma montagem MP4.

## Verificação

`node --test scripts/test-recap.cjs` verifica agregação, prémios independentes,
desempates, mês vazio e validação de duração/formato. `npm run typecheck` valida
os tipos. A migração deve ser aplicada ao Supabase para testar OAuth, cron e
publicação de vídeos com contas reais.

Com o servidor local ativo, `node scripts/check-recap-browser.cjs` verifica as três
cenas em Edge/Playwright: conteúdo centrado, fundo preto, texto branco, ausência
de logótipo permanente, controlos ocultos em repouso, movimento efetivo após
20 segundos em cada cena, navegação manual, bloqueio de teclas repetidas durante
transições, contador, repetição, ecrã inteiro, Espaço com foco
num botão, movimento reduzido, proporção 16:9 e ausência de scroll. Guarda capturas
em `.next/recap-*.png`. `RECAP_BASE_URL` permite testar noutra porta/origem.
