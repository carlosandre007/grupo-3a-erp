begin;

create extension if not exists pgcrypto;
create type public.access_role as enum ('owner', 'admin', 'operator');
create type public.entry_type as enum ('receita', 'despesa');
create type public.entry_status as enum ('pago', 'pendente', 'atrasado');
create type public.charge_status as enum ('pago', 'pendente', 'vencido', 'cancelado');
create type public.frequency_type as enum ('unica', 'semanal', 'mensal', 'anual', 'personalizada');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.access_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.companies (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  kind text not null check (kind in ('loc_mottus','rastrear','imoveis','holding')),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profile_companies (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  primary key (profile_id, company_id)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  name text not null, type public.entry_type, active boolean not null default true,
  created_at timestamptz not null default now(), unique(company_id, name)
);
create table public.clients (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  name text not null, person_type text check (person_type in ('PF','PJ')), phone text, email text, document text,
  address text, cnh_number text, cnh_expiry date, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.assets (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  code text, asset_type text not null check (asset_type in ('moto','carro','kitnet','loja','casa','outro')),
  name text not null, status text not null, acquisition_date date, purchase_value numeric(14,2), current_value numeric(14,2),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id, code)
);
create table public.properties (
  id uuid primary key references public.assets(id) on delete cascade, address text not null, area numeric(12,2),
  bedrooms integer, bathrooms integer, rent_value numeric(14,2), tenant_client_id uuid references public.clients(id),
  rent_date date, annual_adjustment_date date, contract_end_date date
);
create table public.vehicles (
  id uuid primary key references public.assets(id) on delete cascade, plate text not null unique, model text not null,
  rental_value numeric(14,2), tenant_client_id uuid references public.clients(id), ipva_due_date date,
  licensing_due_date date, next_maintenance date
);
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  bank_name text not null, account_name text not null, account_type text not null,
  initial_balance numeric(14,2) not null default 0, initial_balance_date date not null,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.bank_movements (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  account_id uuid not null references public.bank_accounts(id), movement_type text not null,
  value numeric(14,2) not null, movement_date date not null, description text not null, reason text,
  transfer_id uuid, created_at timestamptz not null default now()
);
create table public.recurring_series (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  frequency public.frequency_type not null, custom_interval_days integer, active boolean not null default true,
  ended_at timestamptz, created_at timestamptz not null default now()
);
create table public.charges (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  category_id uuid not null references public.categories(id), client_id uuid not null references public.clients(id),
  asset_id uuid not null references public.assets(id), series_id uuid references public.recurring_series(id),
  due_date date not null, competency_date date, description text not null, value numeric(14,2) not null check(value >= 0),
  status public.charge_status not null default 'pendente', paid_at timestamptz, payment_method text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(series_id, due_date)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  category_id uuid not null references public.categories(id), client_id uuid references public.clients(id),
  asset_id uuid references public.assets(id), bank_account_id uuid references public.bank_accounts(id),
  charge_id uuid references public.charges(id), series_id uuid references public.recurring_series(id),
  type public.entry_type not null, status public.entry_status not null, description text not null,
  value numeric(14,2) not null check(value >= 0), transaction_date date not null, competency_date date,
  paid_at timestamptz, investment_kind text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(charge_id)
);
alter table public.charges add column transaction_id uuid unique references public.transactions(id);
create table public.fixed_costs (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  category_id uuid not null references public.categories(id), bank_account_id uuid references public.bank_accounts(id),
  description text not null, value numeric(14,2) not null check(value >= 0), due_day integer not null check(due_day between 1 and 31),
  frequency public.frequency_type not null, custom_interval_days integer, start_date date not null, end_date date,
  next_due_date date not null, active boolean not null default true, notes text, current_transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.investments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  category_id uuid not null references public.categories(id), asset_id uuid references public.assets(id),
  description text not null, value numeric(14,2) not null check(value >= 0), investment_date date not null,
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index investments_one_manual_per_asset on public.investments(asset_id) where asset_id is not null;
create table public.alerts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  alert_type text not null, source_table text not null, source_id uuid not null, priority text not null,
  due_date date, status text not null default 'ativo', resolved_at timestamptz, created_at timestamptz not null default now(),
  unique(alert_type, source_table, source_id)
);
create table public.deletion_logs (
  id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id),
  actor_id uuid references auth.users(id), record_type text not null, record_id uuid not null,
  reason text, snapshot jsonb not null, occurred_at timestamptz not null default now()
);
create table public.receipts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  charge_id uuid not null unique references public.charges(id), transaction_id uuid not null unique references public.transactions(id),
  receipt_number text not null unique, generated_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create table public.company_metrics (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  metric_key text not null, total numeric(14,2) not null default 0, available numeric(14,2) not null default 0,
  installed numeric(14,2) not null default 0, maintenance numeric(14,2) not null default 0,
  measured_at timestamptz not null default now(), unique(company_id, metric_key)
);

