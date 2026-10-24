# Farmerrr — Arquitetura e Plano Técnico

> Leaderboards automáticos de clippers para streamers.
> **Princípio fundamental:** o streamer vai de "quero uma competição" a "aqui está o link" em <5 min; o clipper vai de "quero participar" a "estou no ranking" em <30 s.

Documento escrito antes da implementação. Versão 1 — MVP (só TikTok).

---

## 0. Resumo das decisões

| Área | Decisão |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript + React Server Components |
| Estilo | Tailwind CSS v4 + design tokens próprios (dark-first) |
| Base de dados | Postgres (Supabase) |
| Auth streamer | Supabase Auth (email+password e/ou magic link) |
| Auth clipper | **Sem password.** Identidade = conta TikTok via OAuth; sessão em cookie assinado |
| Dados sociais | **API oficial do TikTok** (Login Kit + Display API). Zero scraping |
| Jobs | Vercel Cron → route handlers protegidos + tabela de fila `sync_jobs` |
| Pagamentos | Stripe (etapa posterior ao core) |
| Idioma UI | Português (pt-PT), com strings centralizadas para i18n futuro |
| Deploy | Vercel |

---

## 1. Arquitetura proposta

### 1.1 Vista de alto nível

```
                       ┌─────────────────────────────┐
   Streamer  ────────► │  Next.js (Vercel)           │
   Clipper   ────────► │  ├── páginas públicas (ISR) │
   Público   ────────► │  ├── dashboard (RSC + SA)   │
                       │  └── /api  (OAuth, cron,    │
                       │            webhooks Stripe) │
                       └───────┬───────────┬─────────┘
                               │           │
                    ┌──────────▼───┐   ┌───▼──────────────┐
                    │  Postgres    │   │  Provider layer  │
                    │  (Supabase)  │   │  ├── TikTok      │
                    │  + Storage   │   │  └── Mock (dev)  │
                    └──────────────┘   └───┬──────────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │ open.tiktokapis  │
                                  │ .com  (oficial)  │
                                  └──────────────────┘
```

### 1.2 Camadas do código

```
src/
├── app/
│   ├── (marketing)/            landing, preços, legal
│   ├── (auth)/                 entrar, registar
│   ├── (dashboard)/dashboard/  área privada do streamer
│   ├── (public)/
│   │   ├── [slug]/             leaderboard público + página do clipper
│   │   └── join/[slug]/        página de convite
│   ├── overlay/[slug]/         (futuro) OBS browser source
│   └── api/                    oauth tiktok, cron, stripe webhook
├── components/
│   ├── ui/                     design system (Button, Card, Avatar, Stat…)
│   ├── leaderboard/            Podium, RankRow, VideoCard, TopClips
│   └── dashboard/
├── lib/
│   ├── db/                     cliente Supabase + queries tipadas
│   ├── providers/              ⭐ abstração de plataformas sociais
│   │   ├── types.ts            interface SocialProvider
│   │   ├── tiktok/             oauth.ts, client.ts, mapper.ts
│   │   ├── mock/               provider falso p/ desenvolver sem app aprovada
│   │   └── registry.ts         escolhe o provider por `provider` + env
│   ├── sync/                   orquestração dos jobs
│   ├── ranking/                cálculo e materialização do ranking
│   ├── auth/                   sessão streamer + sessão clipper
│   └── config/                 env validado com zod
└── supabase/migrations/        SQL versionado
```

**Porquê a camada `providers/`:** todo o resto do sistema fala com uma interface única. Adicionar Instagram Reels ou YouTube Shorts no futuro é escrever um ficheiro novo, não mexer no ranking, nas páginas ou no schema.

```ts
interface SocialProvider {
  id: 'tiktok' | 'instagram' | 'youtube'
  getAuthUrl(state: string): string
  exchangeCode(code: string): Promise<ProviderTokens>
  refreshTokens(refreshToken: string): Promise<ProviderTokens>
  getAccountInfo(t: ProviderTokens): Promise<ProviderAccount>
  listRecentVideos(t: ProviderTokens, opts: { since?: Date; cursor?: string }): Promise<Page<ProviderVideo>>
  getVideosByIds(t: ProviderTokens, ids: string[]): Promise<ProviderVideo[]>
}
```

### 1.3 Decisões de performance

