import pg from 'pg';
import dns from 'node:dns/promises';
import { readFile } from 'node:fs/promises';

const parse = text => Object.fromEntries(
  text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const position = line.indexOf('=');
      return [line.slice(0, position).trim(), line.slice(position + 1).trim()];
    }),
);

const local = parse(await readFile('.env.local', 'utf8'));
const database = parse(await readFile('.env.supabase.local', 'utf8'));
const config = await readFile('supabase/config.toml', 'utf8');
const configuredRef = config.match(/project_id\s*=\s*"([^"]+)"/)?.[1];
const projectRef = new URL(local.VITE_SUPABASE_URL).hostname.split('.')[0];
if (!configuredRef || configuredRef !== projectRef) throw new Error('Project ref local diverge do projeto vinculado.');
if (!database.SUPABASE_DB_PASSWORD) throw new Error('Credencial administrativa local ausente.');

const sql = await readFile('plans/manual-invested-current.sql', 'utf8');
for (const required of ['public.app_settings', 'public.app_setting_history', 'public.set_manual_invested_current']) {
  if (!sql.includes(required)) throw new Error(`SQL incompleto: ${required}.`);
}
const forbidden = ['banks', 'transactions', 'fixed_costs', 'charges', 'clients', 'companies'];
if (forbidden.some(table => new RegExp(`(?:insert into|update|delete from|alter table)\\s+public\\.${table}`, 'i').test(sql))) {
  throw new Error('SQL recusado: tabela financeira fora do escopo.');
}

const hostname = `db.${projectRef}.supabase.co`;
const [host] = await dns.resolve4(hostname);
const client = new pg.Client({
  host,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: database.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false, servername: hostname },
  connectionTimeoutMillis: 20_000,
});

try {
  await client.connect();
  const identity = await client.query('select current_database() database, current_user');
  const financialBefore = await client.query(`
    select
      (select count(*)::int from public.transactions) transactions,
      (select count(*)::int from public.banks) banks,
      (select count(*)::int from public.fixed_costs) fixed_costs,
      (select count(*)::int from public.charges) charges
  `);
  await client.query(sql);
  const validation = await client.query(`
    select
      to_regclass('public.app_settings') is not null app_settings,
      to_regclass('public.app_setting_history') is not null app_setting_history,
      to_regprocedure('public.set_manual_invested_current(numeric)') is not null rpc,
      (select count(*)::int from public.app_settings where setting_key = 'invested_current') current_values,
      (select count(*)::int from public.app_setting_history where setting_key = 'invested_current') history_rows
  `);

  const actor = await client.query(`
    select id, role
    from public.profiles
    where active is true and role in ('owner', 'admin')
    order by case when role = 'owner' then 0 else 1 end, id
    limit 1
  `);
  if (!actor.rows[0]?.id) throw new Error('Nenhum owner/admin ativo encontrado para o teste.');
  const original = validation.rows[0];
  const claims = JSON.stringify({
    sub: actor.rows[0].id,
    role: 'authenticated',
    app_metadata: { role: actor.rows[0].role, active: true },
  });

  await client.query('begin');
  await client.query('set local role authenticated');
  await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  await client.query('select public.set_manual_invested_current($1)', [12345.67]);
  const duringTest = await client.query(`
    select
      (select numeric_value from public.app_settings where setting_key = 'invested_current') value,
      (select count(*)::int from public.app_setting_history where setting_key = 'invested_current') history_rows
  `);
  if (Number(duringTest.rows[0].value) !== 12345.67 || duringTest.rows[0].history_rows !== original.history_rows + 1) {
    throw new Error('RPC nao produziu valor e historico esperados dentro do teste.');
  }
  await client.query('rollback');

  const afterRollback = await client.query(`
    select
      (select count(*)::int from public.app_settings where setting_key = 'invested_current') current_values,
      (select count(*)::int from public.app_setting_history where setting_key = 'invested_current') history_rows
  `);
  if (afterRollback.rows[0].current_values !== original.current_values
      || afterRollback.rows[0].history_rows !== original.history_rows) {
    throw new Error('Teste controlado deixou residuos apos rollback.');
  }

  await client.query('begin');
  await client.query('set local role authenticated');
  await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  let negativeBlocked = false;
  try {
    await client.query('select public.set_manual_invested_current($1)', [-1]);
  } catch {
    negativeBlocked = true;
  }
  await client.query('rollback');
  if (!negativeBlocked) throw new Error('Valor negativo nao foi bloqueado.');

  const financialAfter = await client.query(`
    select
      (select count(*)::int from public.transactions) transactions,
      (select count(*)::int from public.banks) banks,
      (select count(*)::int from public.fixed_costs) fixed_costs,
      (select count(*)::int from public.charges) charges
  `);
  if (JSON.stringify(financialAfter.rows[0]) !== JSON.stringify(financialBefore.rows[0])) {
    throw new Error('Contagens financeiras divergiram durante a operacao.');
  }
  console.log(JSON.stringify({
    projectRef,
    database: identity.rows[0].database,
    ...validation.rows[0],
    activeRoleTested: actor.rows[0].role,
    rpcValueObservedInsideTransaction: Number(duringTest.rows[0].value),
    historyCreatedInsideTransaction: duringTest.rows[0].history_rows === original.history_rows + 1,
    rollback: 'OK',
    residues: 0,
    negativeValueBlocked: negativeBlocked,
    financialCountsBefore: financialBefore.rows[0],
    financialCountsAfter: financialAfter.rows[0],
    financialValuesChanged: false,
  }, null, 2));
} finally {
  await client.end().catch(() => undefined);
}