create or replace function public.current_access_role() returns public.access_role language sql stable security definer set search_path = public as $$ select role from public.profiles where id = auth.uid() and active $$;
create or replace function public.can_access_company(target uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and (p.role='owner' or exists(select 1 from public.profile_companies pc where pc.profile_id=p.id and pc.company_id=target)))
$$;
create or replace function public.can_delete() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(public.current_access_role() in ('owner','admin'), false) $$;

alter table public.profiles enable row level security; alter table public.profile_companies enable row level security;
alter table public.companies enable row level security; alter table public.categories enable row level security;
alter table public.clients enable row level security; alter table public.assets enable row level security;
alter table public.properties enable row level security; alter table public.vehicles enable row level security;
alter table public.bank_accounts enable row level security; alter table public.bank_movements enable row level security;
alter table public.transactions enable row level security; alter table public.charges enable row level security;
alter table public.recurring_series enable row level security; alter table public.fixed_costs enable row level security;
alter table public.investments enable row level security; alter table public.alerts enable row level security;
alter table public.deletion_logs enable row level security; alter table public.receipts enable row level security;
alter table public.company_metrics enable row level security;

create policy profiles_self_or_owner_select on public.profiles for select to authenticated using (id=auth.uid() or public.current_access_role()='owner');
create policy profiles_owner_write on public.profiles for all to authenticated using (public.current_access_role()='owner') with check (public.current_access_role()='owner');
create policy profile_companies_visible on public.profile_companies for select to authenticated using (profile_id=auth.uid() or public.current_access_role()='owner');
create policy profile_companies_owner_write on public.profile_companies for all to authenticated using (public.current_access_role()='owner') with check (public.current_access_role()='owner');
create policy companies_select on public.companies for select to authenticated using (public.can_access_company(id));
create policy companies_write on public.companies for all to authenticated using (public.can_access_company(id) and public.current_access_role() in ('owner','admin')) with check (public.current_access_role() in ('owner','admin'));

do $$ declare t text; begin
  foreach t in array array['categories','clients','assets','bank_accounts','bank_movements','transactions','charges','recurring_series','fixed_costs','investments','alerts','receipts','company_metrics'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.can_access_company(company_id))', t||'_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_access_company(company_id) and public.current_access_role() in (''owner'',''admin'',''operator''))', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_access_company(company_id)) with check (public.can_access_company(company_id) and public.current_access_role() in (''owner'',''admin'',''operator''))', t||'_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_access_company(company_id) and public.can_delete())', t||'_delete', t);
  end loop;
end $$;
create policy properties_select on public.properties for select to authenticated using (exists(select 1 from public.assets a where a.id=properties.id and public.can_access_company(a.company_id)));
create policy properties_insert on public.properties for insert to authenticated with check (exists(select 1 from public.assets a where a.id=properties.id and public.can_access_company(a.company_id)) and public.current_access_role() in ('owner','admin','operator'));
create policy properties_update on public.properties for update to authenticated using (exists(select 1 from public.assets a where a.id=properties.id and public.can_access_company(a.company_id))) with check (public.current_access_role() in ('owner','admin','operator'));
create policy properties_delete on public.properties for delete to authenticated using (public.can_delete() and exists(select 1 from public.assets a where a.id=properties.id and public.can_access_company(a.company_id)));
create policy vehicles_select on public.vehicles for select to authenticated using (exists(select 1 from public.assets a where a.id=vehicles.id and public.can_access_company(a.company_id)));
create policy vehicles_insert on public.vehicles for insert to authenticated with check (exists(select 1 from public.assets a where a.id=vehicles.id and public.can_access_company(a.company_id)) and public.current_access_role() in ('owner','admin','operator'));
create policy vehicles_update on public.vehicles for update to authenticated using (exists(select 1 from public.assets a where a.id=vehicles.id and public.can_access_company(a.company_id))) with check (public.current_access_role() in ('owner','admin','operator'));
create policy vehicles_delete on public.vehicles for delete to authenticated using (public.can_delete() and exists(select 1 from public.assets a where a.id=vehicles.id and public.can_access_company(a.company_id)));
create policy deletion_logs_owner_select on public.deletion_logs for select to authenticated using (public.current_access_role()='owner');