- **Ranking materializado** na tabela `leaderboard_entries`. A página pública faz **uma** query ordenada — aguenta uma live com milhares de espetadores.
- **Métricas denormalizadas** em `videos` (`latest_views`, …) além do histórico em `video_metrics`. Histórico serve gráficos futuros; a leitura quente nunca lhe toca.
- **ISR + revalidação por tag**: a página pública é estática e é invalidada quando o ranking muda (`revalidateTag('lb:<id>')`).
- **Vídeos partilhados entre leaderboards**: os vídeos pertencem à *social account*, não ao leaderboard. Um clipper em 3 competições sincroniza **uma vez**.
- **Thumbnails**: o `cover_image_url` do TikTok expira em ~6 h. São copiadas para Supabase Storage no primeiro sync (ver §6.5).

---

## 2. Database schema

Postgres. Todas as tabelas com `id uuid default gen_random_uuid()`, `created_at`, `updated_at`.

### 2.1 Diagrama de relações

```
auth.users 1─1 profiles 1─n creators 1─n leaderboards
                                            │
                                            ├─1─n leaderboard_participants ─n─1 clipper_profiles
                                            │                                        │
                                            ├─1─n rewards                            1
                                            │                                        n
                                            └─1─n leaderboard_entries          social_accounts
                                                                                     │
                                                                                     1
                                                                                     n
                                                                                  videos 1─n video_metrics
profiles 1─1 subscriptions
```

### 2.2 Tabelas

**`profiles`** — o utilizador que paga (streamer/manager)
```
id            uuid PK  → auth.users.id
email         text
display_name  text
avatar_url    text
```

**`creators`** — a marca/persona do streamer (permite gerir vários creators no futuro)
```
id, owner_id → profiles
name          text          -- "Luis Ferreira"
handle        citext UNIQUE -- "luisferreira"  (usado no URL público)
avatar_url    text
```

**`leaderboards`**
```
id, creator_id → creators
name             text        -- "Summer Clip Wars"
slug             citext UNIQUE  -- URL público: /luisferreira  (default = creator.handle)
description      text NULL
rules            text NULL
cover_url        text NULL
starts_at        timestamptz NOT NULL
ends_at          timestamptz NULL          -- NULL = contínuo
status           enum('draft','active','ended')
platforms        text[] DEFAULT '{tiktok}' -- preparado para multi-plataforma
required_keyword text NULL                 -- reservado p/ futuro (hashtag obrigatória)
invite_token     text UNIQUE               -- opcional: link de convite rotativo
is_public        boolean DEFAULT true
```
> `slug` é global e único, validado contra uma lista de palavras reservadas (`api`, `join`, `dashboard`, `entrar`, `overlay`, …).

**`clipper_profiles`** — a *pessoa* clipper (independente do leaderboard e da plataforma)
```
id
display_name  text
avatar_url    text
```

**`leaderboard_participants`** (o "Clipper" do teu enunciado, no contexto de uma competição)
```
id, leaderboard_id, clipper_profile_id
status      enum('active','disqualified','left')
joined_at   timestamptz
UNIQUE (leaderboard_id, clipper_profile_id)
```

**`social_accounts`**
```
id, clipper_profile_id
provider              enum('tiktok','instagram','youtube')
provider_user_id      text     -- open_id do TikTok
provider_union_id     text NULL
username              text
display_name          text
avatar_url            text
access_token_enc      bytea    -- cifrado (AES-GCM, chave em env)
refresh_token_enc     bytea
access_expires_at     timestamptz
refresh_expires_at    timestamptz
scopes                text[]
status                enum('connected','needs_reauth','revoked')
last_synced_at        timestamptz
sync_cursor           text NULL
UNIQUE (provider, provider_user_id)
```

**`videos`**
```
id, social_account_id
provider            text
provider_video_id   text
url                 text          -- share_url
embed_link          text NULL
thumbnail_url       text NULL     -- URL já persistido no nosso Storage
caption             text NULL
duration_seconds    int NULL
published_at        timestamptz   -- create_time
latest_views        bigint DEFAULT 0
latest_likes        bigint DEFAULT 0
latest_comments     bigint DEFAULT 0
latest_shares       bigint DEFAULT 0
metrics_updated_at  timestamptz
is_deleted          boolean DEFAULT false   -- desapareceu da API
UNIQUE (provider, provider_video_id)
```

**`video_exclusions`** — o streamer exclui um vídeo **de uma competição** (não globalmente)
```
id, leaderboard_id, video_id, excluded_by → profiles, reason text
UNIQUE (leaderboard_id, video_id)
```

