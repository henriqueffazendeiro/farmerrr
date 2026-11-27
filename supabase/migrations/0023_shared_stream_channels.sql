-- Vários perfis podem ligar o mesmo canal de Twitch, YouTube ou Kick (ex.: a conta de teste e a conta real do streamer).
-- Cada perfil continua a ter só um canal por plataforma (unique (creator_id, platform)).
-- Os webhooks já atualizam todos os perfis que têm o canal ligado; o índice mantém essa procura rápida.

alter table public.stream_connections drop constraint if exists stream_connections_platform_channel_id_key;
create index if not exists stream_connections_channel on public.stream_connections (platform, channel_id);