create or replace function public.audit_delete() returns trigger language plpgsql security definer set search_path=public as $$ begin
  insert into public.deletion_logs(company_id,actor_id,record_type,record_id,reason,snapshot) values ((to_jsonb(old)->>'company_id')::uuid,auth.uid(),tg_table_name,old.id,nullif(current_setting('app.deletion_reason',true),''),to_jsonb(old)); return old;
end $$;
do $$ declare t text; begin foreach t in array array['clients','assets','bank_accounts','bank_movements','transactions','charges','recurring_series','fixed_costs','investments','alerts','receipts','company_metrics'] loop execute format('create trigger audit_%I before delete on public.%I for each row execute function public.audit_delete()',t,t); end loop; end $$;

create or replace function public.mark_charge_as_paid(p_charge_id uuid, p_bank_account_id uuid, p_paid_at timestamptz default now()) returns jsonb language plpgsql security invoker set search_path=public as $$
declare c public.charges; tx_id uuid; next_due date; next_id uuid;
begin
  select * into c from public.charges where id=p_charge_id for update;
  if not found then raise exception 'Cobrança não encontrada'; end if;
  select id into tx_id from public.transactions where charge_id=p_charge_id;
  if c.status='pago' or tx_id is not null then return jsonb_build_object('charge_id',c.id,'transaction_id',tx_id,'duplicate',true); end if;
  tx_id:=gen_random_uuid();
  insert into public.transactions(id,company_id,category_id,client_id,asset_id,bank_account_id,charge_id,series_id,type,status,description,value,transaction_date,competency_date,paid_at)
  values(tx_id,c.company_id,c.category_id,c.client_id,c.asset_id,p_bank_account_id,c.id,c.series_id,'receita','pago',c.description,c.value,p_paid_at::date,coalesce(c.competency_date,c.due_date),p_paid_at);
  update public.charges set status='pago',paid_at=p_paid_at,transaction_id=tx_id,updated_at=now() where id=c.id;
  if c.series_id is not null then
    select case s.frequency when 'semanal' then c.due_date+7 when 'mensal' then least((date_trunc('month',c.due_date)+interval '2 months - 1 day')::date,(c.due_date+interval '1 month')::date) when 'anual' then (c.due_date+interval '1 year')::date when 'personalizada' then c.due_date+greatest(1,s.custom_interval_days) else null end into next_due from public.recurring_series s where s.id=c.series_id and s.active;
    if next_due is not null and not exists(select 1 from public.charges where series_id=c.series_id and due_date=next_due) then next_id:=gen_random_uuid(); insert into public.charges(id,company_id,category_id,client_id,asset_id,series_id,due_date,competency_date,description,value,status) values(next_id,c.company_id,c.category_id,c.client_id,c.asset_id,c.series_id,next_due,next_due,c.description,c.value,'pendente'); end if;
  end if;
  return jsonb_build_object('charge_id',c.id,'transaction_id',tx_id,'next_charge_id',next_id,'duplicate',false);
end $$;
create or replace function public.end_recurring_series(p_series_id uuid,p_reason text) returns jsonb language plpgsql security invoker set search_path=public as $$
begin perform set_config('app.deletion_reason',p_reason,true); update public.recurring_series set active=false,ended_at=now() where id=p_series_id; delete from public.charges where series_id=p_series_id and status in ('pendente','vencido') and due_date>current_date; return jsonb_build_object('series_id',p_series_id,'ended',true); end $$;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant execute on function public.mark_charge_as_paid(uuid,uuid,timestamptz), public.end_recurring_series(uuid,text) to authenticated;

commit;
