import pg from 'pg';
import { readFile } from 'node:fs/promises';
const parse = text => Object.fromEntries(text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; }));
const env = { ...parse(await readFile('.env.local', 'utf8')), ...parse(await readFile('.env.supabase.local', 'utf8')) };
const projectRef = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const client = new pg.Client({ host: `db.${projectRef}.supabase.co`, port: 5432, database: 'postgres', user: 'postgres', password: env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  const result = await client.query("select status, expected_inserts, inserted_count, error_message from public.restore_operations where status='failed' order by created_at desc limit 5");
  console.log(JSON.stringify({ projectRef, failures: result.rows }, null, 2));
} finally { await client.end().catch(() => {}); }
