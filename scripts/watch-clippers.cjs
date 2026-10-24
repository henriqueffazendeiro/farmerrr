const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
if (!process.env.CRON_SECRET) throw new Error('CRON_SECRET em falta.');
const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
async function call(route) {
  const response = await fetch(new URL(route, origin), {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }, signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function tick() {
  try {
    await call('/api/cron/schedule');
    const result = await call('/api/cron/sync?limit=1');
    console.log(`Clippers: ${result.processed} pedidos processados, ${result.failed} falhas.`);
  } catch { console.error('Não foi possível atualizar os clippers. Nova tentativa dentro de um minuto.'); }
  setTimeout(tick, 60_000);
}
tick();
