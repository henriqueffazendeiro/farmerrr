const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
if (!process.env.CRON_SECRET) throw new Error('CRON_SECRET em falta.');
let stopped = false;
process.on('SIGINT', () => { stopped = true; process.exit(0); });
async function tick() {
  try {
    const response = await fetch(new URL('/api/cron/streams', appUrl), {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      signal: AbortSignal.timeout(55_000),
    });
    if (!response.ok) console.error(`Verificacao de lives: HTTP ${response.status}.`);
    else {
      const result = await response.json();
      console.log(`Lives: ${result.checked} canais verificados; ${result.failed} falhas.`);
    }
  } catch { console.error('Servidor local indisponivel. Nova tentativa dentro de um minuto.'); }
  if (!stopped) setTimeout(tick, 60_000);
}
tick();
