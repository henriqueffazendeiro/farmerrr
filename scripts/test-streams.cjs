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
  mod.require = name => name === 'server-only' ? {} : name in mocks ? mocks[name] : require(name);
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
      then(resolve, reject) { return Promise.resolve({ data: table === 'creator_lives' ? [{ id: 'old-row', external_id: 'old' }] : null, error: null }).then(resolve, reject); },
    };
    return builder;
  } };
  const sync = load('src/lib/streams/sync.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/crypto/tokens': { decryptToken: () => 'token', encryptToken: value => value },
    './providers': { ...providers, detectStreams: detect },
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
