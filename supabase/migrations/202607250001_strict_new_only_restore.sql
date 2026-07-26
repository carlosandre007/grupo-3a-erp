-- Plano de migração real: não aplicado automaticamente.
-- Preserva UUIDs, nunca substitui registros e mantém cada lote em subtransação atômica.
create or replace function public.restore_backup_new_only(
  p_operation_id uuid,
  p_file_hash text,
  p_expected_inserts integer,
  p_records jsonb,
  p_controlled_test boolean default false
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_module text;
  v_record jsonb;
  v_inserted integer:=0;
  v_count integer;
  v_columns text;
  v_modules constant text[]:=array[
    'companies','categories','clients','assets','properties','vehicles',
    'bank_accounts','bank_movements','recurring_series','fixed_costs',
    'charges','transactions','investments','alerts','receipts','company_metrics'
  ];
begin
  if auth.uid() is null or public.current_access_role()<>'owner' then
    raise exception 'A restauração exige sessão owner ativa.' using errcode='42501';
  end if;
  if p_operation_id is null or coalesce(p_file_hash,'')='' or p_expected_inserts<1 or jsonb_typeof(p_records)<>'object' then
    raise exception 'Plano de restauração inválido.';
  end if;
  insert into public.restore_operations(id,file_hash,status,expected_inserts,created_by)
  values(p_operation_id,p_file_hash,'running',p_expected_inserts,auth.uid());
  begin
    foreach v_module in array v_modules loop
      for v_record in select value from jsonb_array_elements(coalesce(p_records->v_module,'[]'::jsonb)) loop
        if not(v_record?'id') then raise exception 'Registro sem UUID em %.',v_module; end if;
        select string_agg(format('%I',column_name),',' order by ordinal_position)
          into v_columns
          from information_schema.columns
         where table_schema='public'
           and table_name=v_module
           and column_name in(select jsonb_object_keys(v_record));
        if v_columns is null then raise exception 'Registro sem colunas compatíveis em %.',v_module; end if;
        execute format(
          'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) as row_data on conflict (id) do nothing',
          v_module,v_columns,v_columns,v_module
        ) using v_record;
        get diagnostics v_count=row_count;
        if v_count<>1 then raise exception 'Conflito new_only em % para UUID %.',v_module,v_record->>'id'; end if;
        v_inserted:=v_inserted+1;
      end loop;
    end loop;
    if v_inserted<>p_expected_inserts then
      raise exception 'Total inserido (%) diverge do plano (%).',v_inserted,p_expected_inserts;
    end if;
    if p_controlled_test then raise exception 'CONTROLLED_ROLLBACK'; end if;
  exception when others then
    update public.restore_operations
       set status=case when sqlerrm='CONTROLLED_ROLLBACK' then 'rolled_back' else 'failed' end,
           error_message=sqlerrm,inserted_count=0,finished_at=now()
     where id=p_operation_id;
    if sqlerrm='CONTROLLED_ROLLBACK' then
      return jsonb_build_object('operation_id',p_operation_id,'status','rolled_back','inserted',0);
    end if;
    return jsonb_build_object('operation_id',p_operation_id,'status','failed','inserted',0,'error',sqlerrm);
  end;
  update public.restore_operations set status='completed',inserted_count=v_inserted,finished_at=now() where id=p_operation_id;
  return jsonb_build_object('operation_id',p_operation_id,'status','completed','inserted',v_inserted);
end $$;
revoke all on function public.restore_backup_new_only(uuid,text,integer,jsonb,boolean) from public,anon;
grant execute on function public.restore_backup_new_only(uuid,text,integer,jsonb,boolean) to authenticated;
