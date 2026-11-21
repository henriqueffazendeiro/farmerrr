const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const filename = path.resolve(relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  const noWebhooks = { ensureLiveWebhooks: async () => {}, removeLiveWebhooks: async () => {} };
  mod.require = name => name === 'server-only' ? {} : name in mocks ? mocks[name] : name === './webhooks' ? noWebhooks : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}
const providers = load('src/lib/streams/providers.ts', {
  '@/lib/config/env': { publicEnv: { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' } },
});
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });
const respond = body => { global.fetch = async () => new Response(JSON.stringify(body), { status: 200 }); };

test('Disconnect distinguishes a stale form from an active sync lock and database errors', async () => {
  for (const scenario of ['removed', 'locked', 'error']) {
    const builder = {
      delete() { return this; }, select() { return this; }, eq() { return this; }, lt() { return this; },
      calls: 0,
      async maybeSingle() {
        this.calls++;
        return { data: this.calls > 1 && scenario === 'locked' ? { id: 'connection' } : null,
          error: scenario === 'error' ? new Error('database unavailable') : null };
      },
    };
    const actions = load('src/lib/streams/actions.ts', {
      'next/navigation': { redirect: url => { throw new Error(url); } },
      'next/cache': { revalidatePath() {} },
      '@/lib/db/queries': { getMyCreator: async () => ({ id: 'owner' }) },
      '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => builder }) },
      './sync': {},
    });
    const form = new FormData();
    form.set('connectionId', 'connection');
    await assert.rejects(() => actions.disconnectStream(form), error => error.message === (
      scenario === 'removed' ? '/dashboard/conta?streams=disconnected'
        : scenario === 'locked' ? '/dashboard?streams=busy' : '/dashboard?streams=error'));
  }
});

test('OAuth uses callback, state, PKCE for Kick and offline consent for YouTube', () => {
  const kick = providers.authorizationUrl('kick', 'nonce', 'verifier');
  assert.equal(kick.searchParams.get('state'), 'nonce');
  assert.equal(kick.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(kick.searchParams.get('redirect_uri'), 'http://localhost:3000/api/streams/kick/callback');
  assert.equal(kick.searchParams.get('scope'), 'channel:read');
  const youtube = providers.authorizationUrl('youtube', 'nonce', 'verifier');
  assert.equal(youtube.searchParams.get('access_type'), 'offline');
  assert.equal(youtube.searchParams.get('prompt'), 'consent');
});
test('Twitch maps live ID and thumbnail and distinguishes successful offline response', async () => {
  respond({ data: [{ id: 'live-123', title: 'Live teste', started_at: '2026-10-24T20:00:00Z', thumbnail_url: 'https://example.com/{width}x{height}.jpg' }] });
  const live = (await providers.detectStreams('twitch', 'token', '123', 'https://twitch.tv/test'))[0];
  assert.equal(live.external_id, 'live-123');
  assert.equal(live.thumbnail_url, 'https://example.com/640x360.jpg');
  respond({ data: [] });
  assert.deepEqual(await providers.detectStreams('twitch', 'token', '123', 'url'), []);
});
test('Kick uses a stable channel/start key and rejects malformed live responses', async () => {
  const channel = { broadcaster_user_id: 123, slug: 'test', stream_title: 'Test', stream: { is_live: true, start_time: '2026-10-24T20:00:00Z' } };
  respond({ data: [channel] });
  const first = await providers.detectStreams('kick', 'token', '123', 'https://kick.com/test');
  const second = await providers.detectStreams('kick', 'token', '123', 'https://kick.com/test');
  assert.equal(first[0].external_id, second[0].external_id);
  respond({ data: [{ ...channel, stream: { is_live: true } }] });
  await assert.rejects(() => providers.detectStreams('kick', 'token', '123', 'url'));
});
test('YouTube paginates and never publishes private broadcasts or another channel', async () => {
  const item = (id, privacyStatus, channelId = 'mine') => ({ id, snippet: { channelId, title: id, actualStartTime: '2026-10-24T20:00:00Z' }, status: { privacyStatus } });
  let calls = 0;
  global.fetch = async url => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('broadcastStatus'), 'active');
    assert.equal(parsed.searchParams.has('mine'), false);
    calls++;
    return new Response(JSON.stringify(calls === 1 ? { items: [item('hidden', 'private'), item('other', 'public', 'other')], nextPageToken: 'next' }
      : { items: [item('visible', 'public')] }), { status: 200 });
  };
  const lives = await providers.detectStreams('youtube', 'token', 'mine', 'url');
  assert.equal(calls, 2);
  assert.deepEqual(lives.map(live => live.external_id), ['visible']);
});
test('Provider errors do not turn into an empty offline result', async () => {
  global.fetch = async () => new Response('', { status: 429 });
  await assert.rejects(() => providers.detectStreams('twitch', 'token', '123', 'url'), error => error.status === 429);
});

