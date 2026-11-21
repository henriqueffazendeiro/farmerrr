const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(relative);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === 'server-only' ? {} : name in mocks ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const types = load('src/lib/providers/types.ts');
const period = load('src/lib/period.ts');
const history = load('src/lib/sync/history.ts', { '@/lib/period': period });

test('Since always includes old videos while the monthly ranking keeps its competition bounds', () => {
  const board = { period_mode: 'monthly', timezone: 'Europe/Lisbon', starts_at: '2026-11-01T13:00:00Z', ends_at: '2026-11-30T23:59:00Z' };
  assert.equal(period.periodBounds(board, 'all').from.getTime(), 0);
  assert.equal(period.periodBounds(board, '2026-11').from.toISOString(), '2026-11-01T13:00:00.000Z');
  const rows = [{ id: 'old', social_account_id: 'account', latest_views: 353, latest_likes: 10, latest_comments: 2, latest_shares: 1 },
    { id: 'excluded', social_account_id: 'account', latest_views: 999, latest_likes: 80, latest_comments: 9, latest_shares: 5 }];
  const totals = history.historyMetrics(rows, new Set(['excluded']));
  assert.equal(totals.video_count, 1); assert.equal(totals.total_views, 353); assert.equal(totals.best_video_id, 'old');
});

const real = load('src/lib/providers/tiktok/index.ts', {
  '@/lib/config/env': { serverEnv: () => ({ TIKTOK_CLIENT_KEY: 'key', TIKTOK_CLIENT_SECRET: 'secret' }), publicEnv: { NEXT_PUBLIC_APP_URL: 'https://test.example' } },
  '@/lib/providers/types': types,
}).tiktokProvider;
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });

test('Official login URL requests read access and carries the CSRF state', () => {
  const url = new URL(real.getAuthUrl('signed-state'));
  assert.equal(url.origin, 'https://www.tiktok.com');
  assert.equal(url.pathname, '/v2/auth/authorize/');
  assert.equal(url.searchParams.get('state'), 'signed-state');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://test.example/api/auth/tiktok/callback');
  assert.ok(url.searchParams.get('scope').split(',').includes('video.list'));
});

test('Background cron requires authentication and schedules server work after acknowledgement', async () => {
  let allowed = false;
  const callbacks = [], limits = [];
  const route = load('src/app/api/cron/sync/route.ts', {
    'next/server': { after: cb => callbacks.push(cb), NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } },
    '@/lib/cron/auth': { isAuthorizedCron: () => allowed },
    '@/lib/sync/queue': { runQueue: async limit => { limits.push(limit); return { processed: 1, failed: 0 }; } },
  });
  const request = { url: 'https://test.example/api/cron/sync?limit=1&background=1' };
  assert.equal((await route.GET(request)).status, 401); assert.equal(callbacks.length, 0);
  allowed = true;
  const response = await route.GET(request);
  assert.equal(response.status, 202); assert.equal(response.body.accepted, true); assert.equal(limits.length, 0);
  await callbacks[0](); assert.deepEqual(limits, [1]);
});

test('OAuth state refuses forged, missing, replayed in another browser and expired cookies', () => {
  const auth = load('src/lib/auth/oauth-state.ts', {
    '@/lib/config/env': { serverEnv: () => ({ CLIPPER_SESSION_SECRET: 'test-secret' }) },
  });
  const { state, nonce } = auth.createState('board', 'slug');
  assert.equal(auth.readState(state, nonce).leaderboardId, 'board');
  for (const cookie of [undefined, 'another']) assert.equal(auth.readState(state, cookie), null);
  assert.equal(auth.readState(state + '.extra', nonce), null);
  assert.equal(auth.readState('forged.' + state.split('.')[1], nonce), null);
  const now = Date.now;
  try { Date.now = () => now() + 601000; assert.equal(auth.readState(state, nonce), null); }
  finally { Date.now = now; }
});

test('API rejects missing or negative metrics, preserving legitimate zeros', async () => {
  const video = { id: '123', create_time: 1792868400, view_count: 0, like_count: 0, comment_count: 0, share_count: 0 };
  global.fetch = async () => Response.json({ data: { videos: [video] } });
  assert.equal((await real.getVideosByIds({ accessToken: 'token' }, ['123']))[0].views, 0);
  delete video.like_count;
  await assert.rejects(() => real.getVideosByIds({ accessToken: 'token' }, ['123']), /incompletas/);
  video.like_count = -1;
  await assert.rejects(() => real.getVideosByIds({ accessToken: 'token' }, ['123']), /incompletas/);
});

test('Pagination uses official cursor and refuses a stalled cursor', async () => {
  global.fetch = async (url, init) => {
    assert.ok(url.startsWith('https://open.tiktokapis.com/v2/video/list/'));
    assert.deepEqual(JSON.parse(init.body), { max_count: 20, cursor: 2000 });
    return Response.json({ data: { videos: [], has_more: true, cursor: 1000 } });
  };
  assert.equal((await real.listVideos({ accessToken: 'token' }, { cursor: '2000', max: 100 })).cursor, '1000');
  global.fetch = async () => Response.json({ data: { videos: [], has_more: true, cursor: 2000 } });
  await assert.rejects(() => real.listVideos({ accessToken: 'token' }, { cursor: '2000' }), /Paginação/);
});

