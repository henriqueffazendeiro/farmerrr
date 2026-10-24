const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !secretKey) {
    console.error('Faltam variaveis do Supabase em .env.local.');
    process.exitCode = 1;
    return;
  }
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const publicClient = createClient(url, publicKey, options);
  const adminClient = createClient(url, secretKey, options);
  const checks = [
    ['Acesso publico', () => publicClient.from('leaderboards').select('id').limit(1)],
    ['Lives publicas', () => publicClient.from('creator_lives').select('id').limit(1)],
    ...['profiles', 'creators', 'leaderboards', 'monthly_recaps', 'stream_connections', 'creator_lives'].map(table =>
      [table, () => adminClient.from(table).select('id', { head: true }).limit(1)]),
    ['Autenticacao administrativa', () => adminClient.auth.admin.listUsers({ page: 1, perPage: 1 })],
  ];
  for (const [label, run] of checks) {
    const { error } = await run();
    if (error) {
      const message = String(error.message || 'Sem detalhes').split(publicKey).join('[chave]').split(secretKey).join('[chave]');
      console.error(`${label}: falhou (codigo ${error.code || error.status || 'indisponivel'}): ${message}`);
      process.exitCode = 1;
    } else {
      console.log(`${label}: OK`);
    }
  }
}
main().catch(() => {
  console.error('Nao foi possivel concluir a verificacao da ligacao.');
  process.exitCode = 1;
});