**`video_metrics`** — histórico (para gráficos de evolução)
```
id, video_id
views, likes, comments, shares   bigint
captured_at                      timestamptz
INDEX (video_id, captured_at DESC)
```
> Retenção: 1 snapshot/hora nas primeiras 48 h, depois 1/dia. Job de compactação mensal.

**`leaderboard_entries`** — ranking materializado
```
id, leaderboard_id, participant_id
total_views, total_likes, total_comments, total_shares  bigint
video_count      int
avg_views        bigint
best_video_id    uuid NULL
rank             int
previous_rank    int NULL      -- alimenta as animações de subida/descida
computed_at      timestamptz
UNIQUE (leaderboard_id, participant_id)
INDEX (leaderboard_id, rank)
```

**`rewards`**
```
id, leaderboard_id, position int, label text, amount_cents bigint NULL, currency char(3) NULL
```

**`subscriptions`**
```
id, profile_id
stripe_customer_id, stripe_subscription_id
status      enum('trialing','active','past_due','canceled')
plan        text
trial_ends_at, current_period_end  timestamptz
```

**`sync_jobs`** — fila simples, para o cron não depender de um loop gigante
```
id, social_account_id, kind enum('discover','refresh')
status enum('pending','running','done','error')
scheduled_for timestamptz, attempts int, last_error text
INDEX (status, scheduled_for)
```

### 2.3 Regra de "vídeo válido"

Um vídeo conta para um leaderboard quando **todas** se verificam:

1. pertence a uma `social_account` de um `leaderboard_participant` com `status='active'`;
2. `videos.published_at BETWEEN leaderboard.starts_at AND coalesce(leaderboard.ends_at, now())`;
3. o `provider` está em `leaderboards.platforms`;
4. não existe linha em `video_exclusions` para esse par;
5. `videos.is_deleted = false`.

### 2.4 Segurança (RLS)

- `profiles`, `creators`, `leaderboards`, `rewards`, `subscriptions`: só o dono lê/escreve.
- Leitura pública apenas através de **funções/vistas** que expõem o mínimo (nunca `social_accounts`).
- Tokens: cifrados na base de dados **e** só desencriptados no servidor (nunca chegam ao browser).
- Todas as mutações do dashboard passam por Server Actions com verificação de dono.

---

## 3. Estrutura de páginas / routes

### Público
| Rota | O quê |
|---|---|
| `/` | Landing — "Cria o leaderboard dos teus clippers em minutos" |
| `/precos` | Preço único €24,99/mês + trial |
| `/[slug]` | **Leaderboard público** (podium, ranking, top clips) |
| `/[slug]/c/[participantId]` | **Página do clipper** (stats + todos os clips) |
| `/join/[slug]` | **Página de convite** — "Join Luis Ferreira's Clipper Leaderboard" |
| `/join/[slug]/sucesso` | Confirmação + posição atual |
| `/legal/privacidade`, `/legal/termos` | Obrigatórios para a app review do TikTok |
| `/overlay/[slug]` | *(futuro)* overlay transparente para OBS |

### Autenticação (streamer)
`/entrar` · `/registar` · `/auth/callback` · `/auth/sair`

### Dashboard (privado)
| Rota | O quê |
|---|---|
| `/dashboard` | Lista de leaderboards + stats globais |
| `/dashboard/novo` | Wizard de criação (1 ecrã, <60 s) |
| `/dashboard/l/[id]` | Visão geral + analytics + links para copiar |
| `/dashboard/l/[id]/clippers` | Participantes, remover/desqualificar |
| `/dashboard/l/[id]/videos` | Todos os vídeos, excluir da contagem |
| `/dashboard/l/[id]/premios` | Prémios por posição |
| `/dashboard/l/[id]/definicoes` | Nome, datas, descrição, terminar competição |
| `/dashboard/conta` | Perfil, subscrição, faturação |

### API
| Rota | O quê |
|---|---|
| `GET /api/auth/tiktok/start?lb=<slug>` | Inicia OAuth (gera `state` assinado) |
| `GET /api/auth/tiktok/callback` | Troca `code`→tokens, cria conta+participação |
| `POST /api/cron/sync` | Processa a fila `sync_jobs` (Bearer `CRON_SECRET`) |
| `POST /api/cron/schedule` | Enfileira contas a sincronizar por cadência |
| `POST /api/stripe/webhook` | Estado da subscrição |
| `GET /api/leaderboards/[id]/live` | JSON leve para o overlay/polling (futuro) |

---