test('Denied optional scopes are not requested in profile fields', async () => {
  global.fetch = async url => {
    const fields = new URL(url).searchParams.get('fields');
    assert.ok(!fields.includes('username')); assert.ok(!fields.includes('follower_count'));
    return Response.json({ data: { user: { open_id: 'user', display_name: 'Clipper' } } });
  };
  const user = await real.getAccount({ providerUserId: 'user', accessToken: 'token', scopes: ['user.info.basic', 'video.list'] });
  assert.equal(user.displayName, 'Clipper'); assert.equal(user.followerCount, null);
});

test('Rate limits remain retryable; invalid refresh grants require login', async () => {
  global.fetch = async () => Response.json({}, { status: 429 });
  await assert.rejects(() => real.listVideos({ accessToken: 'token' }), e => e.kind === 'rate_limit');
  global.fetch = async () => Response.json({ error: 'invalid_grant' }, { status: 400 });
  await assert.rejects(() => real.refreshTokens('expired'), e => e.kind === 'auth');
});

test('Token renewal persists rotated credentials and rejects identity substitution', async () => {
  const writes = [];
  const db = { from() { return { update(payload) { writes.push(payload); return { eq: async () => ({ error: null }) }; } }; } };
  const manager = load('src/lib/sync/tokens.ts', {
    '@/lib/crypto/tokens': { decryptToken: x => x, encryptToken: x => 'encrypted:' + x, encryptOptional: x => x && 'encrypted:' + x },
    '@/lib/providers/types': types,
  });
  const account = { id: 'account', provider_user_id: 'user', access_token_enc: 'old', refresh_token_enc: 'refresh', access_expires_at: new Date(0).toISOString(), scopes: ['video.list'] };
  const refreshed = { providerUserId: 'user', accessToken: 'new', refreshToken: 'rotated', scopes: ['video.list'] };
  const provider = { refreshTokens: async token => { assert.equal(token, 'refresh'); return refreshed; } };
  await manager.usableTokens(db, provider, account);
  assert.equal(writes[0].refresh_token_enc, 'encrypted:rotated');
  refreshed.providerUserId = 'foreign';
  await assert.rejects(() => manager.usableTokens(db, provider, account), e => e.kind === 'auth');
  assert.equal(writes[1].status, 'needs_reauth');
});

test('Scheduler skips old public accounts and resumes incomplete official imports', async () => {
  const enqueued = [];
  const rows = [
    { id: 'legacy', provider_user_id: 'public:1' },
    { id: 'apify', provider_user_id: 'apify:2' },
    { id: 'mock', provider_user_id: 'mock-3' },
    { id: 'official', provider_user_id: 'open-id', discovery_cursor: '1000', last_discovered_at: new Date().toISOString() },
  ];
  const db = { from(table) {
    const data = { leaderboards: [{ id: 'board' }], leaderboard_participants: [{ clipper_profile_id: 'profile' }], social_accounts: rows, sync_jobs: [] }[table];
    const q = { select() { return q; }, eq() { return q; }, in() { return q; }, gte() { return q; }, limit() { return q; }, then(resolve) { return Promise.resolve({ data }).then(resolve); } }; return q;
  }, async rpc(name, args) { enqueued.push(args); return { data: 'job' }; } };
  const queue = load('src/lib/sync/queue.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/sync/account': {},
    '@/lib/providers/types': types, '@/lib/providers/registry': { isMockMode: () => false },
  });
  assert.equal((await queue.scheduleJobs()).enqueued, 2);
  assert.deepEqual(enqueued.map(x => [x.p_social_account_id, x.p_kind]), [['official', 'discover'], ['official', 'refresh']]);
});