function syncHarness(detect) {
  const writes = [];
  const connection = { id: 'c', creator_id: 'owner', platform: 'twitch', channel_id: 'channel', channel_url: 'url', access_token_enc: 'encrypted', expires_at: '2099-01-01T00:00:00Z' };
  const db = { from(table) {
    let operation; let payload;
    const builder = {
      update(value) { operation = 'update'; payload = value; writes.push({ table, operation, payload }); return builder; },
      upsert(value, options) { writes.push({ table, operation: 'upsert', payload: value, options }); return builder; },
      select() { return builder; }, eq() { return builder; }, lt() { return builder; }, in() { return builder; },
      maybeSingle() { return Promise.resolve({ data: connection, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: table === 'creator_lives' ? [{ id: 'old-row', external_id: 'old', is_live: true }] : null, error: null }).then(resolve, reject); },
    };
    return builder;
  } };
  const sync = load('src/lib/streams/sync.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/crypto/tokens': { decryptToken: () => 'token', encryptToken: value => value },
    './providers': { ...providers, detectStreams: detect },
    './public-provider': { PUBLIC_STREAM_MARKER: 'api:public', isPublicMarker: value => value === 'api:public' },
  });
  return { writes, sync: () => sync.syncStreamConnection('c') };
}
test('Sync preserves active lives on API failure and releases lease', async () => {
  const h = syncHarness(async () => { throw new providers.StreamApiError(503); });
  await assert.rejects(h.sync);
  assert.equal(h.writes.filter(write => write.table === 'creator_lives').length, 0);
  assert.equal(h.writes.at(-1).payload.sync_locked_until, new Date(0).toISOString());
});
test('Sync upserts using unique stream identity and ends only absent streams', async () => {
  const h = syncHarness(async () => [{ external_id: 'new', title: 'Live', started_at: '2026-10-24T20:00:00Z', thumbnail_url: null, watch_url: 'url' }]);
  await h.sync();
  const insertion = h.writes.find(write => write.operation === 'upsert');
  assert.equal(insertion.options.onConflict, 'creator_id,platform,channel_id,external_id');
  assert.equal(insertion.payload.is_live, true);
  assert.equal(h.writes.find(write => write.table === 'creator_lives' && write.operation === 'update').payload.is_live, false);
});

function publicSyncHarness(snapshot, overrides = {}) {
  const writes = [];
  const connection = { id: 'c', creator_id: 'owner', platform: 'twitch', channel_id: 'luis', channel_url: 'https://www.twitch.tv/luis',
    access_token_enc: 'api:public', expires_at: '9999-01-01T00:00:00Z', last_checked_at: null, ...overrides };
  const existing = [{ id: 'old-row', external_id: 'live-1', started_at: '2026-10-30T20:00:00Z', is_live: false }];
  const db = { from(table) {
    const builder = {
      update(value) { writes.push({ table, operation: 'update', payload: value }); return builder; },
      upsert(value, options) { writes.push({ table, operation: 'upsert', payload: value, options }); return builder; },
      select() { return builder; }, eq() { return builder; }, lt() { return builder; }, in() { return builder; },
      maybeSingle() { return Promise.resolve({ data: connection, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: table === 'creator_lives' ? existing : null, error: null }).then(resolve, reject); },
    };
    return builder;
  } };
  const requested = [];
  const sync = load('src/lib/streams/sync.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/crypto/tokens': { decryptToken: () => 'token', encryptToken: value => value },
    './providers': providers,
    './public-provider': { PUBLIC_STREAM_MARKER: 'api:public', isPublicMarker: value => ['api:public', 'apify:public', 'agent:public'].includes(value),
      readPublicChannel: async (...args) => { requested.push(args); return snapshot; } },
  });
  return { writes, requested, sync: () => sync.syncStreamConnection('c') };
}

