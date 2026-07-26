create table if not exists public.rental_guarantees (
  id uuid primary key, charge_id uuid not null unique references public.charges(id), company_id uuid not null references public.companies(id),
  client_id uuid not null references public.clients(id), asset_id uuid not null references public.assets(id), guarantee_type text not null,
  value numeric(14,2) not null default 0 check(value >= 0), received_at date, bank_account_id uuid references public.bank_accounts(id),
  status text not null, notes text, proof_name text, valid_until date, balance numeric(14,2) not null default 0 check(balance >= 0),
  received_movement_id uuid references public.bank_movements(id), refund_movement_id uuid references public.bank_movements(id), receipt_id text,
  history jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.rental_guarantees enable row level security;
create policy rental_guarantees_select on public.rental_guarantees for select to authenticated using (public.can_access_company(company_id));
create policy rental_guarantees_insert on public.rental_guarantees for insert to authenticated with check (public.can_access_company(company_id) and public.current_access_role() in ('owner','admin','operator'));
create policy rental_guarantees_update on public.rental_guarantees for update to authenticated using (public.can_access_company(company_id)) with check (public.can_access_company(company_id) and public.current_access_role() in ('owner','admin','operator'));
create policy rental_guarantees_delete on public.rental_guarantees for delete to authenticated using (public.can_access_company(company_id) and public.can_delete());
