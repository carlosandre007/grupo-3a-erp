import pg from 'pg';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';

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
if (!configuredRef || configuredRef !== projectRef) {
  throw new Error('Project ref local diverge do projeto vinculado.');
}
if (!database.SUPABASE_DB_PASSWORD) throw new Error('Senha administrativa local do banco não configurada.');

const sql = await readFile('plans/secure-delete-with-audit.sql', 'utf8');
if (/\b(create|alter|drop)\s+table\b/i.test(sql)) {
  throw new Error('SQL recusado: alteração de tabela fora do escopo.');
}
for (const table of ['banks', 'clients', 'properties', 'motorcycles', 'charges', 'transactions', 'fixed_costs']) {
  if (!sql.includes(`public.${table}`)) throw new Error(`Allowlist incompleta: ${table}.`);
}

const client = new pg.Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: database.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
});

const fictitiousId = crypto.randomUUID();
const fictitiousName = `TESTE RPC ROLLBACK ${fictitiousId}`;
const fictitiousInvoice = `TEST-${fictitiousId}`;
const operatorId = crypto.randomUUID();

const claims = (subject, role) => JSON.stringify({
  sub: subject,
  role: 'authenticated',
  app_metadata: { role, active: true },
});

const setAuthenticated = async (subject, role) => {
  await client.query('set local role authenticated');
  await client.query("select set_config('request.jwt.claims', $1, true)", [claims(subject, role)]);
};

const insertFictitiousCost = async id => {
  const inserted = await client.query(`
    insert into public.fixed_costs
    select (
      jsonb_populate_record(
        null::public.fixed_costs,
        to_jsonb(source)
          || jsonb_build_object(
            'id', $1::uuid,
            'name', $2::text,
            'invoice', $3::text,
            'recurrence_group_id', null
          )
      )
    ).*
    from public.fixed_costs source
    limit 1
    returning id
  `, [id, fictitiousName, fictitiousInvoice]);
  if (inserted.rowCount !== 1) throw new Error('Não foi possível criar o registro fictício transacional.');
};

try {
  await client.connect();

  const preflight = await client.query(`
    select
      current_database() database_name,
      to_regclass('public.deletion_logs') is not null deletion_logs_exists,
      (
        select array_agg(column_name order by ordinal_position)
        from information_schema.columns
        where table_schema = 'public' and table_name = 'deletion_logs'
      ) deletion_log_columns
  `);
  const expectedColumns = ['id', 'table_name', 'record_id', 'record_description', 'deleted_by', 'deleted_at'];
  const actualColumns = preflight.rows[0].deletion_log_columns ?? [];
  if (!preflight.rows[0].deletion_logs_exists || expectedColumns.some(column => !actualColumns.includes(column))) {
    throw new Error('deletion_logs inexistente ou incompatível.');
  }

  const owner = await client.query(
    "select id from public.profiles where role = 'owner' and active is true order by id limit 1",
  );
  if (!owner.rows[0]?.id) throw new Error('Nenhum proprietário ativo encontrado.');
  const ownerId = owner.rows[0].id;

  const before = await client.query('select count(*)::int count from public.deletion_logs');

  try {
    await client.query(sql);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }

  const functionCheck = await client.query(`
    select p.oid::regprocedure::text signature,
           p.prosecdef security_definer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'secure_delete_with_audit'
  `);
  if (functionCheck.rowCount !== 1 || !functionCheck.rows[0].security_definer) {
    throw new Error('RPC não foi instalada como SECURITY DEFINER.');
  }

  await client.query('begin');
  await insertFictitiousCost(fictitiousId);
  await client.query('savepoint direct_delete_test');
  let directDeleteBlocked = false;
  try {
    await setAuthenticated(ownerId, 'owner');
    await client.query('delete from public.fixed_costs where id = $1', [fictitiousId]);
  } catch {
    directDeleteBlocked = true;
    await client.query('rollback to savepoint direct_delete_test');
  }
  if (!directDeleteBlocked) throw new Error('DELETE direto não foi bloqueado.');

  await setAuthenticated(ownerId, 'owner');
  await client.query(
    'select public.secure_delete_with_audit($1, $2, $3, $4)',
    ['fixed_costs', fictitiousId, 'Teste controlado com rollback', '192.0.2.10'],
  );
  await client.query('reset role');

  const during = await client.query(`
    select
      (select count(*)::int from public.fixed_costs where id = $1) source_count,
      (select count(*)::int from public.deletion_logs where record_id = $1) log_count
  `, [fictitiousId]);
  if (during.rows[0].source_count !== 0 || during.rows[0].log_count !== 1) {
    throw new Error('A operação atômica não produziu o estado esperado.');
  }
  await client.query('rollback');

  const afterRollback = await client.query(`
    select
      (select count(*)::int from public.fixed_costs where id = $1) source_count,
      (select count(*)::int from public.deletion_logs where record_id = $1) log_count
  `, [fictitiousId]);
  if (afterRollback.rows[0].source_count !== 0 || afterRollback.rows[0].log_count !== 0) {
    throw new Error('O teste deixou resíduos após ROLLBACK.');
  }

  await client.query('begin');
  let unauthorizedBlocked = false;
  try {
    await setAuthenticated(operatorId, 'operator');
    await client.query(
      'select public.secure_delete_with_audit($1, $2, $3, $4)',
      ['fixed_costs', crypto.randomUUID(), 'Teste negado', null],
    );
  } catch {
    unauthorizedBlocked = true;
  }
  await client.query('rollback');
  if (!unauthorizedBlocked) throw new Error('Usuário não autorizado não foi bloqueado.');

  await client.query('begin');
  let moduleBlocked = false;
  try {
    await setAuthenticated(ownerId, 'owner');
    await client.query(
      'select public.secure_delete_with_audit($1, $2, $3, $4)',
      ['companies', crypto.randomUUID(), 'Teste de allowlist', null],
    );
  } catch {
    moduleBlocked = true;
  }
  await client.query('rollback');
  if (!moduleBlocked) throw new Error('Módulo fora da allowlist não foi bloqueado.');

  const after = await client.query('select count(*)::int count from public.deletion_logs');
  if (after.rows[0].count !== before.rows[0].count) {
    throw new Error('A quantidade de logs reais mudou durante os testes.');
  }

  console.log(JSON.stringify({
    projectRef,
    projectName: 'Grupo 3A ERP',
    database: preflight.rows[0].database_name,
    deletionLogsExists: true,
    deletionLogColumns: actualColumns,
    rpc: functionCheck.rows[0].signature,
    securityDefiner: true,
    ownerActiveConfirmed: true,
    directDeleteBlocked,
    atomicLogObservedBeforeCompletion: during.rows[0].log_count === 1,
    sourceDeletedInsideTest: during.rows[0].source_count === 0,
    rollback: 'OK',
    residues: 0,
    unauthorizedUserBlocked: unauthorizedBlocked,
    moduleOutsideAllowlistBlocked: moduleBlocked,
    realLogCountUnchanged: after.rows[0].count === before.rows[0].count,
    realRecordsDeleted: 0,
  }, null, 2));
} finally {
  await client.end().catch(() => undefined);
}