test('Public sync imports only missing past lives and asks for history on the first check of the day', async () => {
  const h = publicSyncHarness({ channel_id: 'luis', channel_name: 'Luis', channel_url: 'https://www.twitch.tv/luis', streams: [], past: [
    // Mesma transmissão já registada em direto (VOD com outro ID, início 2 min depois): não duplica.
    { external_id: 'v-1', title: 'VOD', started_at: '2026-10-30T20:02:00Z', ended_at: '2026-10-30T22:00:00Z', thumbnail_url: null, watch_url: 'https://www.twitch.tv/videos/1' },
    { external_id: 'v-2', title: 'Domingo', started_at: '2026-10-31T19:00:00Z', ended_at: '2026-10-31T21:30:00Z', thumbnail_url: 'https://x/t.jpg', watch_url: 'https://www.twitch.tv/videos/2' },
  ] });
  await h.sync();
  assert.deepEqual(h.requested[0][2], { history: true });
  const insert = h.writes.find(write => write.operation === 'upsert');
  assert.equal(insert.options.ignoreDuplicates, true);
  assert.deepEqual(insert.payload.map(row => row.external_id), ['v-2']);
  assert.equal(insert.payload[0].is_live, false);
  assert.equal(insert.payload[0].ended_at, '2026-10-31T21:30:00Z');
});

test('Twitch is read with the app token from the official Helix API, including past VODs', async () => {
  process.env.TWITCH_CLIENT_ID = 'tw-id'; process.env.TWITCH_CLIENT_SECRET = 'tw-secret';
  const calls = [];
  global.fetch = async (url, init = {}) => {
    const parsed = new URL(url); calls.push(parsed.pathname);
    if (parsed.hostname === 'id.twitch.tv') {
      assert.equal(init.body.get('grant_type'), 'client_credentials');
      return new Response(JSON.stringify({ access_token: 'app', expires_in: 3600 }));
    }
    assert.equal(init.headers.Authorization, 'Bearer app'); assert.equal(init.headers['Client-Id'], 'tw-id');
    const body = parsed.pathname.endsWith('/users') ? { data: [{ id: '42', login: 'luis', display_name: 'Luís' }] }
      : parsed.pathname.endsWith('/streams') ? { data: [{ id: 's-now', user_id: '42', title: 'Agora', started_at: '2026-11-20T20:00:00Z', thumbnail_url: 'https://x/{width}x{height}.jpg' }] }
        : { data: [
          { id: '1', stream_id: 's-now', title: 'Em curso', created_at: '2026-11-20T20:00:00Z', duration: '1h', thumbnail_url: '', url: 'https://www.twitch.tv/videos/1' },
          { id: '2', stream_id: 's-old', title: 'Ontem', created_at: '2026-11-19T20:00:00Z', duration: '2h30m', thumbnail_url: 'https://x/%{width}x%{height}.jpg', url: 'https://www.twitch.tv/videos/2' }] };
    return new Response(JSON.stringify(body));
  };
  const provider = load('src/lib/streams/public-provider.ts', { './public-input': load('src/lib/streams/public-input.ts'),
    './youtube-public': { youtubePublicConfigured: () => false } });
  assert.equal(provider.publicStreamsConfigured('twitch'), true);
  const snapshot = await provider.readPublicChannel('twitch', 'https://www.twitch.tv/Luis', { history: true });
  assert.equal(snapshot.channel_id, '42');
  assert.deepEqual(snapshot.streams.map(row => [row.external_id, row.thumbnail_url]), [['s-now', 'https://x/640x360.jpg']]);
  assert.deepEqual(snapshot.past.map(row => [row.external_id, row.ended_at]), [['s-old', '2026-11-19T22:30:00.000Z']]);
  assert.ok(calls.includes('/helix/videos'));
});

