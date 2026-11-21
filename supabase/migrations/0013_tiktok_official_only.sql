begin;

-- Continue large official API imports across bounded server invocations.
alter table public.social_accounts add column discovery_cursor text;

-- Scraped identifiers are not OAuth open_ids. Preserve history, but require
-- authorization; never infer identity from a mutable TikTok username.
update public.social_accounts
set status = 'needs_reauth'
where provider = 'tiktok' and provider_user_id ~ '^(public|apify):';

update public.sync_jobs j
set status = 'error', finished_at = now(),
    last_error = 'Entra com TikTok para autorizar a API oficial.'
from public.social_accounts a
where j.social_account_id = a.id
  and a.provider = 'tiktok' and a.provider_user_id ~ '^(public|apify):'
  and j.status in ('pending', 'running');

commit;
