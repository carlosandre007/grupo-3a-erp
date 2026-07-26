import { readFile } from 'node:fs/promises';
import pg from 'pg';

const projectRef = 'eupfkkazjmprmaqdmlcm';
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) throw new Error('SUPABASE_DB_PASSWORD não informada para esta execução.');
const client = new pg.Client({ host: `db.${projectRef}.supabase.co`, port: 5432, database: 'postgres', user: 'postgres', password, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });

const mode = process.argv[2] || 'check';
try {
  await client.connect();
  if (mode === 'check') {
    const result = await client.query("select count(*)::int as count from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name not in ('schema_migrations')");
    console.log(`PROJECT_REF=${projectRef}`);
    console.log(`PUBLIC_USER_TABLES=${result.rows[0].count}`);
  } else if (mode === 'apply') {
    const result = await client.query("select count(*)::int as count from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name not in ('schema_migrations')");
    if (result.rows[0].count !== 0) throw new Error('Aplicação bloqueada: o schema public não está vazio.');
    const migration = await readFile(new URL('../supabase/migrations/202607190001_initial_erp_schema.sql', import.meta.url), 'utf8');
    if (/\b(drop|truncate)\b/i.test(migration)) throw new Error('Migration bloqueada por conter comando destrutivo.');
    await client.query(migration);
    console.log('MIGRATION_APPLIED=YES');
  } else if (mode === 'profiles') {
    const owner = process.env.OWNER_EMAIL;
    const admin = process.env.ADMIN_EMAIL;
    const result = await client.query('select id,email from auth.users where email = any($1::text[])', [[owner, admin]]);
    const found = new Map(result.rows.map(row => [row.email.toLowerCase(), row.id]));
    if (found.has(owner.toLowerCase())) await client.query("insert into public.profiles(id,display_name,role) values($1,'Proprietário','owner') on conflict(id) do update set role='owner',active=true,updated_at=now()", [found.get(owner.toLowerCase())]);
    if (found.has(admin.toLowerCase())) await client.query("insert into public.profiles(id,display_name,role) values($1,'Administrador','admin') on conflict(id) do update set role='admin',active=true,updated_at=now()", [found.get(admin.toLowerCase())]);
    console.log(`OWNER_PROFILE=${found.has(owner.toLowerCase()) ? 'LINKED' : 'MISSING'}`);
    console.log(`ADMIN_PROFILE=${found.has(admin.toLowerCase()) ? 'LINKED' : 'MISSING'}`);
  } else if (mode === 'configure-access') {
    const admin = process.env.ADMIN_EMAIL;
    const adminUser = await client.query('select id from auth.users where email=$1', [admin]);
    if (!adminUser.rowCount) throw new Error('Administrador não encontrado no Auth.');
    const companies = [['LOC MOTTUS','loc_mottus'],['3A RASTREAR','rastrear'],['IMÓVEIS','imoveis'],['HOLDING GRUPO 3A','holding']];
    for (const [name,kind] of companies) { const company=await client.query('insert into public.companies(name,kind) values($1,$2) on conflict(name) do update set active=true returning id',[name,kind]); await client.query('insert into public.profile_companies(profile_id,company_id) values($1,$2) on conflict do nothing',[adminUser.rows[0].id,company.rows[0].id]); }
    console.log('COMPANY_ACCESS_CONFIGURED=YES');
  } else if (mode === 'auth-status') {
    const emails=[process.env.OWNER_EMAIL,process.env.ADMIN_EMAIL]; const result=await client.query('select email,email_confirmed_at is not null as confirmed from auth.users where email=any($1::text[])',[emails]);
    for(const email of emails){const user=result.rows.find(row=>row.email.toLowerCase()===email.toLowerCase());console.log(`${email===emails[0]?'OWNER':'ADMIN'}_AUTH=${user?(user.confirmed?'CONFIRMED':'CONFIRMATION_PENDING'):'MISSING'}`);}
  } else if (mode === 'rls') {
    const result = await client.query("select count(*)::int total, count(*) filter(where c.relrowsecurity)::int protected from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname <> 'schema_migrations'");
    const deletion = await client.query("select count(*)::int as count from pg_policies where schemaname='public' and tablename='deletion_logs' and roles @> array['authenticated']::name[] and cmd='SELECT'");
    console.log(`RLS_TABLES=${result.rows[0].protected}/${result.rows[0].total}`);
    console.log(`DELETION_LOG_OWNER_POLICY=${deletion.rows[0].count > 0 ? 'YES' : 'NO'}`);
    const roles=await client.query("select role,count(*)::int as count from public.profiles group by role order by role");
    console.log(`PROFILE_ROLES=${roles.rows.map(row=>`${row.role}:${row.count}`).join(',')}`);
  } else if (mode === 'rls-runtime') {
    const users=await client.query("select p.id,p.role from public.profiles p where p.role in ('owner','admin')");
    const admin=users.rows.find(row=>row.role==='admin');
    let anonymousBlocked=false;
    try { await client.query('begin'); await client.query('set local role anon'); await client.query('select * from public.companies limit 1'); await client.query('rollback'); } catch { anonymousBlocked=true; await client.query('rollback'); }
    await client.query('begin'); await client.query("select set_config('request.jwt.claim.sub',$1,true)",[admin.id]); await client.query('set local role authenticated');
    const adminRole=await client.query('select public.current_access_role() as role,public.can_delete() as can_delete');
    const adminLogs=await client.query('select count(*)::int as count from public.deletion_logs'); await client.query('rollback');
    const operatorDeletePolicy=await client.query("select count(*)::int as count from pg_policies where schemaname='public' and cmd='DELETE' and qual like '%can_delete%'");
    console.log(`ANONYMOUS_BLOCKED=${anonymousBlocked?'YES':'NO'}`);
    console.log(`ADMIN_ROLE=${adminRole.rows[0].role}`); console.log(`ADMIN_CAN_DELETE=${adminRole.rows[0].can_delete?'YES':'NO'}`); console.log(`ADMIN_VISIBLE_DELETION_LOGS=${adminLogs.rows[0].count}`); console.log(`DELETE_POLICIES_ROLE_GUARDED=${operatorDeletePolicy.rows[0].count>0?'YES':'NO'}`);
  } else throw new Error('Modo inválido.');
} finally { await client.end().catch(() => undefined); }
