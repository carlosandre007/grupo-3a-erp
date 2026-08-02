import React, { useEffect, useMemo, useState } from 'react';
import { repository, type EntityRecord } from '../repositories';
import ProtectedPayButton from '../components/ProtectedPayButton';
import ProtectedRecordActions from '../components/ProtectedRecordActions';
import FixedCostDetails from '../components/FixedCostDetails';
import { fortalezaToday } from '../services/currentMonthCosts';

type CostRow = EntityRecord & {
  name?: string;
  description?: string;
  invoice?: string;
  price?: number;
  qty?: number;
  total?: number;
  value?: number;
  next_due_date?: string;
  due_date?: string;
  status?: string;
  paid_at?: string;
  active?: boolean;
  frequency?: string;
  is_recurrent?: boolean;
  month?: number;
  year?: number;
  company_id?: string;
  company?: string;
  category_id?: string;
  category?: string;
  recurrence_group_id?: string;
};
type TransactionRow = EntityRecord & {
  transaction_date?: string;
  date?: string;
  description?: string;
  value?: number;
  reference_id?: string;
  referencia_id?: string;
  status?: string;
};
type NamedRow = EntityRecord & { name?: string };
type CostGroup = { key: string; title: string; color: string; headerColor: string; costs: CostRow[] };

const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const paid = (status: unknown) =>
  ['paid', 'pago', 'confirmed'].includes(String(status ?? '').toLowerCase());
const costValue = (cost: CostRow) => Number(cost.total ?? cost.value ?? cost.price ?? 0);
const dueDay = (cost: CostRow) => {
  const match = String(cost.due_date || cost.next_due_date || '').match(/-(\d{2})(?:T|$)/);
  return match ? Number(match[1]) : 0;
};
const datePt = (value?: string) => {
  if (!value) return 'Não informado';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const costMonthKey = (cost: CostRow) => {
  if (Number(cost.year) && Number(cost.month)) {
    return `${Number(cost.year)}-${String(Number(cost.month)).padStart(2, '0')}`;
  }
  return String(cost.due_date || cost.next_due_date || '').slice(0, 7);
};
const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
};
const isRecurring = (cost: CostRow) => {
  const frequency = String(cost.frequency || '').toLowerCase();
  return cost.is_recurrent !== false
    && !['unica', 'única', 'once', 'one_time'].includes(frequency);
};
const recurrenceKey = (cost: CostRow) => String(cost.recurrence_group_id || [
  String(cost.description || cost.name || '').trim().toLowerCase(),
  cost.company_id || cost.company || '',
  cost.category_id || cost.category || '',
  dueDay(cost),
].join('|'));
const projectCostsForMonth = (costs: CostRow[], monthKey: string) => {
  const exact = costs.filter(cost => costMonthKey(cost) === monthKey);
  const exactKeys = new Set(exact.map(recurrenceKey));
  const candidates = costs
    .filter(cost => isRecurring(cost) && cost.active !== false)
    .filter(cost => {
      const sourceMonth = costMonthKey(cost);
      return !sourceMonth || sourceMonth <= monthKey;
    })
    .sort((left, right) => costMonthKey(right).localeCompare(costMonthKey(left)));
  const projected = new Map<string, CostRow>();
  for (const cost of candidates) {
    const key = recurrenceKey(cost);
    if (exactKeys.has(key) || projected.has(key)) continue;
    const [year, month] = monthKey.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(Math.max(dueDay(cost), 1), lastDay);
    projected.set(key, {
      ...cost,
      due_date: `${monthKey}-${String(day).padStart(2, '0')}`,
      next_due_date: `${monthKey}-${String(day).padStart(2, '0')}`,
      month,
      year,
    });
  }
  return [...exact, ...projected.values()];
};
const monthRange = (first: string, last: string) => {
  if (!/^\d{4}-\d{2}$/.test(first) || !/^\d{4}-\d{2}$/.test(last)) return [last];
  const result: string[] = [];
  const cursor = new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, 1);
  const end = new Date(Number(last.slice(0, 4)), Number(last.slice(5, 7)) - 1, 1);
  while (cursor <= end) {
    result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
};

