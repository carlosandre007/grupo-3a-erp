import { DataRepository, EntityRecord } from '../repositories';

type ChargeRecord = EntityRecord & { due_date: string; status: string; value: number; company_id: string; client_id: string; category_id: string; series_id?: string; frequency?: string; custom_interval_days?: number; asset_id?: string; description?: string; bank_account_id?: string };

const nextDueDate = (source: string, frequency?: string, interval = 1): string | null => {
  if (!frequency || frequency === 'unica') return null;
  const [year, month, day] = source.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (frequency === 'semanal' || frequency === 'personalizada') date.setDate(date.getDate() + (frequency === 'semanal' ? 7 : Math.max(1, interval)));
  else if (frequency === 'anual') date.setFullYear(year + 1);
  else { date.setDate(1); date.setMonth(month); date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())); }
  return date.toISOString().slice(0, 10);
};

export async function markChargeAsPaidAtomic(repository: DataRepository, chargeId: string, bankAccountId: string, paidAt = new Date().toISOString()) {
  if (repository.kind === 'supabase') {
    throw new Error('Modo somente leitura: baixa de cobrança remota desativada.');
  }
  return repository.runAtomically(['charges', 'transactions'], async () => {
    const charge = await repository.find<ChargeRecord>('charges', chargeId);
    if (!charge) throw new Error('Cobrança não encontrada.');
    const transactions = await repository.list<EntityRecord & { charge_id?: string }>('transactions');
    const existing = transactions.find(item => item.charge_id === chargeId);
    if (charge.status === 'pago' || existing) return { charge, transaction: existing, duplicate: true };
    const transaction = { id: crypto.randomUUID(), charge_id: charge.id, series_id: charge.series_id, type: 'receita', status: 'pago', paid_at: paidAt, date: paidAt.slice(0, 10), competency_date: charge.due_date, company_id: charge.company_id, client_id: charge.client_id, category_id: charge.category_id, asset_id: charge.asset_id, bank_account_id: bankAccountId, description: charge.description, value: Math.abs(charge.value) };
    await repository.update('charges', { ...charge, status: 'pago', paid_at: paidAt, transaction_id: transaction.id });
    await repository.create('transactions', transaction);
    const due = nextDueDate(charge.due_date, charge.frequency, charge.custom_interval_days);
    let nextCharge = null;
    if (due && !((await repository.list<ChargeRecord>('charges')).some(item => item.series_id === charge.series_id && item.due_date === due))) {
      nextCharge = { ...charge, id: crypto.randomUUID(), due_date: due, status: 'pendente', paid_at: null, transaction_id: null };
      await repository.create('charges', nextCharge);
    }
    // Bank balances are derived from paid transactions linked to bank_account_id.
    return { charge: { ...charge, status: 'pago' }, transaction, nextCharge, duplicate: false };
  });
}

export async function endRecurringSeriesAtomic(repository: DataRepository, seriesId: string, reason: string) {
  if (repository.kind === 'supabase') {
    throw new Error('Modo somente leitura: alteração de recorrência remota desativada.');
  }
  return repository.runAtomically(['recurring_series', 'charges', 'deletion_logs'], async () => {
    const series = await repository.find('recurring_series', seriesId);
    if (!series) throw new Error('Série recorrente não encontrada.');
    await repository.update('recurring_series', { ...series, active: false, ended_at: new Date().toISOString() });
    for (const charge of await repository.list<EntityRecord & { series_id?: string; status?: string; due_date?: string }>('charges')) {
      if (charge.series_id === seriesId && charge.status !== 'pago') await repository.remove('charges', charge.id);
    }
    await repository.create('deletion_logs', { id: crypto.randomUUID(), record_type: 'recurring_series', record_id: seriesId, reason, occurred_at: new Date().toISOString() });
    return { seriesId, ended: true };
  });
}

export async function deleteWithAuditAtomic(repository: DataRepository, module: 'transactions' | 'charges' | 'investments', id: string, reason: string) {
  return repository.runAtomically([module, 'deletion_logs'], async () => {
    const record = await repository.find(module, id); if (!record) throw new Error('Registro não encontrado.');
    await repository.remove(module, id);
    await repository.create('deletion_logs', { id: crypto.randomUUID(), record_type: module, record_id: id, reason, snapshot: record, occurred_at: new Date().toISOString() });
  });
}
