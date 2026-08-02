export type SummarizableCost = {
  total?: unknown;
  value?: unknown;
  price?: unknown;
  status?: unknown;
  paid_at?: unknown;
  due_date?: unknown;
  next_due_date?: unknown;
  month?: unknown;
  year?: unknown;
};

const paid = (value: unknown) =>
  ['paid', 'pago', 'confirmed'].includes(String(value ?? '').toLowerCase());
const amount = (cost: SummarizableCost) =>
  Number(cost.total ?? cost.value ?? cost.price ?? 0);

export const fortalezaToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export function currentMonthCostSummary(costs: SummarizableCost[], today = fortalezaToday()) {
  const monthKey = today.slice(0, 7);
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const current = costs.filter(cost => {
    if (Number(cost.year) && Number(cost.month)) {
      return Number(cost.year) === year && Number(cost.month) === month;
    }
    return String(cost.due_date || '').startsWith(monthKey);
  });
  const paidCosts = current.filter(cost =>
    paid(cost.status) || String(cost.paid_at || '').startsWith(monthKey));
  const pendingCosts = current.filter(cost => !paidCosts.includes(cost));
  const nextPending = pendingCosts
    .map(cost => String(cost.due_date || cost.next_due_date || ''))
    .filter(date => date >= today)
    .sort()[0];
  const paidValue = paidCosts.reduce((sum, cost) => sum + amount(cost), 0);
  const pendingValue = pendingCosts.reduce((sum, cost) => sum + amount(cost), 0);
  return {
    total: paidValue + pendingValue,
    paid: paidValue,
    pending: pendingValue,
    nextPending,
    count: current.length,
  };
}
