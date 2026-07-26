alter table public.transactions
  add column if not exists legacy_bank_account_id text;

comment on column public.transactions.legacy_bank_account_id is
  'Referência da conta bancária no sistema legado, preservada quando não existe conta correspondente no ERP novo.';