const groupCosts = (costs: CostRow[]): CostGroup[] => {
  const definitions = [
    { key: '09-15', title: 'Vencimentos — dias 9–15', color: 'border-sky-200 bg-sky-50/70', headerColor: 'text-sky-800', accepts: (day: number) => day >= 9 && day <= 15 },
    { key: '16-18', title: 'Vencimentos — dias 16–18', color: 'border-violet-200 bg-violet-50/70', headerColor: 'text-violet-800', accepts: (day: number) => day >= 16 && day <= 18 },
    { key: '19-23', title: 'Vencimentos — dias 19–23', color: 'border-amber-200 bg-amber-50/70', headerColor: 'text-amber-800', accepts: (day: number) => day >= 19 && day <= 23 },
    { key: '24-31', title: 'Vencimentos — dias 24–31', color: 'border-rose-200 bg-rose-50/70', headerColor: 'text-rose-800', accepts: (day: number) => day >= 24 && day <= 31 },
    { key: 'outside', title: 'Fora das faixas 9–31', color: 'border-slate-200 bg-slate-50/70', headerColor: 'text-slate-700', accepts: (day: number) => day < 9 || day > 31 },
  ];
  return definitions.map(definition => ({
    key: definition.key,
    title: definition.title,
    color: definition.color,
    headerColor: definition.headerColor,
    costs: costs
      .filter(cost => definition.accepts(dueDay(cost)))
      .sort((left, right) =>
        String(left.due_date || left.next_due_date || '').localeCompare(
          String(right.due_date || right.next_due_date || ''),
        )),
  })).filter(group => group.costs.length > 0);
};

