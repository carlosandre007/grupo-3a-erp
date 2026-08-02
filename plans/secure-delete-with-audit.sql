-- PLANO SQL NÃO EXECUTADO.
-- Aplicar somente após autorização explícita do proprietário.
-- Compatível com a tabela existente:
-- deletion_logs(id, table_name, record_id, record_description, deleted_by, deleted_at)

begin;

create or replace function public.secure_delete_with_audit(
  p_table_name text,
  p_record_id uuid,
  p_reason text,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
  v_log_id uuid := gen_random_uuid();
  v_actor uuid := auth.uid();
  v_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
begin
  if v_role = '' and to_regclass('public.profiles') is not null then
    execute 'select coalesce(role, '''') from public.profiles where id = $1 and active is true'
      into v_role
      using v_actor;
  end if;

  if v_actor is null or v_role <> 'owner' then
    raise exception 'Acesso restrito ao proprietário';
  end if;

  if p_table_name not in (
    'banks', 'clients', 'properties', 'motorcycles',
    'charges', 'transactions', 'fixed_costs'
  ) then
    raise exception 'Tabela não permitida';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Motivo obrigatório';
  end if;

  execute format(
    'select to_jsonb(t) from public.%I t where id = $1 for update',
    p_table_name
  )
  into v_snapshot
  using p_record_id;

  if v_snapshot is null then
    raise exception 'Registro não encontrado';
  end if;

  insert into public.deletion_logs (
    id, table_name, record_id, record_description, deleted_by, deleted_at
  )
  values (
    v_log_id,
    p_table_name,
    p_record_id,
    jsonb_build_object(
      'reason', btrim(p_reason),
      'snapshot', v_snapshot,
      'ip', nullif(btrim(p_ip), '')
    )::text,
    v_actor,
    now()
  );

  execute format('delete from public.%I where id = $1', p_table_name)
  using p_record_id;

  return jsonb_build_object('deleted', true, 'log_id', v_log_id);
end;
$$;

revoke all on function public.secure_delete_with_audit(text, uuid, text, text) from public;
grant execute on function public.secure_delete_with_audit(text, uuid, text, text) to authenticated;

-- O aplicativo não recebe permissão para alterar ou apagar logs.
revoke update, delete, truncate on table public.deletion_logs from anon, authenticated;

-- Registros protegidos só podem ser excluídos pela RPC SECURITY DEFINER acima.
revoke delete on table
  public.banks,
  public.clients,
  public.properties,
  public.motorcycles,
  public.charges,
  public.transactions,
  public.fixed_costs
from anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- ROLLBACK MANUAL:
-- begin;
-- drop function if exists public.secure_delete_with_audit(text, uuid, text, text);
-- commit;
