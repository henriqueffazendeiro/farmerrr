const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { checkProductionCrons, origin } = require('./check-production-crons.cjs');
const definitions = [
  { title: 'farmerrr · Detetar lives', path: '/api/cron/streams', minutes: [-1] },
  { title: 'farmerrr · Agendar clippers', path: '/api/cron/schedule', minutes: [0, 15, 30, 45] },
  { title: 'farmerrr · Atualizar clippers', path: '/api/cron/sync?limit=1', minutes: [-1] },
  { title: 'farmerrr · Gerar recaps', path: '/api/cron/recaps', minutes: [5] },
];
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.cron-job.org${path}`, {
    method, headers: { Authorization: `Bearer ${process.env.CRONJOB_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`API do agendador: HTTP ${response.status}.`);
  return response.json();
}
async function main() {
  if (!process.env.CRONJOB_API_KEY) throw new Error('Guarda CRONJOB_API_KEY em .env.local para configurar a tua conta.');
  if (!process.env.CRON_SECRET) throw new Error('CRON_SECRET em falta.');
  const listed = await api('/jobs');
  if (listed.someFailed || !Array.isArray(listed.jobs)) throw new Error('Não foi possível obter a lista completa de tarefas.');
  const targets = definitions.map(definition => {
    const url = new URL(definition.path, origin).href;
    const matching = listed.jobs.filter(job => job.url === url);
    if (matching.length > 1) throw new Error(`Há tarefas duplicadas para ${definition.path}; rever antes de ativar.`);
    return { definition, url, existing: matching[0] };
  });
  if (!process.argv.includes('--activate')) {
    for (const target of targets) console.log(`${target.definition.title}: ${target.existing ? 'atualizar' : 'criar'}; ${target.url}`);
    console.log('Plano validado. Usa --activate para testar as rotas e ativar as quatro tarefas.');
    return;
  }
  await checkProductionCrons();
  const prepared = [];
  for (const target of targets) {
    const job = { title: target.definition.title, url: target.url, enabled: false,
      saveResponses: false, requestMethod: 0, requestTimeout: 30, redirectSuccess: false,
      extendedData: { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } },
      schedule: { timezone: 'UTC', expiresAt: 0, hours: [-1], mdays: [-1], months: [-1], wdays: [-1], minutes: target.definition.minutes },
    };
    let id = target.existing?.jobId;
    if (id) await api(`/jobs/${id}`, 'PATCH', { job });
    else { id = (await api('/jobs', 'PUT', { job })).jobId; }
    if (!Number.isInteger(id)) throw new Error('O agendador não devolveu um ID de tarefa válido.');
    prepared.push({ id, title: job.title });
    console.log(`${job.title}: preparada (${id})`);
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  for (const job of prepared) {
    await api(`/jobs/${job.id}`, 'PATCH', { job: { enabled: true } });
    const details = (await api(`/jobs/${job.id}`)).jobDetails;
    if (!details?.enabled) throw new Error(`Não foi possível confirmar a ativação de ${job.title}.`);
    console.log(`${job.title}: ATIVA (${job.id})`);
    await new Promise(resolve => setTimeout(resolve, 600));
  }
}
main().catch(error => { console.error(error.name === 'TimeoutError' ? 'O serviço demorou demasiado a responder.' : error.message); process.exitCode = 1; });
