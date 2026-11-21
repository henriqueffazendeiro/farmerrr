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
  mod.require = name => name in mocks ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}

const model = load('src/lib/prizes/model.ts', { '@/lib/period': { ALL_TIME: 'all' } });

test('Platform keeps 5% of each prize; the clipper gets the rest', () => {
  assert.equal(model.feeFor(30000), 1500);
  assert.equal(model.netOf(30000), 28500);
  assert.equal(model.feeFor(999) + model.netOf(999), 999);
});

test('Each prize goes to whoever finished in that position; empty positions are not charged', () => {
  const rewards = [{ position: 2, amount_cents: 20000 }, { position: 1, amount_cents: 30000 }, { position: 3, amount_cents: 10000 },
    { position: 4, amount_cents: null }];
  const ranked = [{ rank: 1, participantId: 'p1', clipperProfileId: 'c1' }, { rank: 2, participantId: 'p2', clipperProfileId: 'c2' },
    { rank: 4, participantId: 'p4', clipperProfileId: 'c4' }];
  assert.deepEqual(model.splitPrizes(rewards, ranked), [
    { position: 1, amountCents: 30000, participantId: 'p1', clipperProfileId: 'c1' },
    { position: 2, amountCents: 20000, participantId: 'p2', clipperProfileId: 'c2' },
  ]);
});

test('Monthly boards can pay past months only; fixed boards only after they end', () => {
  const monthly = { period_mode: 'monthly', ends_at: null, status: 'active' };
  assert.deepEqual(model.closedPeriods(monthly, ['all', '2026-09', '2026-11', '2026-10', '2026-10'], '2026-11'), ['2026-10', '2026-09']);
  const fixed = { period_mode: 'fixed', ends_at: '2026-11-01T00:00:00Z', status: 'active' };
  assert.deepEqual(model.closedPeriods(fixed, ['all'], 'all', Date.parse('2026-10-31T00:00:00Z')), []);
  assert.deepEqual(model.closedPeriods(fixed, ['all'], 'all', Date.parse('2026-11-02T00:00:00Z')), ['all']);
  assert.deepEqual(model.closedPeriods({ ...fixed, ends_at: null, status: 'ended' }, ['all'], 'all'), ['all']);
  const endedMonthly = { period_mode: 'monthly', ends_at: '2026-11-21T15:24:00Z', status: 'active' };
  assert.deepEqual(model.closedPeriods(endedMonthly, ['2026-11', '2026-10'], '2026-11', Date.parse('2026-11-21T16:00:00Z')), ['2026-11', '2026-10']);
  assert.deepEqual(model.closedPeriods(endedMonthly, ['2026-11', '2026-10'], '2026-11', Date.parse('2026-11-21T15:00:00Z')), ['2026-10']);
});

const period = load('src/lib/period.ts');

test('Monthly dates: the same days repeat next month', () => {
  const lb = { timezone: 'Europe/London', starts_at: '2026-11-01T13:04:00Z', ends_at: '2026-11-21T15:24:00Z' };
  const next = period.nextMonthlyDates(lb, Date.parse('2026-11-25T00:00:00Z'));
  assert.equal(next.starts.toISOString(), '2026-12-01T13:04:00.000Z');
  assert.equal(next.ends.toISOString(), '2026-12-21T15:24:00.000Z');
  // Entregue muito tarde (já passou o fim do mês seguinte): salta para o primeiro mês com o fim no futuro.
  assert.equal(period.nextMonthlyDates(lb, Date.parse('2026-12-25T00:00:00Z')).ends.toISOString(), '2027-01-21T15:24:00.000Z');
  // 31 jan → 28 fev; a hora local mantém-se com a mudança de hora.
  assert.equal(period.addMonthsLocal(new Date('2027-01-31T10:00:00Z'), 1, 'Europe/London').toISOString(), '2027-02-28T10:00:00.000Z');
  assert.equal(period.addMonthsLocal(new Date('2027-03-21T10:00:00Z'), 1, 'Europe/Lisbon').toISOString(), '2027-04-21T09:00:00.000Z');
});

test('Monthly dates: key, bounds, countdown and pause', () => {
  const lb = { period_mode: 'monthly', timezone: 'Europe/London', status: 'active', starts_at: '2026-12-01T13:04:00Z', ends_at: '2026-12-21T15:24:00Z' };
  assert.equal(period.currentPeriodKey(lb), '2026-12');
  assert.deepEqual(period.periodBounds(lb, '2026-12'), { from: new Date('2026-12-01T13:04:00Z'), to: new Date('2026-12-21T15:24:00Z') });
  assert.equal(period.currentPeriodEnd(lb, Date.parse('2026-11-25T00:00:00Z')), '2026-12-01T13:04:00.000Z'); // ainda não começou
  assert.equal(period.currentPeriodEnd(lb, Date.parse('2026-12-10T00:00:00Z')), '2026-12-21T15:24:00.000Z'); // a decorrer
  assert.equal(period.currentPeriodEnd(lb, Date.parse('2026-12-22T00:00:00Z')), null); // em pausa
  assert.equal(period.isPaused(lb, Date.parse('2026-12-22T00:00:00Z')), true);
  assert.equal(period.isPaused({ ...lb, status: 'ended' }, Date.parse('2026-12-22T00:00:00Z')), false);
  // Sem data de fim: meses do calendário, como antes.
  assert.equal(period.isPaused({ ...lb, ends_at: null }, Date.parse('2026-12-22T00:00:00Z')), false);
});
