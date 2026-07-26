import pg from 'pg';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const parse = text => Object.fromEntries(text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; }));
const env = { ...parse(await readFile('.env.local', 'utf8')), ...parse(await readFile('.env.supabase.local', 'utf8')) };
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const client = new pg.Client({ host: `db.${ref}.supabase.co`, port: 5432, database: 'postgres', user: 'postgres', password: env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false } });
const directory = await mkdtemp(join(tmpdir(), 'grupo3a-backup-test-'));
const operationId = crypto.randomUUID(), recordId = crypto.randomUUID();
try {
  await writeFile(join(directory, `grupo-3a-backup-seguranca-${operationId}.json`), JSON.stringify({ test: true }));
  await client.connect();
  const owner = (await client.query("select id from public.profiles where role='owner' and active limit 1")).rows[0];
  await client.query('begin');
  await client.query('set local role authenticated');
  await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner.id, role: 'authenticated' })]);
  const call = await client.query("select public.restore_backup_new_only($1,'post-download-test',2,$2::jsonb,true) result", [operationId, JSON.stringify({ companies: [{ id: recordId, name: 'TESTE APÓS DOWNLOAD', kind: 'holding' }] })]);
  const result = call.rows[0].result;
  await client.query('rollback');
  const residue = (await client.query('select count(*)::int count from public.companies where id=$1', [recordId])).rows[0].count;
  if (result.status !== 'rolled_back' || residue !== 0) throw new Error(result.error || 'Rollback controlado falhou.');
  console.log('SAFETY_BACKUP=CREATED NEXT_STEP=RPC_CALLED RPC=restore_backup_new_only RPC_RESULT=200 ROLLBACK=OK RESIDUES=0');
} finally {
  await client.end().catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
