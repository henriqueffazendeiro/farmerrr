const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());
const linked = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
if (linked.projectName !== 'farmerrr') throw new Error('Projeto Vercel inesperado.');
const packageDir = path.join(process.env.APPDATA, 'npm/node_modules/vercel');
const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const cli = path.join(packageDir, typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.vercel);
const values = {
  NEXT_PUBLIC_APP_URL: 'https://farmerrr-woad.vercel.app',
  NEXT_PUBLIC_APP_NAME: 'farmerrr',
  SOCIAL_PROVIDER: 'tiktok',
  TIKTOK_REDIRECT_URI: 'https://farmerrr-woad.vercel.app/api/auth/tiktok/callback',
};
for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'TOKEN_ENCRYPTION_KEY', 'CLIPPER_SESSION_SECRET', 'CRON_SECRET']) {
  if (!process.env[name]) throw new Error(`Falta ${name} na configuração local.`);
  values[name] = process.env[name];
}
for (const name of ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_API_KEY', 'KICK_CLIENT_ID', 'KICK_CLIENT_SECRET', 'NEXT_PUBLIC_GOOGLE_AUTH',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_CONNECT_WEBHOOK_SECRET', 'STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_YEARLY']) {
  if (process.env[name]) values[name] = process.env[name].trim();
}
// Produção só com credenciais reais: chaves sandbox do TikTok começam por "sb", as de teste do Stripe por "sk_test_".
// --allow-test ignora esta verificação (ex.: ensaio antes da aprovação).
if (!process.argv.includes('--allow-test')) {
  const problems = [];
  if (!values.TIKTOK_CLIENT_KEY || values.TIKTOK_CLIENT_KEY.startsWith('sb')) problems.push('TIKTOK_CLIENT_KEY é de sandbox (começa por "sb") ou está em falta: usa a Client Key da app de produção.');
  if (!values.TIKTOK_CLIENT_SECRET) problems.push('Falta TIKTOK_CLIENT_SECRET.');
  if (values.STRIPE_SECRET_KEY && !values.STRIPE_SECRET_KEY.startsWith('sk_live_') && !values.STRIPE_SECRET_KEY.startsWith('rk_live_')) problems.push('STRIPE_SECRET_KEY não é live (sk_live_…). Corre npm run stripe:setup -- --app-url=https://farmerrr-woad.vercel.app com a chave live.');
  if (problems.length) { console.error(['Configuração de produção recusada:', ...problems].join('\n- ')); process.exit(1); }
}
for (const [name, value] of Object.entries(values)) {
  const sensitive = /SECRET|SERVICE_ROLE|ENCRYPTION|API_KEY/.test(name);
  const result = spawnSync(process.execPath, [cli, 'env', 'add', name, 'production', '--force', ...(sensitive ? ['--sensitive'] : [])], {
    input: value, encoding: 'utf8', timeout: 60_000, windowsHide: true,
  });
  if (result.status !== 0) {
    console.error(`Falha ao configurar ${name}; valores e saída omitidos.`);
    process.exit(1);
  }
  console.log(`${name}: configurado`);
}
