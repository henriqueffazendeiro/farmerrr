# farmerrr

Repercute. Recebe. Reage.

Leaderboards automáticos para os clippers de um streamer.
O streamer cria a competição em minutos, partilha um link, e o ranking de views
atualiza-se sozinho através da API oficial do TikTok.

> Arquitetura completa, schema e wireframes: **[`ARQUITETURA.md`](./ARQUITETURA.md)**

---

## Arrancar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre <http://localhost:3000>.

A parte pública (landing, preços, páginas legais) funciona sem base de dados. Para
criar conta e usar o dashboard é preciso ligar o Supabase.

## Ligar o Supabase

São cinco minutos. Só o passo 1 é que precisa de ti no browser.

1. Cria um projeto em [supabase.com](https://supabase.com) — o plano gratuito
   chega bem. Escolha de região: **West EU (London)** ou **Central EU
   (Frankfurt)**, para a latência não pesar.
2. No painel do projeto, abre **SQL Editor → New query**, cola o conteúdo de
   [`supabase/schema.sql`](./supabase/schema.sql) (é o ficheiro todo, ~950
   linhas) e carrega em **Run**. Cria as 14 tabelas, as funções do ranking, a
   RLS e o bucket das miniaturas de uma vez.
3. Em **Project Settings → API**, copia três valores para o `.env.local`:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - chave `anon` `public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - chave `service_role` → `SUPABASE_SERVICE_ROLE_KEY`
     *(esta ignora a RLS — nunca a commitar nem a expor no browser)*
4. Em **Authentication → Providers → Email**, desliga **Confirm email**
   enquanto desenvolves. Assim o registo entra direto no dashboard.

Usa `.env.example` como base. Preenche as credenciais do Supabase e gera
valores aleatórios distintos para `TOKEN_ENCRYPTION_KEY`,
`CLIPPER_SESSION_SECRET` e `CRON_SECRET`. A chave de cifra deve ter 32 bytes
em base64 (ver o comando na secção TikTok). Nunca publiques `.env.local`.

```bash
copy .env.example .env.local   # Windows
cp .env.example .env.local     # macOS / Linux
```

Se preferires o CLI: `supabase link --project-ref <ref>` e `supabase db push`.

## Ver o produto a funcionar

Com o Supabase ligado e `SOCIAL_PROVIDER=mock` (o valor por omissão):

1. `npm run dev` e vai a <http://localhost:3000/registar> — cria conta.
2. Diz como te chamas na stream; o endereço público sai daí.
3. No dashboard, carrega em **"Criar competição de demonstração"**. Monta tudo
   de uma vez: creator, competição mensal com aviso, citação e contagem
   decrescente, quatro prémios e dez clipfarmers com clips a render views.
4. Abre o link público em `/kaicenat`. Tens pódio, ranking com separadores,
   mural de clips e, no canto, o **Modo Stream** para pôr no ecrã.

Preferes montar à mão? Cria a competição em **"Criar leaderboard"** e depois
usa **"Encher com clipfarmers de teste"** na visão geral dela.

Pela linha de comandos: `GET /api/dev/seed?lb=<endereço>&n=8`. Tudo isto só
funciona fora de produção e com `SOCIAL_PROVIDER=mock`.

> **Sobre a demonstração.** Usa o nome de um streamer conhecido para a
> conversa ser concreta, mas os dados são todos inventados e a faixa no topo
> da página diz isso com todas as letras. Serve para mostrar num ecrã, não
> para publicar: pôr online uma página que dá a entender que um streamer real
> usa o produto é outra coisa, e essa não se faz sem ele saber.

Para experimentares o fluxo do clipper como ele o vive, abre
`/join/<endereço>` numa janela anónima e carrega em **Conectar TikTok** — em
modo mock entra logo, com clips importados.

## Comandos

| Comando | O quê |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | TypeScript sem emitir |
| `npm run lint` | ESLint |

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4** — tokens de design em `src/app/globals.css`
- **Motion** — animações de reordenação do ranking
- **Supabase** (Postgres + Auth + Storage) — a partir da Etapa 2
- **Stripe** — subscrições, na última etapa

## Estado das etapas

- [x] **Etapa 1** — Scaffold, design system, landing, preços, páginas legais
- [x] **Etapa 2** — Base de dados, RLS e autenticação do streamer
- [x] **Etapa 3** — Dashboard e criação de leaderboards
- [x] **Etapa 4** — Leaderboard público, pódio, página do clipper, top clips
- [x] **Etapa 5** — Integração TikTok (OAuth real + provider mock)
- [x] **Etapa 6** — Sincronização de vídeos, métricas e ranking automático
- [x] **Etapa 7** — Administração (clippers, vídeos, prémios, datas) e estatísticas
- [ ] **Etapa 8** — Stripe (subscrição e período experimental)
- [ ] Gráficos de evolução das views (o histórico já está a ser guardado)

## Notas

**Sobre as páginas legais.** `/legal/termos` e `/legal/privacidade` não são
decorativas: o TikTok exige URLs de Termos e Privacidade publicados e verificados por
domínio para aprovar a app em produção. O texto atual é um rascunho técnico e deve ser
revisto por um jurista antes da submissão.

**Sobre o TikTok.** Por omissão `SOCIAL_PROVIDER=mock`: o produto inteiro
funciona com contas e clips simulados, com as views a crescer em tempo real,
sem precisar da app aprovada. Para ligar a API oficial ver a secção abaixo.

**Sobre o tema.** Não existe tema claro, por decisão. É uma ferramenta de creators e o
leaderboard é mostrado durante lives — o escuro é o estado natural.

## Ligar o TikTok a sério

Enquanto `SOCIAL_PROVIDER=mock`, o botão "Conectar TikTok" cria uma conta
simulada e importa clips gerados — dá para testar tudo, incluindo o ranking a
mexer. Para usar a API oficial:

1. Cria uma app em [developers.tiktok.com](https://developers.tiktok.com) e
   adiciona os produtos **Login Kit** e **Display API**.
2. Pede os scopes `user.info.basic`, `user.info.profile`, `user.info.stats` e
   `video.list`.
3. Redirect URI: `https://<o-teu-dominio>/api/auth/tiktok/callback`.
4. Enquanto não tiveres app review, usa um **sandbox** — permite até 10 contas
   de teste sem submeter nada.
5. Para produção é preciso app review: URLs de Termos, Privacidade e site
   verificados por domínio (já existem em `/legal/*`) e 1–5 vídeos de demo do
   fluxo completo.
6. Depois, em `.env.local`:

```
SOCIAL_PROVIDER=tiktok
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
TIKTOK_REDIRECT_URI=https://<dominio>/api/auth/tiktok/callback
TOKEN_ENCRYPTION_KEY=<32 bytes em base64>
CLIPPER_SESSION_SECRET=<string aleatória>
```

Gerar a chave de cifra:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Sincronização

Dois crons, definidos em `vercel.json`:

| Rota | Cadência | O que faz |
|---|---|---|
| `/api/cron/schedule` | 15 em 15 min | Enche a fila `sync_jobs` com as contas em atraso |
| `/api/cron/sync` | 5 em 5 min | Consome a fila, importa clips e atualiza métricas |

Ambas exigem `CRON_SECRET` (a Vercel envia-o no cabeçalho `Authorization`).
Em desenvolvimento podes chamá-las à mão:

```bash
curl "http://localhost:3000/api/cron/schedule?secret=$CRON_SECRET"
curl "http://localhost:3000/api/cron/sync?secret=$CRON_SECRET"
```

As métricas de cada vídeo são pedidas com cadência decrescente — de hora a
hora nas primeiras 48 h, de 6 em 6 h até aos 7 dias, depois uma vez por dia — e
congelam quando a competição termina.

> No plano gratuito da Vercel os crons só correm uma vez por dia. Para a
> cadência acima é preciso plano pago, ou um agendador externo (GitHub Actions,
> cron-job.org) a chamar as mesmas rotas com o `CRON_SECRET`.
