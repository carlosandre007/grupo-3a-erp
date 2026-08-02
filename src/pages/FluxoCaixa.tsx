import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { repository, type EntityRecord } from '../repositories';
import ProtectedRecordActions from '../components/ProtectedRecordActions';
import FinancialRecordDetails from '../components/FinancialRecordDetails';

type TransactionRow = EntityRecord & {
  transaction_date?: string;
  date?: string;
  description?: string;
  value?: number;
  type?: string;
  status?: string;
  company_id?: string;
  category_id?: string;
  bank_account_id?: string;
  id_conta?: string;
  reference_id?: string;
  referencia_id?: string;
  created_at?: string;
  updated_at?: string;
  audit_log?: unknown[];
};
type NamedRow = EntityRecord & { name?: string };

const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function allTransactions() {
  if (!repository.listPage) return repository.list<TransactionRow>('transactions');
  const rows: TransactionRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await repository.listPage<TransactionRow>(
      'transactions', offset, 1000, 'transaction_date', false,
    );
    rows.push(...page.records);
    if (rows.length >= page.total || page.records.length < 1000) break;
  }
  return rows;
}

const lastMonths = (transactions: TransactionRow[], selected: TransactionRow) => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = date.toISOString().slice(0, 7);
    const value = transactions
      .filter(item =>
        String(item.transaction_date || item.date || '').startsWith(key)
        && item.company_id === selected.company_id
        && item.category_id === selected.category_id
        && item.type === selected.type)
      .reduce((sum, item) => sum + Math.abs(Number(item.value || 0)), 0);
    return { label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), value };
  });
};

const historyFor = (record: TransactionRow) => {
  const history: Array<{ at: string; label: string; detail?: string }> = [];
  if (record.created_at) history.push({ at: record.created_at, label: 'Lançamento criado' });
  if (Array.isArray(record.audit_log)) {
    record.audit_log.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      const item = entry as Record<string, unknown>;
      if (typeof item.at === 'string') {
        history.push({
          at: item.at,
          label: 'Alteração administrativa',
          detail: item.operation_id ? `Operação: ${String(item.operation_id)}` : undefined,
        });
      }
    });
  } else if (record.updated_at && record.updated_at !== record.created_at) {
    history.push({ at: record.updated_at, label: 'Última atualização registrada' });
  }
  return history.sort((left, right) => right.at.localeCompare(left.at));
};