test('Kick is read with the app token from the official public API', async () => {
  process.env.KICK_CLIENT_ID = 'k-id'; process.env.KICK_CLIENT_SECRET = 'k-secret';
  let live = true;
  global.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'id.kick.com') return new Response(JSON.stringify({ access_token: 'kick-app', expires_in: 3600 }));
    assert.equal(init.headers.Authorization, 'Bearer kick-app');
    assert.equal(parsed.searchParams.get('slug'), 'luis');
    return new Response(JSON.stringify({ data: [{ broadcaster_user_id: 7, slug: 'luis', stream_title: 'Live',
      stream: live ? { is_live: true, start_time: '2026-11-20T21:00:00Z', thumbnail: 'https://x/k.jpg' } : { is_live: false, start_time: '0001-01-01T00:00:00Z', thumbnail: '' } }] }));
  };
  const provider = load('src/lib/streams/public-provider.ts', { './public-input': load('src/lib/streams/public-input.ts'),
    './youtube-public': { youtubePublicConfigured: () => false } });
  const snapshot = await provider.readPublicChannel('kick', 'luis');
  assert.deepEqual(snapshot.streams, [{ external_id: '7:2026-11-20T21:00:00Z', title: 'Live', started_at: '2026-11-20T21:00:00Z', thumbnail_url: 'https://x/k.jpg', watch_url: 'https://kick.com/luis' }]);
  live = false;
  assert.deepEqual((await provider.readPublicChannel('kick', 'luis')).streams, []);
  global.fetch = async () => new Response('{}', { status: 500 });
  await assert.rejects(() => provider.readPublicChannel('kick', 'luis'));
});

test('Old connections saved for the PC program are now read by the API and adopt the real channel id', async () => {
  const h = publicSyncHarness({ channel_id: '42', channel_name: 'Luís', channel_url: 'https://www.twitch.tv/luis', streams: [], past: [] },
    { channel_id: 'pending:https://www.twitch.tv/luis', access_token_enc: 'agent:public' });
  await h.sync();
  assert.equal(h.requested.length, 1);
  const identity = h.writes.find(write => write.table === 'stream_connections' && write.payload.channel_id);
  assert.deepEqual(identity.payload, { channel_id: '42', channel_name: 'Luís', channel_url: 'https://www.twitch.tv/luis', access_token_enc: 'api:public' });
});

