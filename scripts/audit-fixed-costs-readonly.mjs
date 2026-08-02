import { readFile } from 'node:fs/promises';

const parse = text => Object.fromEntries(
  text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const position = line.indexOf('=');
      return [line.slice(0, position).trim(), line.slice(position + 1).trim()];
    }),
);

const env = parse(await readFile('.env.local', 'utf8'));
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Configuração pública do Supabase ausente.');
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const all = async table => {
  const records = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(
      `${url}/rest/v1/${table}?select=*&offset=${offset}&limit=1000`,
      { headers },
    );
    if (!response.ok) throw new Error(`Falha sanitizada ao consultar ${table}: HTTP ${response.status}.`);
    const page = await response.json();
    records.push(...page);
    if (page.length < 1000) return records;
  }
};

const [costs, transactions] = await Promise.all([all('fixed_costs'), all('transactions')]);
const normalized = value => String(value ?? '').trim().toLocaleLowerCase('pt-BR');
const paid = value => ['pago', 'paid', 'confirmed'].includes(normalized(value));
const monthOf = cost => {
  if (Number(cost.year) && Number(cost.month)) {
    return `${Number(cost.year)}-${String(Number(cost.month)).padStart(2, '0')}`;
  }
  return String(cost.due_date || cost.created_at || '').slice(0, 7);
};
const recurrenceKey = cost => String(
  cost.recurrence_group_id
  || [normalized(cost.name), normalized(cost.company), normalized(cost.category)].join('|'),
);
const display = cost => String(cost.name || 'Sem descrição').slice(0, 100);
const issues = [];

const byRecurrenceMonth = new Map();
for (const cost of costs) {
  const keyValue = `${recurrenceKey(cost)}|${monthOf(cost)}`;
  const group = byRecurrenceMonth.get(keyValue) || [];
  group.push(cost);
  byRecurrenceMonth.set(keyValue, group);

  if (paid(cost.status) && !cost.paid_at) issues.push({ type: 'status_paid_without_paid_at', item: display(cost) });
  if (!paid(cost.status) && cost.paid_at) issues.push({ type: 'paid_at_with_unpaid_status', item: display(cost) });
  if (!cost.company_id && !String(cost.company || '').trim()) issues.push({ type: 'missing_company', item: display(cost) });
  if (!cost.category_id && !String(cost.category || '').trim()) issues.push({ type: 'missing_category', item: display(cost) });
  if (!Number(cost.total ?? cost.price)) issues.push({ type: 'missing_or_zero_value', item: display(cost) });
  if (!cost.due_date) issues.push({ type: 'missing_due_date', item: display(cost) });
  if (cost.is_recurrent && !cost.recurrence_group_id) issues.push({ type: 'recurrent_without_group', item: display(cost) });

  const price = Number(cost.price);
  const quantity = Number(cost.qty);
  const total = Number(cost.total);
  if (
    Number.isFinite(price) && Number.isFinite(quantity) && Number.isFinite(total)
    && Math.abs(total - price * quantity) > 0.009
  ) issues.push({ type: 'total_mismatch', item: display(cost) });
}

for (const group of byRecurrenceMonth.values()) {
  if (group.length > 1) {
    issues.push({
      type: 'duplicate_recurrence_month',
      item: display(group[0]),
      count: group.length,
      month: monthOf(group[0]),
    });
  }
}

const dueDays = Object.fromEntries(
  costs.reduce((map, cost) => {
    const day = Number(String(cost.due_date || '').slice(-2));
    map.set(String(day || 'missing'), (map.get(String(day || 'missing')) || 0) + 1);
    return map;
  }, new Map()),
);
const issueCounts = Object.fromEntries(
  issues.reduce((map, issue) => {
    map.set(issue.type, (map.get(issue.type) || 0) + 1);
    return map;
  }, new Map()),
);
const relatedPayments = transactions.filter(transaction => {
  const reference = transaction.reference_id || transaction.referencia_id;
  return reference && costs.some(cost => cost.id === reference);
});

console.log(JSON.stringify({
  mode: 'SELECT_ONLY',
  counts: { fixedCosts: costs.length, transactions: transactions.length, relatedPayments: relatedPayments.length },
  dueDays,
  issueCounts,
  issues,
  writes: 0,
}, null, 2));
