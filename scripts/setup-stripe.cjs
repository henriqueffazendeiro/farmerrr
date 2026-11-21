/**
 * Configura a conta Stripe do farmerrr (pode correr-se várias vezes; não duplica nada):
 *   - produto "farmerrr" com os preços mensal (25 €) e anual (200 €), IVA incluído;
 *   - portal do cliente (mudar de plano, trocar cartão, faturas, cancelar no fim do período);
 *   - webhook para <NEXT_PUBLIC_APP_URL>/api/stripe/webhook.
 * Escreve STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY e STRIPE_WEBHOOK_SECRET no .env.local.
 *
 * Uso: node scripts/setup-stripe.cjs [--app-url=https://farmerrr-woad.vercel.app]
 * Precisa de STRIPE_SECRET_KEY no .env.local (sk_test_… para testar, sk_live_… para produção).
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const Stripe = require('stripe');

loadEnvConfig(process.cwd());
const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) { console.error('Falta STRIPE_SECRET_KEY no .env.local.'); process.exit(1); }
const arg = process.argv.find(value => value.startsWith('--app-url='));
const appUrl = (arg ? arg.slice(10) : process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
if (!appUrl.startsWith('https://')) { console.error('O webhook precisa de um endereço HTTPS público. Usa --app-url=https://…'); process.exit(1); }

const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
const EVENTS = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
  'customer.subscription.deleted', 'customer.subscription.trial_will_end', 'invoice.paid', 'invoice.payment_failed',
  // Prémios dos clippers
  'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired', 'charge.refunded'];
// Contas Stripe Express dos clippers (eventos das contas ligadas: webhook "Connect").
const CONNECT_EVENTS = ['account.updated'];

async function price(product, lookupKey, amount, interval) {
  const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })).data[0];
  if (existing) return existing;
  // Aproveita um preço igual criado à mão no dashboard (mesmo valor e período), dando-lhe o identificador.
  const manual = (await stripe.prices.list({ product: product.id, active: true, type: 'recurring', limit: 100 })).data
    .find(item => item.currency === 'eur' && item.unit_amount === amount && item.recurring?.interval === interval && item.recurring.interval_count === 1);
  if (manual) {
    const update = { lookup_key: lookupKey, nickname: interval === 'month' ? 'Mensal' : 'Anual' };
    if (manual.tax_behavior === 'unspecified' || !manual.tax_behavior) update.tax_behavior = 'inclusive';
    return stripe.prices.update(manual.id, update);
  }
  return stripe.prices.create({ product: product.id, currency: 'eur', unit_amount: amount, lookup_key: lookupKey,
    tax_behavior: 'inclusive', recurring: { interval }, nickname: interval === 'month' ? 'Mensal' : 'Anual' });
}

function writeEnv(values) {
  const file = path.join(process.cwd(), '.env.local');
  let text = fs.readFileSync(file, 'utf8');
  for (const [name, value] of Object.entries(values)) {
    const line = `${name}=${value}`;
    text = new RegExp(`^${name}=.*$`, 'm').test(text) ? text.replace(new RegExp(`^${name}=.*$`, 'm'), line) : `${text.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(file, text);
}

(async () => {
  const mode = key.startsWith('sk_live_') ? 'PRODUÇÃO (live)' : 'TESTE';
  console.log(`Conta Stripe em modo ${mode}. App: ${appUrl}`);

  // Produto: o marcado pelo script, ou um chamado "farmerrr…" criado à mão no dashboard, ou um novo.
  let product = (await stripe.products.search({ query: "metadata['app']:'farmerrr'" })).data[0];
  if (!product) {
    product = (await stripe.products.list({ active: true, limit: 100 })).data.find(item => item.name.toLowerCase().startsWith('farmerrr'));
    if (product) product = await stripe.products.update(product.id, { metadata: { app: 'farmerrr' } });
  }
  product = product
    ?? await stripe.products.create({ name: 'farmerrr',
      metadata: { app: 'farmerrr' }, tax_code: 'txcd_10103001' });
  const monthly = await price(product, 'farmerrr_monthly', 2500, 'month');
  const yearly = await price(product, 'farmerrr_yearly', 20000, 'year');
  console.log(`Produto ${product.id} · mensal ${monthly.id} · anual ${yearly.id}`);

  const portal = {
    business_profile: { headline: 'farmerrr — gerir a subscrição', privacy_policy_url: `${appUrl}/legal/privacidade`, terms_of_service_url: `${appUrl}/legal/termos` },
    default_return_url: `${appUrl}/dashboard`,
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id'] },
      subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'unused', 'missing_features', 'other'] } },
      subscription_update: { enabled: true, default_allowed_updates: ['price'], proration_behavior: 'create_prorations',
        products: [{ product: product.id, prices: [monthly.id, yearly.id] }] },
    },
  };
  const current = (await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 })).data[0];
  if (current) await stripe.billingPortal.configurations.update(current.id, portal);
  else await stripe.billingPortal.configurations.create(portal);
  console.log('Portal do cliente configurado.');

  // O segredo de um webhook só é mostrado quando é criado: se já existir, recria-se.
  const url = `${appUrl}/api/stripe/webhook`;
  for (const endpoint of (await stripe.webhookEndpoints.list({ limit: 100 })).data) {
    if (endpoint.url === url) await stripe.webhookEndpoints.del(endpoint.id);
  }
  const webhook = await stripe.webhookEndpoints.create({ url, enabled_events: EVENTS, api_version: '2025-02-24.acacia',
    description: 'farmerrr — subscrições e prémios' });
  console.log(`Webhook criado: ${url}`);
  // Precisa do Connect ativo na conta (dashboard do Stripe → Connect). Sem ele, os prémios ficam desligados mas o resto funciona.
  let connectSecret = '';
  try {
    const connect = await stripe.webhookEndpoints.create({ url, enabled_events: CONNECT_EVENTS, connect: true, api_version: '2025-02-24.acacia',
      description: 'farmerrr — contas dos clippers' });
    connectSecret = connect.secret;
    console.log('Webhook Connect criado.');
  } catch (error) { console.warn(`Webhook Connect não criado (ativa o Connect no dashboard do Stripe): ${error.message}`); }

  writeEnv({ STRIPE_PRICE_MONTHLY: monthly.id, STRIPE_PRICE_YEARLY: yearly.id, STRIPE_WEBHOOK_SECRET: webhook.secret,
    ...(connectSecret ? { STRIPE_CONNECT_WEBHOOK_SECRET: connectSecret } : {}) });
  console.log('Escrito no .env.local: STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, STRIPE_WEBHOOK_SECRET' + (connectSecret ? ', STRIPE_CONNECT_WEBHOOK_SECRET.' : '.'));
})().catch(error => { console.error('Falhou:', error.message); process.exit(1); });
