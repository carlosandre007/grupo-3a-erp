begin;

create table if not exists public.app_settings (
  setting_key text primary key,
  numeric_value numeric(18,2),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint app_settings_numeric_value_nonnegative
    check (numeric_value is null or numeric_value >= 0)
);

create table if not exists public.app_setting_history (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  previous_numeric_value numeric(18,2),
  new_numeric_value numeric(18,2) not null,
  changed_at timestamptz not null default now(),
  changed_by uuid not null references auth.users(id),
  constraint app_setting_history_new_value_nonnegative check (new_numeric_value >= 0)
);

alter table public.app_settings enable row level security;
alter table public.app_setting_history enable row level security;

drop policy if exists app_settings_authenticated_select on public.app_settings;
create policy app_settings_authenticated_select
  on public.app_settings for select to authenticated
  using (auth.uid() is not null);

drop policy if exists app_setting_history_owner_select on public.app_setting_history;
create policy app_setting_history_owner_select
  on public.app_setting_history for select to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('owner', 'admin')
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'active', 'true') = 'true'
  );

create or replace function public.set_manual_invested_current(p_value numeric)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_previous numeric(18,2);
begin
  if auth.uid() is null
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('owner', 'admin')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'active', 'true') <> 'true' then
    raise exception 'Usuario sem autorizacao' using errcode = '42501';
  end if;

  if p_value is null or p_value < 0 then
    raise exception 'Valor invalido' using errcode = '22003';
  end if;

  select numeric_value
    into v_previous
    from public.app_settings
   where setting_key = 'invested_current'
   for update;

  insert into public.app_setting_history (
    setting_key,
    previous_numeric_value,
    new_numeric_value,
    changed_by
  ) values (
    'invested_current',
    v_previous,
    p_value,
    auth.uid()
  );

  insert into public.app_settings (
    setting_key,
    numeric_value,
    updated_at,
    updated_by
  ) values (
    'invested_current',
    p_value,
    now(),
    auth.uid()
  )
  on conflict (setting_key) do update set
    numeric_value = excluded.numeric_value,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
end;
$$;

revoke all on public.app_settings from anon, authenticated;
revoke all on public.app_setting_history from anon, authenticated;
grant select on public.app_settings to authenticated;
grant select on public.app_setting_history to authenticated;

revoke all on function public.set_manual_invested_current(numeric) from public;
grant execute on function public.set_manual_invested_current(numeric) to authenticated;

notify pgrst, 'reload schema';
commit;
