# Agendamento externo

vercel.json não regista crons internos. Publicar o site não inicia a sincronização.
Para desenvolvimento pessoal/testes no plano Hobby, um agendador externo pode
chamar as rotas existentes. O processamento continua a consumir recursos da Vercel,
Supabase e APIs. Vercel Hobby é limitado a utilização pessoal não comercial.

## cron-job.org

Depois do deploy, criar uma conta e configurar quatro tarefas GET no domínio
de produção (substituir DOMINIO pelo endereço real). Não usar URLs de preview.

| Tarefa | URL | Intervalo inicial |
| --- | --- | --- |
| Detetar lives | https://DOMINIO/api/cron/streams | 1 minuto |
| Agendar clippers | https://DOMINIO/api/cron/schedule | 15 minutos |
| Processar clippers | https://DOMINIO/api/cron/sync?limit=1 | 1 minuto |
| Gerar recaps | https://DOMINIO/api/cron/recaps | 1 hora |

Em cada tarefa, adicionar o cabeçalho HTTP Authorization com o valor
`Bearer VALOR_DO_CRON_SECRET`. Usar o mesmo CRON_SECRET configurado nas variáveis
de ambiente de produção da Vercel. Não colocar este segredo no URL ou no GitHub.

Antes de ativar os agendamentos:

1. Aplicar as migrações Supabase pendentes e configurar as variáveis de produção.
2. Fazer Test run em cada tarefa. Deve devolver HTTP 200 e o resultado esperado,
   não uma página HTML de login, redirect, challenge ou autenticação da Vercel.
3. Testar uma conta autorizada em live e uma importação real de vídeos.
4. Ativar as tarefas e acompanhar o histórico de execuções e os limites de uso.

O cron-job.org espera até 30 segundos pela resposta. O processamento de clippers
usa limit=1 para reduzir cada lote, mas uma primeira importação ou uma plataforma
lenta ainda pode ultrapassar esse tempo. Se acontecer, é necessário dividir o
trabalho em lotes menores antes de considerar a automação validada. Não assumir
que um timeout do agendador cancelou o trabalho no servidor: verificar os logs.

O worker de lives processa até dez canais por chamada. A frequência não é uma
garantia de deteção: atrasos, quotas ou falhas podem adiar a atualização. O serviço
pode desativar tarefas após falhas repetidas; consultar o histórico regularmente.

Fontes: https://cron-job.org/en/faq/ e https://vercel.com/docs/plans/hobby.