test('YouTube API key resolves handles, detects public lives, imports history and ignores upcoming/private videos', async () => {
  const oldKey = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = 'test-key';
  const channelId = 'UCaaaaaaaaaaaaaaaaaaaaaa';
  const calls = [];
  const video = (id, details, privacyStatus = 'public') => ({ id, snippet: { channelId, title: id }, status: { privacyStatus }, liveStreamingDetails: details });
  global.fetch = async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.has('key'), false);
    assert.equal(init.headers['X-Goog-Api-Key'], 'test-key');
    calls.push(parsed.pathname);
    const endpoint = parsed.pathname.split('/').at(-1);
    const body = endpoint === 'channels' ? { items: [{ id: channelId, snippet: { title: 'Test' }, contentDetails: { relatedPlaylists: { uploads: 'uploads' } } }] }
      : endpoint === 'playlistItems' ? { items: ['live', 'past', 'upcoming', 'private', 'regular'].map(videoId => ({ contentDetails: { videoId } })) }
          : { items: [video('live', { actualStartTime: '2026-11-17T12:00:00Z' }),
            video('past', { actualStartTime: '2026-11-16T12:00:00Z', actualEndTime: '2026-11-16T13:00:00Z' }),
            video('upcoming', {}), video('private', { actualStartTime: '2026-11-17T12:00:00Z' }, 'private'), video('regular', undefined)] };
    if (endpoint === 'channels') assert.equal(parsed.searchParams.get('forHandle'), '@test');
    return new Response(JSON.stringify(body));
  };
  try {
    const youtube = load('src/lib/streams/youtube-public.ts');
    const result = await youtube.readYouTubePublic('https://www.youtube.com/@test', true);
    assert.deepEqual(result.streams.map(row => row.external_id), ['live']);
    assert.deepEqual(result.past.map(row => row.external_id), ['past']);
    assert.equal(result.past[0].ended_at, '2026-11-16T13:00:00Z');
    assert.equal(calls.length, 3); // channels + playlistItems + videos (sem search.list, que custa 100 unidades)
    assert.ok(!calls.some(path => path.endsWith('/search')));
    const provider = load('src/lib/streams/public-provider.ts', { './public-input': load('src/lib/streams/public-input.ts'), './youtube-public': youtube });
    assert.equal((await provider.readPublicChannel('youtube', '@test')).channel_id, channelId);
    global.fetch = async () => new Response(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 });
    await assert.rejects(() => youtube.readYouTubePublic('https://www.youtube.com/@test'), /quota/);
  } finally { if (oldKey === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = oldKey; }
});