## 4. Fluxo streamer → leaderboard

```
1. /registar → email + password (ou magic link)         ~20 s
2. Onboarding num ecrã: "Como te chamas na stream?"
   → cria `creators` e sugere handle "luisferreira"     ~15 s
3. /dashboard/novo — formulário único:
     Nome da competição*      [Summer Clip Wars]
     Creator*                 [Luis Ferreira]  (pré-preenchido)
     Foto/logo                [upload — opcional]
     Início*                  [hoje]  Fim [opcional]
     Descrição/regras         [opcional]
     Prémios 1.º/2.º/3.º      [opcional, +adicionar]
     URL público              app.com/[luisferreira]  ← editável, validado em live
4. "Criar leaderboard" → cria leaderboard (status=active) + entries vazias  ~5 s
5. Ecrã de sucesso com dois botões grandes:
     [Copiar link de convite]  app.com/join/luisferreira
     [Copiar link público]     app.com/luisferreira
   + preview do QR code para mostrar na live
```
**Total: <5 min, com folga.** Nada é bloqueante: prémios, descrição, logo e data de fim são todos opcionais e editáveis depois.

---

## 5. Fluxo clipper → TikTok → leaderboard

```
┌ Telemóvel ────────────────────────────────────────────────┐
│ 1. Abre app.com/join/luisferreira                         │
│    Vê: avatar + "Join Luis Ferreira's Clipper Leaderboard"│
│         47 clippers · 34.8M views · termina em 12 dias    │
│    Botão único: [ Conectar TikTok ]                       │
└───────────────────────────────────────────────────────────┘
                 │  GET /api/auth/tiktok/start?lb=luisferreira
                 ▼
   Gera `state` = JWT curto {lb_id, nonce, exp:10min} + PKCE
   Guarda nonce em cookie httpOnly
                 │  302 → www.tiktok.com/v2/auth/authorize?...
                 ▼
┌ TikTok ───────────────────────────────────────────────────┐
│ "Farmerrr quer aceder ao teu perfil e lista de vídeos"    │
│ scopes: user.info.basic, video.list      [Autorizar]      │
└───────────────────────────────────────────────────────────┘
                 │  302 → /api/auth/tiktok/callback?code&state
                 ▼
   a) valida state + nonce
   b) POST /v2/oauth/token/  → access_token (24h) + refresh_token (365d)
   c) GET  /v2/user/info/    → open_id, username, avatar, display_name
   d) upsert social_accounts (tokens cifrados)
   e) upsert clipper_profiles  (se open_id novo)
   f) insert leaderboard_participants (leaderboard_id, clipper_profile_id)
   g) enfileira sync_job kind='discover' com prioridade alta
                 │  302 → /join/luisferreira/sucesso
                 ▼
┌ Ecrã de sucesso (≈2–8 s depois já com dados) ─────────────┐
│  ✅ Estás dentro, @joaoclips                              │
│  A importar os teus clips…  ▓▓▓▓▓░░  (poll a cada 2 s)    │
│  → 12 clips · 840K views · #7 no ranking                  │
│  [ Ver leaderboard ]                                      │
└───────────────────────────────────────────────────────────┘
```

Notas:
- **Sem sign-up, sem password, sem email.** O clipper nunca escreve nada.
- Se já estiver ligado e abrir o link de outro streamer, o passo (e) reconhece o `open_id` e só cria a participação nova → **1 clique**.
- Consentimento explícito na página de convite ("ao conectar, autorizas o Farmerrr a ler a lista pública dos teus vídeos e as respetivas métricas") com link para a política de privacidade — requisito da app review do TikTok.

---

## 6. Estratégia TikTok OAuth + atualização de métricas

### 6.1 O que a API oficial dá (verificado na documentação)

| Endpoint | Uso |
|---|---|
| `POST https://open.tiktokapis.com/v2/oauth/token/` | code→tokens e refresh |
| `GET /v2/user/info/` | `open_id`, `union_id`, `display_name`, `avatar_url`, `profile_deep_link` |
| `POST /v2/video/list/` | lista paginada dos vídeos **públicos** do utilizador, ordem `create_time` desc |
| `POST /v2/video/query/` | métricas de até **20 video_ids** por pedido |

Campos disponíveis em `list` e `query` (parâmetro `fields`):
`id`, `create_time`, `cover_image_url`, `share_url`, `embed_link`, `embed_html`,
`video_description`, `title`, `duration`, `height`, `width`,
**`view_count`, `like_count`, `comment_count`, `share_count`** ✅

