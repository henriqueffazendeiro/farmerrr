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
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return mod.exports;
}
const types = load('src/lib/providers/types.ts');
const real = load('src/lib/providers/tiktok/index.ts', {
  '@/lib/config/env': { serverEnv: () => ({ TIKTOK_CLIENT_KEY: 'key', TIKTOK_CLIENT_SECRET: 'secret' }), publicEnv: { NEXT_PUBLIC_APP_URL: 'https://test.example' } },
  '@/lib/providers/types': types,
}).tiktokProvider;
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });
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
    const query = { select() { return query; }, eq() { return query; }, update(payload) { writes.push({ table, payload }); return query; }, insert() { throw new Error('Unexpected duplicate insertion'); },
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