export default function FluxoCaixa() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [companies, setCompanies] = useState<NamedRow[]>([]);
  const [categories, setCategories] = useState<NamedRow[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [company, setCompany] = useState('todas');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      allTransactions(),
      repository.list<NamedRow>('companies'),
      repository.list<NamedRow>('categories'),
    ]).then(([rows, companyRows, categoryRows]) => {
      if (!active) return;
      setTransactions(rows);
      setCompanies(companyRows);
      setCategories(categoryRows);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o fluxo de caixa.');
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
  const visible = transactions.filter(transaction => {
    const date = String(transaction.transaction_date || transaction.date || '');
    const term = search.trim().toLowerCase();
    return (type === 'todos' || transaction.type === type)
      && (status === 'todos' || transaction.status === status)
      && (company === 'todas' || transaction.company_id === company)
      && (!start || date >= start)
      && (!end || date <= end)
      && (!term || [
        transaction.description,
        companyNames.get(String(transaction.company_id || '')),
        categoryNames.get(String(transaction.category_id || '')),
      ].some(value => String(value || '').toLowerCase().includes(term)));
  });
  const revenues = visible
    .filter(item => item.type === 'receita' && item.status === 'pago')
    .reduce((sum, item) => sum + Math.abs(Number(item.value || 0)), 0);
  const expenses = visible
    .filter(item => item.type === 'despesa' && item.status === 'pago')
    .reduce((sum, item) => sum + Math.abs(Number(item.value || 0)), 0);

  const related = selected ? transactions.filter(item => {
    if (item.id === selected.id) return false;
    const selectedRefs = new Set([selected.id, selected.reference_id, selected.referencia_id].filter(Boolean));
    return selectedRefs.has(item.reference_id) || selectedRefs.has(item.referencia_id);
  }) : [];
  const changed = () => setVersion(value => value + 1);
  const actions = (item: TransactionRow) => (
    <ProtectedRecordActions
      table="transactions"
      record={item}
      onView={() => setSelected(item)}
      onChanged={changed}
      fields={[
        { key: 'description', label: 'Descrição' },
        { key: 'value', label: 'Valor', type: 'number' },
        { key: 'date', label: 'Data', type: 'date' },
        { key: 'type', label: 'Tipo' },
        { key: 'status', label: 'Status' },
        { key: 'observation', label: 'Observação' },
      ]}
    />
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-lg font-black">Fluxo de Caixa</h2>
        <p className="text-xs text-secondary">Transações completas com controle administrativo e auditoria.</p>
      </header>
      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-xl border bg-white p-5"><small>Registros</small><b className="block text-xl">{visible.length}</b></article>
        <article className="rounded-xl border bg-white p-5"><small>Receitas pagas</small><b className="block">{brl(revenues)}</b></article>
        <article className="rounded-xl border bg-white p-5"><small>Despesas pagas</small><b className="block">{brl(expenses)}</b></article>
        <article className="rounded-xl border bg-white p-5"><small>Resultado</small><b className="block">{brl(revenues - expenses)}</b></article>
      </section>

      <section className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
        <label className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar lançamento" className="w-full rounded border py-2 pl-9 pr-3 text-xs" />
        </label>
        <select value={type} onChange={event => setType(event.target.value)} className="rounded border p-2 text-xs">
          <option value="todos">Receitas e despesas</option><option value="receita">Receitas</option><option value="despesa">Despesas</option>
        </select>
        <select value={status} onChange={event => setStatus(event.target.value)} className="rounded border p-2 text-xs">
          <option value="todos">Todos os status</option><option value="pago">Pago</option><option value="pendente">Pendente</option><option value="atrasado">Atrasado</option>
        </select>
        <select value={company} onChange={event => setCompany(event.target.value)} className="rounded border p-2 text-xs">
          <option value="todas">Todas as empresas</option>
          {companies.map(item => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
        </select>
        <div className="flex gap-1">
          <input type="date" value={start} onChange={event => setStart(event.target.value)} className="min-w-0 rounded border p-2 text-xs" />
          <input type="date" value={end} onChange={event => setEnd(event.target.value)} className="min-w-0 rounded border p-2 text-xs" />
        </div>
      </section>

      {loading && <p className="rounded-xl border bg-white p-6 text-xs">Carregando lançamentos...</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>}
      {!loading && !error && visible.length === 0 && <p className="rounded-xl border bg-white p-6 text-xs text-secondary">Nenhum registro.</p>}

      <section className="hidden overflow-hidden rounded-xl border bg-white xl:block">
        <table className="w-full table-fixed text-left text-xs">
          <colgroup><col className="w-[92px]" /><col className="w-[clamp(180px,24vw,280px)]" /><col className="w-[120px]" /><col className="w-[120px]" /><col className="w-[80px]" /><col className="w-[85px]" /><col className="w-[115px]" /><col className="w-[128px]" /></colgroup>
          <thead><tr className="border-b bg-gray-50"><th className="p-3">Data</th><th>Descrição</th><th>Empresa</th><th>Categoria</th><th>Tipo</th><th>Status</th><th className="text-right">Valor</th><th className="text-center">Ações</th></tr></thead>
          <tbody>{visible.map(item => {
            const description = item.description || 'Sem descrição';
            const isRevenue = item.type === 'receita';
            return <tr key={item.id} className={`border-b last:border-0 ${isRevenue ? 'bg-emerald-50/60' : 'bg-red-50/60'}`}>
              <td className="p-3 whitespace-nowrap">{item.transaction_date || item.date || '—'}</td>
              <td className="max-w-[280px] truncate px-2" title={description}>{description}</td>
              <td className="truncate px-2" title={companyNames.get(String(item.company_id || '')) || 'Não vinculada'}>{companyNames.get(String(item.company_id || '')) || 'Não vinculada'}</td>
              <td className="truncate px-2" title={categoryNames.get(String(item.category_id || '')) || 'Não vinculada'}>{categoryNames.get(String(item.category_id || '')) || 'Não vinculada'}</td>
              <td className="px-2"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase ${isRevenue ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{item.type || '—'}</span></td>
              <td className="px-2 capitalize">{item.status || '—'}</td>
              <td className={`whitespace-nowrap px-2 text-right font-black ${isRevenue ? 'text-emerald-700' : 'text-red-700'}`}>{isRevenue ? '+ ' : '- '}{brl(Math.abs(Number(item.value || 0)))}</td>
              <td className="px-2 py-2">{actions(item)}</td>
            </tr>;
          })}</tbody>
        </table>
      </section>

      <section className="grid gap-3 xl:hidden">
        {visible.map(item => { const isRevenue = item.type === 'receita'; return <article key={item.id} className={`rounded-xl border p-4 ${isRevenue ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase text-secondary">{item.transaction_date || item.date || 'Data não informada'}</p><p className="truncate text-sm font-bold" title={item.description}>{item.description || 'Sem descrição'}</p></div>
            <b className={`shrink-0 whitespace-nowrap text-sm ${isRevenue ? 'text-emerald-700' : 'text-red-700'}`}>{isRevenue ? '+ ' : '- '}{brl(Math.abs(Number(item.value || 0)))}</b>
          </div>
          <dl className="my-3 grid grid-cols-2 gap-2 text-xs">
            <div><dt className="text-secondary">Categoria</dt><dd className="truncate">{categoryNames.get(String(item.category_id || '')) || 'Não vinculada'}</dd></div>
            <div><dt className="text-secondary">Empresa</dt><dd className="truncate">{companyNames.get(String(item.company_id || '')) || 'Não vinculada'}</dd></div>
            <div><dt className="text-secondary">Tipo</dt><dd className={`font-bold capitalize ${isRevenue ? 'text-emerald-700' : 'text-red-700'}`}>{item.type || '—'}</dd></div>
            <div><dt className="text-secondary">Status</dt><dd className="capitalize">{item.status || '—'}</dd></div>
          </dl>
          <div className="flex justify-end">{actions(item)}</div>
        </article>})}
      </section>

      <FinancialRecordDetails
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Detalhes do lançamento"
        record={selected}
        related={related}
        monthly={selected ? lastMonths(transactions, selected) : []}
        history={selected ? historyFor(selected) : []}
      />
    </div>
  );
}