Campos de `/v2/user/info/` e o scope que cada um exige:

| Campo | Scope |
|---|---|
| `open_id`, `union_id`, `display_name`, `avatar_url*` | `user.info.basic` |
| `username`, `profile_deep_link`, `is_verified`, `bio_description` | `user.info.profile` |
| `follower_count`, `following_count`, `likes_count`, `video_count` | `user.info.stats` |

Ou seja: **tudo o que o produto precisa está na API oficial.** Não é preciso scraping.

- Scopes pedidos: `user.info.basic`, `user.info.profile` (para o @username),
  `user.info.stats` (para os seguidores) e `video.list`.
- Paginação de `list`: `max_count` ≤ 20, `cursor` = timestamp Unix em **ms**, resposta traz `cursor` + `has_more`.

### 6.2 Tokens

- `access_token` válido **24 h**; `refresh_token` válido **365 dias** e **rotativo** (cada refresh devolve um novo).
- Refresh proativo quando faltarem <30 min. Falha no refresh → `status='needs_reauth'`, o clipper aparece no leaderboard com um aviso discreto e recebe um link para reconectar (1 clique).

### 6.3 Acesso: sandbox agora, produção depois

- **Sandbox** (sem app review): até 5 sandboxes por app e **10 contas TikTok de teste**. Chega para desenvolver e para uma beta fechada com o primeiro streamer.
- **Produção** exige app review: URLs de Termos, Privacidade e site **verificados por domínio**, redirect URI em HTTPS, e 1–5 vídeos de demonstração do fluxo end-to-end. Estado: Draft → In Review → Live.
- Por isso o MVP inclui desde já `/legal/termos` e `/legal/privacidade` — são pré-requisito, não burocracia opcional.

**Enquanto a app não está aprovada** o `MockProvider` (`SOCIAL_PROVIDER=mock`) gera contas e vídeos realistas com métricas que evoluem no tempo. Todo o produto — ranking, animações, dashboard, páginas públicas — fica testável hoje, e a troca para real é uma variável de ambiente.

### 6.4 Cadência de sincronização

Duas operações distintas, com custos diferentes:

**A) Descoberta de vídeos novos** (`/v2/video/list/`)
Percorre páginas até encontrar um `create_time` anterior ao último visto. Normalmente 1 pedido.

**B) Atualização de métricas** (`/v2/video/query/`)
Lotes de 20 ids. Só vídeos que ainda estão dentro da janela de refresh.

Cadência por idade do vídeo (equilíbrio entre frescura e quota):

| Idade do vídeo | Refresh de métricas |
|---|---|
| < 48 h | de hora a hora |
| 2–7 dias | de 6 em 6 horas |
| > 7 dias | 1× por dia |
| competição terminada | congelado (snapshot final) |

Descoberta: de 30 em 30 min para contas ativas em competições a decorrer; 1×/dia fora disso.

**Mecânica:** `POST /api/cron/schedule` (Vercel Cron, de 15 em 15 min) enfileira `sync_jobs`; `POST /api/cron/sync` (de 5 em 5 min) consome a fila com concorrência limitada. Assim uma competição com 500 clippers não faz o cron ir a timeout.

**Resiliência:** a documentação pública do TikTok não publica os limites exatos, por isso o cliente implementa token-bucket por app, retry com backoff exponencial em `429`/`5xx`, e `attempts`/`last_error` na fila. Vídeo que desaparece da API → `is_deleted=true` (deixa de contar, mas o histórico fica).

### 6.5 Thumbnails

`cover_image_url` é um link CDN com **TTL de ~6 h**. Guardá-lo em bruto significa leaderboards com imagens partidas. No primeiro sync a imagem é copiada para Supabase Storage (`thumbs/<provider_video_id>.jpg`) e `videos.thumbnail_url` aponta para lá.

### 6.6 Recálculo do ranking

Depois de cada lote de sync, para cada leaderboard afetado:

```sql
-- por participante, sobre os vídeos válidos (§2.3)
total_views, total_likes, video_count, avg_views, best_video_id
→ rank = row_number() over (order by total_views desc)
→ previous_rank = rank anterior   -- alimenta as setas ▲▼ e a animação
→ revalidateTag('lb:<id>')
```
Custo: uma query agregada por leaderboard, não um loop por clipper.

---

## 7. Wireframes textuais

### 7.1 `/` Landing (dark, tipografia grande, uma ação)