export default function CustoFixo() {
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [companies, setCompanies] = useState<NamedRow[]>([]);
  const [categories, setCategories] = useState<NamedRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<CostRow | null>(null);
  const currentMonth = fortalezaToday().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      repository.list<CostRow>('fixed_costs'),
      repository.list<NamedRow>('companies'),
      repository.list<NamedRow>('categories'),
      repository.list<TransactionRow>('transactions'),
    ]).then(([costRows, companyRows, categoryRows, transactionRows]) => {
      if (!active) return;
      setCosts(costRows);
      setCompanies(companyRows);
      setCategories(categoryRows);
      setTransactions(transactionRows);
      setError('');
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os custos fixos.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [version]);

  const companyNames = useMemo(
    () => new Map(companies.map(item => [item.id, item.name || ''])),
    [companies],
  );
  const categoryNames = useMemo(
    () => new Map(categories.map(item => [item.id, item.name || ''])),
    [categories],
  );
  const availableMonths = useMemo(() => {
    const recorded = costs.map(costMonthKey).filter(key => /^\d{4}-\d{2}$/.test(key) && key <= currentMonth);
    const first = recorded.sort()[0] || currentMonth;
    return monthRange(first, currentMonth).sort((left, right) => right.localeCompare(left));
  }, [costs, currentMonth]);
  const selectedCosts = useMemo(
    () => projectCostsForMonth(costs, selectedMonth),
    [costs, selectedMonth],
  );
  const groups = useMemo(() => groupCosts(selectedCosts), [selectedCosts]);
  const related = selected
    ? transactions.filter(transaction =>
      transaction.reference_id === selected.id || transaction.referencia_id === selected.id)
    : [];
  const paidThisMonth = (id: string) => transactions.some(transaction =>
    (transaction.reference_id === id || transaction.referencia_id === id)
    && String(transaction.transaction_date || transaction.date || '').startsWith(selectedMonth)
    && paid(transaction.status));
  const isPaidInSelectedMonth = (cost: CostRow) => paidThisMonth(cost.id)
    || (paid(cost.status) && String(cost.paid_at || '').startsWith(selectedMonth));
  const summary = useMemo(() => {
    const paidCosts = selectedCosts.filter(isPaidInSelectedMonth);
    const pendingCosts = selectedCosts.filter(cost => !isPaidInSelectedMonth(cost));
    const paidValue = paidCosts.reduce((sum, cost) => sum + costValue(cost), 0);
    const pendingValue = pendingCosts.reduce((sum, cost) => sum + costValue(cost), 0);
    const today = fortalezaToday();
    const nextPending = pendingCosts.map(cost => String(cost.due_date || cost.next_due_date || ''))
      .filter(date => selectedMonth !== currentMonth || date >= today).sort()[0];
    return { total: paidValue + pendingValue, paid: paidValue, pending: pendingValue, nextPending };
  }, [selectedCosts, transactions, selectedMonth, currentMonth]);
  const changed = () => setVersion(value => value + 1);
  const companyOf = (cost: CostRow) =>
    companyNames.get(String(cost.company_id || '')) || cost.company || 'Empresa não informada';
  const categoryOf = (cost: CostRow) =>
    categoryNames.get(String(cost.category_id || '')) || cost.category || 'Categoria não informada';

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-display text-lg font-black">Custos Fixos</h2>
        <p className="text-xs text-secondary">{selectedCosts.length} custos em {monthLabel(selectedMonth)}.</p></div>
        <label className="text-xs font-bold">Mês de referência<select value={selectedMonth} onChange={event=>setSelectedMonth(event.target.value)} className="mt-1 block min-w-48 rounded border bg-white p-2 font-normal capitalize">{availableMonths.map(month=><option key={month} value={month}>{monthLabel(month)}</option>)}</select></label>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border bg-white p-3"><small>Total cadastrado</small><b className="block">{brl(summary.total)}</b></article>
        <article className="rounded-lg border bg-white p-3"><small>Pago</small><b className="block">{brl(summary.paid)}</b></article>
        <article className="rounded-lg border bg-white p-3"><small>Pendente</small><b className="block">{brl(summary.pending)}</b></article>
        <article className="rounded-lg border bg-white p-3"><small>Próximo vencimento</small><b className="block">{summary.nextPending ? datePt(summary.nextPending) : 'Nenhum pendente'}</b></article>
      </section>

      {loading && <p className="rounded-xl border bg-white p-3 text-xs">Carregando custos...</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      {!loading && !error && selectedCosts.length === 0 && <p className="rounded-xl border bg-white p-3 text-xs text-secondary">Nenhum registro em {monthLabel(selectedMonth)}.</p>}

      {groups.map(group => (
        <section key={group.key} className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <h3 className={`text-xs font-black uppercase ${group.headerColor}`}>{group.title}</h3>
            <span className={`text-[10px] ${group.headerColor}`}>{group.costs.length} registros</span>
          </div>
          {group.costs.map(cost => {
            const isPaid = isPaidInSelectedMonth(cost);
            return (
              <article key={cost.id} className={`rounded-lg border px-2.5 py-2 ${group.color}`}>
                <div className="grid items-center gap-x-3 gap-y-1 md:grid-cols-[minmax(150px,1.4fr)_minmax(110px,1fr)_minmax(110px,1fr)_90px_110px_78px_auto]">
                  <p className="truncate text-xs font-bold" title={cost.description || cost.name}>
                    {cost.description || cost.name || 'Custo sem descrição'}
                  </p>
                  <p className="truncate text-[11px]" title={companyOf(cost)}>{companyOf(cost)}</p>
                  <p className="truncate text-[11px]" title={categoryOf(cost)}>{categoryOf(cost)}</p>
                  <p className="whitespace-nowrap text-[11px]">{datePt(cost.due_date || cost.next_due_date)}</p>
                  <p className="whitespace-nowrap text-right text-xs font-black">{brl(costValue(cost))}</p>
                  <p className={`text-[10px] font-black uppercase ${isPaid ? 'text-green-700' : 'text-amber-700'}`}>
                    {isPaid ? 'Pago' : 'Pendente'}
                  </p>
                  <div className="flex flex-wrap justify-end gap-1">
                    {selectedMonth === currentMonth && <ProtectedPayButton id={cost.id} paid={isPaid} onChanged={changed} />}
                    <ProtectedRecordActions
                      table="fixed_costs"
                      record={cost}
                      onView={() => setSelected(cost)}
                      onChanged={changed}
                      fields={[
                        { key: 'name', label: 'Descrição' },
                        { key: 'invoice', label: 'Documento/Fatura' },
                        { key: 'price', label: 'Preço', type: 'number' },
                        { key: 'qty', label: 'Quantidade', type: 'number' },
                        { key: 'total', label: 'Total', type: 'number' },
                        { key: 'due_date', label: 'Vencimento', type: 'date' },
                        { key: 'status', label: 'Status' },
                        { key: 'category', label: 'Categoria' },
                      ]}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ))}

      <FixedCostDetails
        cost={selected}
        payments={related}
        company={selected ? companyOf(selected) : ''}
        category={selected ? categoryOf(selected) : ''}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