test('Large imports persist and resume cursor; legacy accounts never call the provider', async () => {
  const account = { id: 'account', provider: 'tiktok', provider_user_id: 'open-id', status: 'connected' };
  const cursors = [], updates = [];
  let page = 0;
  const provider = { getAccount: async () => ({ providerUserId: 'open-id' }),
    listVideos: async (_tokens, options) => { cursors.push(options.cursor); page++; return { videos: [], hasMore: page < 4, cursor: String(5000 - page * 1000) }; } };
  const db = { from(table) {
    const q = { update(payload) { if (table === 'social_accounts') { Object.assign(account, payload); updates.push(payload); } return q; },
      select() { return q; }, eq() { return q; }, lt() { return q; }, maybeSingle: async () => ({ data: account }),
      then(resolve) { return Promise.resolve({ error: null }).then(resolve); } }; return q;
  }, rpc: async () => ({ error: null }) };
  const sync = load('src/lib/sync/account.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/providers/types': types,
    '@/lib/providers/registry': { isMockMode: () => false }, '@/lib/providers/tiktok': { tiktokProvider: provider },
    '@/lib/sync/tokens': { usableTokens: async () => ({}), markNeedsReauth: async () => { account.status = 'needs_reauth'; } },
    '@/lib/sync/thumbnails': {}, '@/lib/sync/history': { recomputeHistoryForAccount: async () => {} },
  });
  await sync.syncAccount('account');
  assert.deepEqual(cursors, [null, '4000', '3000']);
  assert.equal(account.discovery_cursor, '2000'); assert.equal(account.last_discovered_at, undefined);
  await sync.syncAccount('account');
  assert.equal(cursors[3], '2000'); assert.equal(account.discovery_cursor, null); assert.ok(account.last_discovered_at);
  account.provider_user_id = 'public:123';
  await assert.rejects(() => sync.syncAccount('account'), e => e.kind === 'auth');
  assert.equal(account.status, 'needs_reauth'); assert.equal(cursors.length, 4);
});
test('OAuth code is not decoded twice and absent permissions are not invented', async () => {
  global.fetch = async (_url, init) => {
    assert.equal(init.body.get('code'), 'code%2Fvalue');
    return new Response(JSON.stringify({ access_token: 'token', open_id: 'user' }));
  };
  const result = await real.exchangeCode('code%2Fvalue');
  assert.deepEqual(result.scopes, []);
});
test('Malformed video metrics fail rather than treating all videos as removed', async () => {
  global.fetch = async () => new Response(JSON.stringify({ data: {}, error: { code: 'ok' } }));
  await assert.rejects(() => real.getVideosByIds({ accessToken: 'token' }, ['123']), /incompletas/);
});
test('TikTok video metrics map actual returned counts', async () => {
  global.fetch = async () => new Response(JSON.stringify({ data: { videos: [{ id: '123', create_time: 1792868400, view_count: 120, like_count: 12, comment_count: 3, share_count: 4 }] }, error: { code: 'ok' } }));
  const result = await real.getVideosByIds({ accessToken: 'token' }, ['123']);
  assert.equal(result[0].views, 120); assert.equal(result[0].likes, 12); assert.equal(result[0].shares, 4);
});
const options = { leaderboardId: 'board', provider: 'tiktok', tokens: { providerUserId: 'user', accessToken: 'token', refreshToken: 'refresh', scopes: ['video.list'] }, account: { providerUserId: 'user', displayName: 'Test' } };
function joinHarness({ status = 'active', participation = 'active' } = {}) {
  const writes = [];
  const db = { from(table) {
    const result = { leaderboards: { status, platforms: ['tiktok'], ends_at: null }, social_accounts: { id: 'account', clipper_profile_id: 'profile' }, leaderboard_participants: { id: 'member', status: participation } }[table];
    const query = { select() { return query; }, eq() { return query; }, in() { return query; }, update(payload) { writes.push({ table, payload }); return query; }, insert() { throw new Error('Unexpected duplicate insertion'); },
      maybeSingle() { return Promise.resolve({ data: result }); }, then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); } };
    return query;
  }, rpc(name) { writes.push({ rpc: name }); return Promise.resolve({ error: null }); } };
  const join = load('src/lib/clippers/join.ts', { '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/crypto/tokens': { encryptToken: () => 'encrypted', encryptOptional: () => 'encrypted' } });
  return { writes, run: (input = options) => join.connectAccountToLeaderboard(input) };
}
test('Competition closed during OAuth rejects participation', async () => {
  const h = joinHarness({ status: 'ended' });
  await assert.rejects(h.run, /não aceita/); assert.equal(h.writes.length, 0);
});
test('Missing video permission and mismatched identity do not write accounts', async () => {
  const h = joinHarness();
  await assert.rejects(() => h.run({ ...options, tokens: { ...options.tokens, scopes: [] } }), /Autoriza/);
  await assert.rejects(() => h.run({ ...options, account: { providerUserId: 'another' } }), /Identidade/);
  assert.equal(h.writes.length, 0);
});
test('Reconnect reuses membership and queues import without inserting duplicates', async () => {
  const h = joinHarness(); const result = await h.run();
  assert.equal(result.participantId, 'member'); assert.equal(result.alreadyMember, true);
  assert.ok(h.writes.some(write => write.rpc === 'enqueue_sync_job'));
});

test('Disqualified participant cannot reactivate membership', async () => {
  const h = joinHarness({ participation: 'disqualified' });
  await assert.rejects(h.run, /desqualificada/);
  assert.equal(h.writes.filter(write => write.table === 'leaderboard_participants').length, 0);
});
test('Private clipper membership rejects a different competition slug', async () => {
  const db = { from(table) {
    const q = { select() { return q; }, eq() { return q; }, maybeSingle() { return Promise.resolve({ data: table === 'leaderboard_participants' ? { id: 'member', leaderboard_id: 'original' } : null }); } };
    return q;
  } };
  const session = load('src/lib/clippers/session.ts', { '@/lib/recap/session': { readClipperSession: async () => ({ participantId: 'member' }) }, '@/lib/supabase/admin': { createAdminClient: () => db } });
  assert.equal(await session.getClipperMembership('another-board'), null);
});