```
┌──────────────────────────────────────────────────────────────┐
│  Farmerrr                        Preços   Entrar  [Começar]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│        Cria o leaderboard dos teus clippers                  │
│                  em minutos.                                 │
│                                                              │
│   Liga a comunidade, acompanha as views automaticamente      │
│   e mostra o ranking em direto.                              │
│                                                              │
│              [ Criar leaderboard grátis ]                    │
│              14 dias grátis · sem cartão                     │
│                                                              │
│   ┌────────── preview animado do leaderboard ────────────┐   │
│   │  🥇 João      8,421,930   ▲2                         │   │
│   │  🥈 Miguel    6,821,420   ▼1                         │   │
│   │  🥉 Pedro     4,192,183   —                          │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                              │
│   ── Como funciona ──                                        │
│   1 Cria a competição   2 Partilha o link   3 O ranking      │
│     em 2 minutos          no Discord          atualiza-se só │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 `/[slug]` Leaderboard público — **a página que aparece na live**

```
┌──────────────────────────────────────────────────────────────┐
│  ⟨logo⟩  SUMMER CLIP WARS                    ● AO VIVO       │
│          por Luis Ferreira      termina em 12d 04h           │
├──────────────────────────────────────────────────────────────┤
│   34.8M          382          47            91K              │
│   TOTAL VIEWS    CLIPS        CLIPPERS      MÉDIA/CLIP       │
├──────────────────────────────────────────────────────────────┤
│                        ┌─────────┐                           │
│          ┌─────────┐   │   🥇    │   ┌─────────┐             │
│          │   🥈    │   │  João   │   │   🥉    │             │
│          │ Miguel  │   │  8.4M   │   │  Pedro  │             │
│          │  6.8M   │   │ €500    │   │  4.2M   │             │
│          └─────────┘   └─────────┘   └─────────┘             │
│              (pódio com glow, gradiente ouro/prata/bronze)   │
├──────────────────────────────────────────────────────────────┤
│  4  ▲1  ⟨av⟩ Diogo      2,831,921   34 clips   83K méd.  →   │
│  5  ▼1  ⟨av⟩ André      1,942,820   28 clips   69K méd.  →   │
│  6  —   ⟨av⟩ Rita       1,204,003   19 clips   63K méd.  →   │
│         (linhas animadas com layout spring quando trocam)    │
├──────────────────────────────────────────────────────────────┤
│  🔥 TOP CLIPS                                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   scroll horizontal    │
│  │ 2.4M │ │ 1.7M │ │ 1.5M │ │ 940K │   em mobile           │
│  │ João │ │Miguel│ │ João │ │Pedro │                        │
│  └──────┘ └──────┘ └──────┘ └──────┘                        │
├──────────────────────────────────────────────────────────────┤
│  🏆 PRÉMIOS  1.º €500 · 2.º €250 · 3.º €100                  │
│  📋 REGRAS   (expansível)                                    │
│                        [ Participar → ]                      │
└──────────────────────────────────────────────────────────────┘
```
- Mobile: pódio empilha em 3 cartões cheios; stats em grelha 2×2.
- Desktop: largura máx. 1100 px, tipografia grande, contraste alto — legível numa stream a 1080p.
- Atualização: revalidação por tag + polling leve (30 s) só nesta página.

### 7.3 `/join/[slug]` Convite (mobile-first, um só ecrã)

```
┌───────────────────────────┐
│         ⟨avatar⟩          │
│      Luis Ferreira        │
│                           │
│  Junta-te ao leaderboard  │
│      de clippers          │
│                           │
│   47 clippers · 34.8M     │
│   termina em 12 dias      │
│                           │
│  ┌─────────────────────┐  │
│  │  ♪ Conectar TikTok  │  │
│  └─────────────────────┘  │
│                           │
│  Lemos só a lista pública │
│  dos teus vídeos e as     │
│  métricas. Nunca publicamos│
│  nada.  Privacidade ↗     │
│                           │
│  🏆 1.º €500 · 2.º €250   │
└───────────────────────────┘
```

### 7.4 `/[slug]/c/[id]` Página do clipper

```
┌──────────────────────────────────────────────────────────────┐
│  ← voltar ao leaderboard                                     │
│  ⟨avatar grande⟩  João           #1 🥇      @joaoclips ↗      │
├──────────────────────────────────────────────────────────────┤
│   8.4M              34            247K          2.4M         │
│   TOTAL VIEWS       CLIPS         MÉDIA         MELHOR       │
├──────────────────────────────────────────────────────────────┤
│  TOP CLIPS                            [ Views ▾ ] [ Data ]   │
│  ┌────────┐ ┌────────┐ ┌────────┐                            │
│  │ thumb  │ │ thumb  │ │ thumb  │   grelha 2 col. mobile     │
│  │ 2.4M ▶ │ │ 1.7M ▶ │ │ 940K ▶ │           4 col. desktop   │
│  │ 12 set │ │ 09 set │ │ 05 set │                            │
│  └────────┘ └────────┘ └────────┘                            │
│  (clicar abre o TikTok em separador novo)                    │
└──────────────────────────────────────────────────────────────┘
```

### 7.5 `/dashboard` e `/dashboard/l/[id]`

```
┌───────────┬──────────────────────────────────────────────────┐
│ Farmerrr  │  Summer Clip Wars              ● Ativo    ⋯      │
│           │  app.com/luisferreira                            │
│ ◉ Visão   │  [📋 Copiar link público] [🔗 Copiar convite]     │
│ ○ Clippers│──────────────────────────────────────────────────│
│ ○ Vídeos  │   34,821,392    382      47        91,155        │
│ ○ Prémios │   TOTAL VIEWS   CLIPS    CLIPPERS  MÉDIA/CLIP    │
│ ○ Definiç.│   ▲ 2.1M hoje   ▲ 12     ▲ 3                     │
│           │──────────────────────────────────────────────────│
│ ───────   │   [gráfico de área: views acumuladas 14 dias]    │
│ ⚙ Conta   │──────────────────────────────────────────────────│
│           │   TOP 5              │   ATIVIDADE RECENTE       │
│           │   1 João    8.4M     │   @rita entrou    2 min   │
│           │   2 Miguel  6.8M     │   novo clip 340K  8 min   │
│           │   3 Pedro   4.2M     │   @andre ▲ passou @pedro  │
└───────────┴──────────────────────────────────────────────────┘

