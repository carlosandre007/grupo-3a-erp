-- PLANO SQL NÃO EXECUTADO.
begin;
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  priority text not null default 'media' check (priority in ('baixa','media','alta')),
  due_date date,
  status text not null default 'ativo',
  company_id uuid references public.companies(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
alter table public.alerts enable row level security;
create policy alerts_authenticated_select on public.alerts for select to authenticated using (true);
create policy alerts_owner_admin_insert on public.alerts for insert to authenticated
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') in ('owner','admin'));
notify pgrst, 'reload schema';
commit;
