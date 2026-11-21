const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
async function api(path) {
  const response = await fetch(`https://api.cron-job.org${path}`, {
    headers: { Authorization: `Bearer ${process.env.CRONJOB_API_KEY}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Agendador: HTTP ${response.status}`);
  return response.json();
}
async function main() {
  if (!process.env.CRONJOB_API_KEY) throw new Error('CRONJOB_API_KEY em falta.');
  const result = await api('/jobs');
  if (result.someFailed || !Array.isArray(result.jobs)) throw new Error('Lista de tarefas incompleta.');
  const jobs = result.jobs.filter(job => job.url.startsWith('https://farmerrr-woad.vercel.app/api/cron/'));
  if (jobs.length !== 4 || jobs.some(job => !job.enabled)) throw new Error('As quatro tarefas não estão todas ativas.');
  for (const job of jobs) {
    const { history } = await api(`/jobs/${job.jobId}/history`);
    const last = history?.[0];
    console.log(JSON.stringify({ title: job.title, enabled: job.enabled,
      nextExecution: job.nextExecution ? new Date(job.nextExecution * 1000).toISOString() : null,
      last: last ? { httpStatus: last.httpStatus, status: last.status, duration: last.duration } : 'aguarda primeira execução' }));
    if (last && (last.httpStatus !== 200 || last.status !== 1)) process.exitCode = 1;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