/clippers → tabela: avatar · @user · clips · views · entrou · [⋯ desqualificar]
/videos   → tabela: thumb · clipper · views · data · [excluir da contagem]
```

### 7.6 Linguagem visual

- **Dark-first.** Fundo `#0A0A0B`, superfícies `#141416`, borda `rgba(255,255,255,.08)`.
- **Um acento** vibrante (violeta→rosa) usado com parcimónia; ouro/prata/bronze reservados ao pódio.
- Tipografia: Inter/Geist, `-0.02em` de tracking nos títulos, números em `tabular-nums`.
- Movimento: `spring` suave no reordenamento das linhas (Motion `layout`), contagem animada dos números, `prefers-reduced-motion` respeitado.
- Zero "dashboard empresarial": sem tabelas cinzentas densas, sem sombras pesadas, muito espaço em branco (escuro).

---

## 8. Plano de implementação por etapas

Cada etapa deixa o produto **funcional e demonstrável**.

| # | Etapa | Entrega |
|---|---|---|
| 1 | Scaffold + design system | Landing a funcionar, tokens, componentes base |
| 2 | Base de dados + auth | Migrations, RLS, registar/entrar, onboarding do creator |
| 3 | Dashboard + criar leaderboard | Wizard, slug único, links de convite e público |
| 4 | Páginas públicas | Leaderboard, pódio, página do clipper, top clips (com dados mock) |
| 5 | Integração TikTok | OAuth real + `MockProvider`, fluxo de convite ponta a ponta |
| 6 | Sync + ranking automático | Fila, cron, histórico de métricas, recálculo, thumbnails |
| 7 | Administração + analytics | Excluir vídeos, desqualificar, prémios, datas, gráficos |
| 8 | *(depois)* Stripe | Trial, subscrição €24,99/mês, portal de faturação |

Fora do MVP, conforme combinado: Instagram, YouTube, Discord, OBS overlay, payouts, marketplace.

---

## 9. Riscos e como são mitigados

| Risco | Mitigação |
|---|---|
| App review do TikTok demora ou é recusada | `MockProvider` + sandbox (10 contas) permitem produto completo e beta fechada antes da aprovação |
| Limites de rate não documentados | Token-bucket, fila com backoff, cadência por idade do vídeo |
| Só conta vídeos **públicos** do clipper | Comunicado com clareza na página de convite |
| Clipper revoga o acesso | `needs_reauth` + reconexão a 1 clique; dados históricos mantêm-se |
| Thumbnails expiram em 6 h | Cópia para Storage no primeiro sync |
| Batota (views compradas/vídeos fora do tema) | MVP: exclusão manual pelo streamer. Futuro: `required_keyword` e deteção de anomalias |
| Custo de sync com muitos clippers | Vídeos partilhados entre leaderboards + congelamento pós-competição |

