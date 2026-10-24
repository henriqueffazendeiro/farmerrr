export const streamPlatforms = ['twitch', 'youtube', 'kick'] as const
export type StreamPlatform = typeof streamPlatforms[number]
export const streamLabels = { twitch: 'Twitch', youtube: 'YouTube', kick: 'Kick' }
export function isStreamPlatform(value: string): value is StreamPlatform {
  return streamPlatforms.some(platform => platform === value)
}
export type StreamConnection = {
  id: string; creator_id: string; platform: StreamPlatform
  channel_id: string; channel_name: string; channel_url: string
  access_token_enc: string; refresh_token_enc: string | null; expires_at: string
  status: 'connected' | 'needs_reauth'; last_checked_at: string | null
  last_error: string | null; sync_locked_until: string; created_at: string
}
export type CreatorLive = {
  id: string; creator_id: string; platform: StreamPlatform; channel_id: string
  external_id: string; title: string; started_at: string; ended_at: string | null
  last_seen_at: string; is_live: boolean; thumbnail_url: string | null
  watch_url: string; created_at: string
}
export type DetectedLive = Pick<CreatorLive, 'external_id' | 'title' | 'started_at' | 'thumbnail_url' | 'watch_url'>