test('YouTube videos from another channel fail rather than being attributed to this channel', async () => {
  const oldKey = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = 'test-key';
  const youtube = load('src/lib/streams/youtube-public.ts');
  try {
    global.fetch = async url => {
      const endpoint = new URL(url).pathname.split('/').at(-1);
      return new Response(JSON.stringify(endpoint === 'channels'
        ? { items: [{ id: 'UCaaaaaaaaaaaaaaaaaaaaaa', snippet: { title: 'Test' }, contentDetails: { relatedPlaylists: { uploads: 'uploads' } } }] }
        : endpoint === 'playlistItems' ? { items: [{ contentDetails: { videoId: 'live' } }] }
          : { items: [{ id: 'live', snippet: { channelId: 'other', title: 'Live' }, status: { privacyStatus: 'public' }, liveStreamingDetails: { actualStartTime: '2026-11-17T12:00:00Z' } }] }));
    };
    await assert.rejects(() => youtube.readYouTubePublic('https://www.youtube.com/@test'));
  } finally { if (oldKey === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = oldKey; }
});

test('Batch reads: Twitch 100 channels per request, Kick livestreams, YouTube without search.list', async () => {
  process.env.TWITCH_CLIENT_ID = 'tw-id'; process.env.TWITCH_CLIENT_SECRET = 'tw-secret';
  process.env.KICK_CLIENT_ID = 'k-id'; process.env.KICK_CLIENT_SECRET = 'k-secret';
  process.env.YOUTUBE_API_KEY = 'test-key';
  const requests = [];
  global.fetch = async (url) => {
    const parsed = new URL(url); requests.push(parsed);
    if (parsed.pathname.endsWith('/token')) return new Response(JSON.stringify({ access_token: 'app', expires_in: 3600 }));
    if (parsed.pathname === '/helix/streams') return new Response(JSON.stringify({ data: [{ id: 's7', user_id: '7', title: 'Live 7', started_at: '2026-11-20T10:00:00Z', thumbnail_url: 'https://x/{width}x{height}.jpg' }] }));
    if (parsed.pathname === '/public/v1/livestreams') return new Response(JSON.stringify({ data: [{ broadcaster_user_id: 9, slug: 'k9', stream_title: 'Kick 9', started_at: '2026-11-20T09:00:00.000Z', thumbnail: null }] }));
    const endpoint = parsed.pathname.split('/').at(-1);
    if (endpoint === 'playlistItems') return new Response(JSON.stringify({ items: [{ contentDetails: { videoId: parsed.searchParams.get('playlistId') === 'UUaaaaaaaaaaaaaaaaaaaaaa' ? 'yt-live' : 'yt-old' } }] }));
    return new Response(JSON.stringify({ items: [
      { id: 'yt-live', snippet: { channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa', title: 'YT live' }, status: { privacyStatus: 'public' }, liveStreamingDetails: { actualStartTime: '2026-11-20T08:00:00Z' } },
      { id: 'yt-old', snippet: { channelId: 'UCbbbbbbbbbbbbbbbbbbbbbb', title: 'Old' }, status: { privacyStatus: 'public' }, liveStreamingDetails: { actualStartTime: '2026-11-19T08:00:00Z', actualEndTime: '2026-11-19T09:00:00Z' } }] }));
  };
  const youtube = load('src/lib/streams/youtube-public.ts');
  const provider = load('src/lib/streams/public-provider.ts', { './public-input': load('src/lib/streams/public-input.ts'), './youtube-public': youtube });
  const twitch = Array.from({ length: 150 }, (_, i) => ({ channel_id: String(i), channel_url: `https://www.twitch.tv/c${i}` }));
  const t = await provider.readLiveBatch('twitch', twitch);
  assert.equal(requests.filter(r => r.pathname === '/helix/streams').length, 2);
  assert.equal(requests.find(r => r.pathname === '/helix/streams').searchParams.getAll('user_id').length, 100);
  assert.deepEqual(t.get('7').map(live => live.external_id), ['s7']);
  assert.deepEqual(t.get('8'), []);
  const k = await provider.readLiveBatch('kick', [{ channel_id: '9', channel_url: 'https://kick.com/k9' }, { channel_id: '10', channel_url: 'https://kick.com/k10' }]);
  assert.deepEqual(k.get('9').map(live => live.external_id), ['9:2026-11-20T09:00:00Z']);
  assert.deepEqual(k.get('10'), []);
  const y = await provider.readLiveBatch('youtube', [{ channel_id: 'UCaaaaaaaaaaaaaaaaaaaaaa', channel_url: '' }, { channel_id: 'UCbbbbbbbbbbbbbbbbbbbbbb', channel_url: '' }]);
  assert.deepEqual(y.get('UCaaaaaaaaaaaaaaaaaaaaaa').map(live => live.external_id), ['yt-live']);
  assert.deepEqual(y.get('UCbbbbbbbbbbbbbbbbbbbbbb'), []);
  assert.ok(!requests.some(r => r.pathname.endsWith('/search')));
});

test('Webhook signatures: Twitch HMAC and YouTube WebSub are verified, tampering is rejected', async () => {
  process.env.CRON_SECRET = 'cron-secret'; process.env.NEXT_PUBLIC_APP_URL = 'https://farmerrr.test';
  const crypto = require('node:crypto');
  const webhooks = load('src/lib/streams/webhooks.ts', { '@/lib/supabase/admin': { createAdminClient: () => ({}) }, './sync': {},
    './public-provider': { publicStreamsConfigured: () => true } });
  const secret = name => crypto.createHmac('sha256', 'cron-secret').update(`farmerrr-webhook:${name}`).digest('hex');
  const body = '{"event":{}}'; const id = 'msg-1'; const ts = new Date().toISOString();
  const headers = signature => new Headers({ 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': ts, 'twitch-eventsub-message-signature': signature });
  const good = `sha256=${crypto.createHmac('sha256', secret('twitch')).update(id + ts + body).digest('hex')}`;
  assert.equal(webhooks.verifyTwitch(headers(good), body), true);
  assert.equal(webhooks.verifyTwitch(headers(good), body + ' '), false);
  const yt = `sha1=${crypto.createHmac('sha1', secret('youtube')).update(body).digest('hex')}`;
  assert.equal(webhooks.verifyYouTube(new Headers({ 'x-hub-signature': yt }), body), true);
  assert.equal(webhooks.verifyYouTube(new Headers({ 'x-hub-signature': yt }), '{}'), false);
  assert.equal(webhooks.webhooksAvailable(), true);
});