---

## 10. Ajustes depois de analisar a referência (luisclips.vercel.app)

O site que o Luís Ferreira usa hoje mostra bem o que um streamer real quer ver. Estas
alterações entram no MVP porque saem baratas e são exatamente o que faz a página valer
a pena mostrar numa live.

### 10.1 O que a referência tem e vale a pena copiar

| Elemento | Como entra no Farmerrr |
|---|---|
| Barra de aviso no topo (`POSTEM VÍDEOS TODOS OS DIAS!…`) | `leaderboards.announcement` — campo de texto editável no dashboard |
| Citação do streamer com as regras, nas palavras dele | `leaderboards.quote` + `quote_author` |
| Contagem decrescente para a "live de análise" | `leaderboards.event_at` — data do evento, distinta de `ends_at` |
| Botão **Modo Stream (OBS)** | Rota `/[slug]/stream` — versão fullscreen, tipografia enorme, sem cromo |
| Botão **Atualizar** | Revalidação manual (com limite), útil ao vivo |
| Corrida **mensal** que reinicia todos os meses | `leaderboards.period_mode = 'fixed' \| 'monthly'` |
| Separador **Histórico Geral** | Ranking de sempre, além do ranking do período atual |
| Separador **Maior Média / TikTok** | Ordenação alternativa: `avg_views` em vez de `total_views` |
| Coluna **Seguidores** | Novo: exige o scope `user.info.stats` |
| Coluna **Média / TikTok** | Já previsto (`avg_views`) |
| **Mural dos Clipes Mais Virais** com "Deste mês" / "Todos" | O "Top Clips" com dois separadores |
| Etiqueta **MAIOR CLIPE DO MÊS** no clip nº 1 | Destaque no primeiro cartão |
| Etiquetas nos cartões do pódio ("Candidato a Contratação") | `rewards.label` livre por posição |

### 10.2 Alterações ao schema

**`leaderboards`** ganha:
```
announcement    text NULL          -- barra de aviso no topo
quote           text NULL          -- regras nas palavras do streamer
quote_author    text NULL
event_at        timestamptz NULL   -- "live de análise em: 24d 23h 47m"
period_mode     enum('fixed','monthly') DEFAULT 'monthly'
```
> Com `period_mode='monthly'`, o ranking do período corrente conta os vídeos publicados
> no mês em curso; o histórico geral conta tudo desde `starts_at`. Sem tabela de
> "seasons" — o período é derivado da data, o que mantém tudo simples.

**`social_accounts`** ganha:
```
follower_count   int NULL
following_count  int NULL
likes_count      bigint NULL
video_count      int NULL     -- total público na conta (≠ clips na competição)
stats_updated_at timestamptz
```

**`leaderboard_entries`** passa a ter duas colunas de período:
```
period_key        text        -- '2026-09' quando monthly, 'all' quando fixed
total_views, total_likes, video_count, avg_views, best_video_id, rank, previous_rank
UNIQUE (leaderboard_id, participant_id, period_key)
```
Uma linha por participante **e** por período. O separador "Histórico Geral" lê
`period_key='all'`, que é sempre mantido em paralelo.

### 10.3 Rotas novas

| Rota | O quê |
|---|---|
| `/[slug]/stream` | Modo Stream: Top 5 gigante, fundo sólido, atualização automática |
| `/[slug]?tab=media` | Ordenação por média de views por clip |
| `/[slug]?tab=historico` | Ranking de sempre |

O `/overlay/[slug]` transparente para Browser Source continua fora do MVP — o Modo
Stream resolve 90% da necessidade com uma fração do trabalho (é só abrir num
separador e partilhar o ecrã).

### 10.4 O que deliberadamente **não** copiamos

- **Contas adicionadas à mão pelo streamer.** A referência acompanha contas que alguém
  inseriu manualmente; o Farmerrr existe precisamente para eliminar esse passo — o
  clipper liga-se a si próprio pelo link de convite.
- **Métricas obtidas fora da API oficial.** Mantemos o compromisso de só usar
  endpoints oficiais, mesmo que isso signifique atualizações periódicas em vez de
  tempo real ao segundo.
