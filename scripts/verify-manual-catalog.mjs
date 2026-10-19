// Disposable PostgreSQL only: no .env, production connection or real catalog.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const name = `zalen-catalog-test-${process.pid}`;
const run = (args, input = '') => new Promise((resolve, reject) => {
  const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', part => { output += part; }); child.stderr.on('data', part => { output += part; });
  child.on('error', reject); child.on('close', code => code === 0 ? resolve(output) : reject(new Error(output))); child.stdin.end(input);
});
const sql = (source, user = 'postgres') => run(['exec', '-i', name, 'psql', '-U', user, '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1'], source);
try {
  await run(['run', '--detach', '--rm', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'public.ecr.aws/supabase/postgres:17.6.1.167']);
  for (let attempt=0; ; attempt++) {
    try { await run(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); break; }
    catch (error) { if(attempt===20) throw error; await new Promise(resolve => setTimeout(resolve,500)); }
  }
  await sql('alter table auth.users add column if not exists deleted_at timestamptz;', 'supabase_admin');
  for (const file of ['supabase/tests/platform_store_provisioning.bootstrap.sql','supabase/migrations/20261019150054_platform_store_provisioning.sql','supabase/tests/manual_catalog.bootstrap.sql']) await sql(await readFile(file,'utf8'));
  const initial = await readFile('supabase/migrations/20240101000000_initial_schema.sql','utf8');
  await sql(initial.slice(initial.indexOf('create table product_variants ('),initial.indexOf('-- PEDIDOS')) .replace(/-- =+\s*$/, ''));
  await sql("alter table public.categories enable row level security; grant select on public.categories to anon,authenticated; create policy public_can_read_categories on public.categories for select to anon,authenticated using(exists(select 1 from public.stores where id=categories.store_id and status='active')); grant all on all tables in schema public to service_role;");
  await sql(await readFile('supabase/migrations/20261019184654_manual_catalog_management.sql','utf8'));
  await sql(await readFile('supabase/tests/manual_catalog.sql','utf8'), 'supabase_admin');
  console.log('Manual catalog: atomic create/edit, retries, SKU collision, cross-store/ERP/viewer isolation and private draft checks passed.');
} finally { await run(['rm','--force',name]).catch(() => {}); }
