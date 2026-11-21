const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(relative);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name in mocks ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return mod.exports;
}
const { onboardingSchema } = load('src/lib/onboarding/schema.ts');
const valid = { period: 'monthly', startsAt: '2026-11-01T00:00:00Z', endsAt: null, timezone: 'Europe/Lisbon', platform: 'youtube', channel: '@teste' };
test('Monthly and fixed periods validate dates, timezone and supported platforms', () => {
  assert.equal(onboardingSchema.safeParse(valid).success, true);
  assert.equal(onboardingSchema.safeParse({ ...valid, period: 'fixed' }).success, false);
  assert.equal(onboardingSchema.safeParse({ ...valid, period: 'fixed', endsAt: '2026-10-01T00:00:00Z' }).success, false);
  assert.equal(onboardingSchema.safeParse({ ...valid, period: 'fixed', endsAt: '2026-12-01T00:00:00Z' }).success, true);
  assert.equal(onboardingSchema.safeParse({ ...valid, timezone: 'invalid' }).success, false);
  assert.equal(onboardingSchema.safeParse({ ...valid, platform: 'invalid' }).success, false);
});
function harness({ signedIn = true, existing = false, period = 'monthly' } = {}) {
  const writes = [];
  const creator = { id: 'creator123', owner_id: 'owner', name: 'Teste', handle: 'teste' };
  const client = { from(table) {
    let operation = 'read'; let payload;
    const builder = {
      select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
      insert(value) { operation = 'insert'; payload = value; writes.push({ table, payload }); return this; },
      async maybeSingle() { return { data: table === 'creators' ? creator : table === 'leaderboards' && existing ? { slug: 'existing' } : null, error: null }; },
      async single() { assert.equal(operation, 'insert'); return { data: table === 'stream_connections' ? { id: 'connection' } : { slug: payload.slug }, error: null }; },
    };
    return builder;
  }, rpc: async () => ({ data: true, error: null }) };
  const action = load('src/lib/onboarding/actions.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { getCurrentUser: async () => signedIn ? { id: 'owner' } : null, createClient: async () => client },
    '@/lib/supabase/admin': { createAdminClient: () => client },
    '@/lib/slug': { slugify: value => value.toLowerCase(), validateSlug: () => null },
    '@/lib/streams/public-input': { normalizeStreamChannel: () => 'https://www.youtube.com/@teste' },
    '@/lib/streams/public-provider': { PUBLIC_STREAM_MARKER: 'public',
      readPublicChannel: async () => ({ channel_id: 'channel', channel_name: 'Teste', channel_url: 'https://www.youtube.com/channel/channel', streams: [] }) },
    '@/lib/streams/sync': { syncStreamConnection: async () => ({ live: 0 }) },
    '@/lib/auth/rate-key': { trackingRateKey: value => value },
    './schema': { onboardingSchema },
  });
  return { writes, run: () => action.finishOnboarding({ ...valid, period, endsAt: period === 'fixed' ? '2026-12-01T00:00:00Z' : null }) };
}
test('Unauthenticated setup cannot create records', async () => {
  const h = harness({ signedIn: false }); assert.ok((await h.run()).error); assert.equal(h.writes.length, 0);
});
test('Repeated setup returns the existing page without modifying it', async () => {
  const h = harness({ existing: true }); assert.equal((await h.run()).slug, 'existing'); assert.equal(h.writes.length, 0);
});
test('Setup persists custom periods and uses the public YouTube connection without OAuth', async () => {
  const h = harness({ period: 'fixed' }); assert.equal((await h.run()).slug, 'teste');
  assert.equal(h.writes.find(row => row.table === 'leaderboards').payload.period_mode, 'fixed');
  assert.equal(h.writes.find(row => row.table === 'stream_connections').payload.access_token_enc, 'public');
});
