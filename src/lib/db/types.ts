/**
 * Tipos da base de dados, escritos à mão para acompanhar
 * `supabase/migrations/`. Quando o Supabase CLI estiver configurado podem ser
 * substituídos por `supabase gen types typescript`.
 */

import type { MonthlyRecap } from '@/lib/recap/model'
import type { StreamConnection, CreatorLive } from '@/lib/streams/model'

export type LeaderboardStatus = 'draft' | 'active' | 'ended'
export type PeriodMode = 'fixed' | 'monthly'
export type ParticipantStatus = 'active' | 'disqualified' | 'left'
export type SocialProviderId = 'tiktok' | 'instagram' | 'youtube'
export type AccountStatus = 'connected' | 'needs_reauth' | 'revoked'
export type SyncJobKind = 'discover' | 'refresh' | 'profile'
export type SyncJobStatus = 'pending' | 'running' | 'done' | 'error'
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'

export type Profile = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Creator = {
  id: string
  owner_id: string
  name: string
  handle: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Leaderboard = {
  id: string
  creator_id: string
  name: string
  slug: string
  description: string | null
  rules: string | null
  announcement: string | null
  quote: string | null
  quote_author: string | null
  cover_url: string | null
  starts_at: string
  ends_at: string | null
  event_at: string | null
  timezone: string
  status: LeaderboardStatus
  period_mode: PeriodMode
  platforms: SocialProviderId[]
  required_keyword: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export type ClipperProfile = {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type LeaderboardParticipant = {
  id: string
  leaderboard_id: string
  clipper_profile_id: string
  status: ParticipantStatus
  joined_at: string
  created_at: string
  updated_at: string
}

export type SocialAccount = {
  last_discovered_at: string | null
  sync_locked_until: string
  id: string
  clipper_profile_id: string
  provider: SocialProviderId
  provider_user_id: string
  provider_union_id: string | null
  username: string | null
  display_name: string | null
  avatar_url: string | null
  profile_url: string | null
  follower_count: number | null
  following_count: number | null
  likes_count: number | null
  video_count: number | null
  stats_updated_at: string | null
  access_token_enc: string | null
  refresh_token_enc: string | null
  access_expires_at: string | null
  refresh_expires_at: string | null
  scopes: string[]
  status: AccountStatus
  last_synced_at: string | null
  sync_cursor: string | null
  created_at: string
  updated_at: string
}

/** Vista pública — sem tokens. É esta que as páginas usam. */
export type SocialAccountPublic = Pick<
  SocialAccount,
  | 'id'
  | 'clipper_profile_id'
  | 'provider'
  | 'username'
  | 'display_name'
  | 'avatar_url'
  | 'profile_url'
  | 'follower_count'
  | 'following_count'
  | 'likes_count'
  | 'video_count'
  | 'status'
  | 'last_synced_at'
>

export type Video = {
  id: string
  social_account_id: string
  provider: SocialProviderId
  provider_video_id: string
  url: string | null
  embed_link: string | null
  thumbnail_url: string | null
  caption: string | null
  duration_seconds: number | null
  published_at: string
  latest_views: number
  latest_likes: number
  latest_comments: number
  latest_shares: number
  metrics_updated_at: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export type VideoMetric = {
  id: number
  video_id: string
  views: number
  likes: number
  comments: number
  shares: number
  captured_at: string
}

export type VideoExclusion = {
  id: string
  leaderboard_id: string
  video_id: string
  excluded_by: string | null
  reason: string | null
  created_at: string
}

export type LeaderboardEntry = {
  id: string
  leaderboard_id: string
  participant_id: string
  period_key: string
  total_views: number
  total_likes: number
  total_comments: number
  total_shares: number
  video_count: number
  avg_views: number
  best_video_id: string | null
  rank: number | null
  previous_rank: number | null
  computed_at: string
}

export type Reward = {
  id: string
  leaderboard_id: string
  position: number
  label: string | null
  amount_cents: number | null
  currency: string | null
  created_at: string
}

export type Subscription = {
  id: string
  profile_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: SubscriptionStatus
  plan: string
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export type SyncJob = {
  id: string
  social_account_id: string
  kind: SyncJobKind
  status: SyncJobStatus
  priority: number
  scheduled_for: string
  started_at: string | null
  finished_at: string | null
  attempts: number
  last_error: string | null
  created_at: string
}

/** Linha de tabela → forma { Row, Insert, Update } que o supabase-js espera. */
type Table<Row, Required extends keyof Row = never> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, Required>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      stream_connections: Table<StreamConnection, 'creator_id' | 'platform' | 'channel_id' | 'channel_name' | 'channel_url' | 'access_token_enc' | 'expires_at'>
      creator_lives: Table<CreatorLive, 'creator_id' | 'platform' | 'channel_id' | 'external_id' | 'title' | 'started_at' | 'watch_url'>
      monthly_recaps: Table<MonthlyRecap, 'leaderboard_id' | 'period_key' | 'snapshot'>
      profiles: Table<Profile, 'id'>
      creators: Table<Creator, 'owner_id' | 'name' | 'handle'>
      leaderboards: Table<Leaderboard, 'creator_id' | 'name' | 'slug'>
      clipper_profiles: Table<ClipperProfile, 'display_name'>
      leaderboard_participants: Table<
        LeaderboardParticipant,
        'leaderboard_id' | 'clipper_profile_id'
      >
      social_accounts: Table<SocialAccount, 'clipper_profile_id' | 'provider' | 'provider_user_id'>
      videos: Table<Video, 'social_account_id' | 'provider' | 'provider_video_id' | 'published_at'>
      video_metrics: Table<VideoMetric, 'video_id'>
      video_exclusions: Table<VideoExclusion, 'leaderboard_id' | 'video_id'>
      leaderboard_entries: Table<
        LeaderboardEntry,
        'leaderboard_id' | 'participant_id' | 'period_key'
      >
      rewards: Table<Reward, 'leaderboard_id' | 'position'>
      subscriptions: Table<Subscription, 'profile_id'>
      sync_jobs: Table<SyncJob, 'social_account_id' | 'kind'>
      reserved_slugs: Table<{ slug: string }, 'slug'>
    }
    Views: {
      social_accounts_public: {
        Row: SocialAccountPublic
        Relationships: []
      }
    }
    Functions: {
      generate_monthly_recaps: { Args: Record<string, never>; Returns: number }
      recompute_leaderboard: {
        Args: { p_leaderboard_id: string }
        Returns: number
      }
      recompute_for_account: {
        Args: { p_social_account_id: string }
        Returns: undefined
      }
      enqueue_sync_job: {
        Args: {
          p_social_account_id: string
          p_kind: SyncJobKind
          p_priority?: number
          p_delay?: string
        }
        Returns: string | null
      }
      period_key_for: {
        Args: { p_mode: PeriodMode; p_tz: string; p_at: string }
        Returns: string
      }
      leaderboard_totals: {
        Args: { p_leaderboard_id: string; p_period_key?: string }
        Returns: {
          total_views: number
          total_likes: number
          total_clips: number
          active_clippers: number
          avg_views: number
        }[]
      }
    }
    Enums: {
      leaderboard_status: LeaderboardStatus
      period_mode: PeriodMode
      participant_status: ParticipantStatus
      social_provider: SocialProviderId
      account_status: AccountStatus
      sync_job_kind: SyncJobKind
      sync_job_status: SyncJobStatus
      subscription_status: SubscriptionStatus
    }
    CompositeTypes: Record<string, never>
  }
}
