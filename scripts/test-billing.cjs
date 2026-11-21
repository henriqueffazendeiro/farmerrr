const { test } = require('node:test');
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

/** Base de dados falsa: guarda a linha de `subscriptions` e o dono do creator. */
function fakeDb(row) {
  const state = { row, writes: [] };
  const db = { from(table) {
    const builder = {
      select() { return builder; }, eq() { return builder; },
      async maybeSingle() { return { data: table === 'creators' ? { owner_id: 'owner' } : state.row, error: null }; },
      async upsert(value) { state.writes.push(value); state.row = { ...state.row, ...value }; return { error: null }; },
    };
    return builder;
  } };
  return { state, db };
}

function billing(row, env = {}) {
  const { state, db } = fakeDb(row);
  for (const name of ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_YEARLY']) delete process.env[name];
  Object.assign(process.env, env);
  const mod = load('src/lib/billing/stripe.ts', { '@/lib/supabase/admin': { createAdminClient: () => db }, stripe: function Stripe() {} });
  return { mod, state };
}
const configured = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PRICE_MONTHLY: 'price_m', STRIPE_PRICE_YEARLY: 'price_y' };
const sub = (over = {}) => ({ id: 'sub_1', customer: 'cus_1', status: 'trialing', metadata: { profile_id: 'owner' },
  items: { data: [{ price: { id: 'price_y' } }] }, trial_end: 1767225600, current_period_end: 1767225600, ...over });

test('Without Stripe keys nothing is blocked (pages stay public)', async () => {
  const { mod } = billing(null);
  assert.equal(mod.billingConfigured(), false);
  assert.equal(await mod.creatorHasAccess('creator'), true);
});

test('With Stripe configured, only trialing / active / past_due keep the page public', async () => {
  for (const [status, expected] of [['trialing', true], ['active', true], ['past_due', true], ['canceled', false], ['incomplete', false]]) {
    const { mod } = billing({ status }, configured);
    assert.equal(await mod.creatorHasAccess('creator'), expected, status);
  }
  const { mod } = billing(null, configured);
  assert.equal(await mod.creatorHasAccess('creator'), false, 'sem subscrição');
});

test('Stripe subscription is saved with plan, dates and mapped status', async () => {
  const { mod, state } = billing(null, configured);
  await mod.saveSubscription(sub());
  assert.deepEqual(state.writes[0], { profile_id: 'owner', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'trialing',
    plan: 'yearly', trial_ends_at: '2026-01-01T00:00:00.000Z', current_period_end: '2026-01-01T00:00:00.000Z' });
  for (const [stripeStatus, ours] of [['unpaid', 'canceled'], ['incomplete_expired', 'canceled'], ['paused', 'canceled'], ['incomplete', 'incomplete']]) {
    const h = billing(null, configured);
    await h.mod.saveSubscription(sub({ status: stripeStatus }));
    assert.equal(h.state.writes[0].status, ours, stripeStatus);
  }
});

test('An old canceled subscription never overwrites the current active one', async () => {
  const { mod, state } = billing({ stripe_subscription_id: 'sub_new', status: 'active' }, configured);
  await mod.saveSubscription(sub({ id: 'sub_old', status: 'canceled' }));
  assert.equal(state.writes.length, 0);
  await mod.saveSubscription(sub({ id: 'sub_new', status: 'past_due' }));
  assert.equal(state.writes[0].status, 'past_due');
});

test('A subscription without profile is found through the Stripe customer', async () => {
  const { mod, state } = billing({ profile_id: 'owner' }, configured);
  await mod.saveSubscription(sub({ metadata: {} }));
  assert.equal(state.writes[0].profile_id, 'owner');
});
