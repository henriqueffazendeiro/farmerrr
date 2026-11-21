const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const origin = 'https://farmerrr-woad.vercel.app';
const routes = ['/api/cron/streams', '/api/cron/schedule', '/api/cron/sync?limit=1', '/api/cron/recaps'];

async function checkProductionCrons() {
  if (!process.env.CRON_SECRET) throw new Error('CRON_SECRET em falta.');
  for (const route of routes) {
    const url = new URL(route, origin);
    const denied = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    if (denied.status !== 401) throw new Error(`${route}: acesso sem chave não foi recusado com HTTP 401.`);
    const start = Date.now();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      redirect: 'manual', signal: AbortSignal.timeout(30000),
    });
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error(`${route}: resposta inesperada HTTP ${response.status}.`);
    }
    const body = await response.json();
    if (body.ok === false || body.failed > 0 || body.error) throw new Error(`${route}: o processamento reportou falhas.`);
    const fields = route.includes('/streams') ? ['checked', 'failed'] : route.includes('/schedule') ? ['accounts', 'enqueued'] : route.includes('/sync') ? ['processed', 'failed'] : ['generated'];
    if (fields.some(field => typeof body[field] !== 'number')) throw new Error(`${route}: resultado inválido.`);
    console.log(`${route}: OK (${Date.now() - start} ms); ${fields.map(field => `${field}=${body[field]}`).join(', ')}`);
  }
}
module.exports = { checkProductionCrons, origin };
if (require.main === module) checkProductionCrons().catch(error => {
  console.error(error.name === 'TimeoutError' ? 'Uma tarefa excedeu o limite de 30 segundos.' : error.message);
  process.exitCode = 1;
});
