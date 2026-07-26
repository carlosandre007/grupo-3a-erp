create or replace function public.protect_core_companies() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.kind in ('loc_mottus','rastrear','imoveis','holding') or old.name in ('LOC MOTTUS','3A RASTREAR','IMÓVEIS','HOLDING GRUPO 3A') then
    if tg_op='DELETE' then raise exception 'Empresa principal permanente não pode ser excluída.' using errcode='42501'; end if;
    if new.id<>old.id or new.name<>old.name or new.kind<>old.kind or new.active=false then raise exception 'ID, nome, tipo e status ativo da empresa principal são imutáveis.' using errcode='42501'; end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists protect_core_companies_trigger on public.companies;
create trigger protect_core_companies_trigger before update or delete on public.companies for each row execute function public.protect_core_companies();

create or replace function public.protect_core_company_categories() returns trigger language plpgsql security definer set search_path=public as $$
declare v_company_id uuid:=case when tg_op='DELETE' then old.company_id else old.company_id end;
begin
  if exists(select 1 from public.companies where id=v_company_id and (kind in ('loc_mottus','rastrear','imoveis','holding') or name in ('LOC MOTTUS','3A RASTREAR','IMÓVEIS','HOLDING GRUPO 3A'))) then
    if tg_op='DELETE' or new.company_id<>old.company_id then raise exception 'Categorias das empresas principais devem ser preservadas.' using errcode='42501'; end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists protect_core_company_categories_trigger on public.categories;
create trigger protect_core_company_categories_trigger before update or delete on public.categories for each row execute function public.protect_core_company_categories();
