import { currentMonthCostSummary } from '../src/services/currentMonthCosts';

const summary = currentMonthCostSummary([
  { total: 100, status: 'pago', paid_at: '2026-07-10', due_date: '2026-07-10', month: 7, year: 2026 },
  { total: 250, status: 'pendente', due_date: '2026-07-30', month: 7, year: 2026 },
  { total: 999, status: 'pendente', due_date: '2026-05-01', month: 5, year: 2026 },
  { total: 888, status: 'pago', paid_at: '2026-08-01', due_date: '2026-08-01', month: 8, year: 2026 },
], '2026-07-27');

if (summary.total !== 350 || summary.paid !== 100 || summary.pending !== 250) {
  throw new Error('Cálculo mensal incluiu outro mês ou não conciliou Pago + Pendente.');
}
if (summary.total !== summary.paid + summary.pending) {
  throw new Error('Total cadastrado diverge de Pago + Pendente.');
}
if (summary.nextPending !== '2026-07-30') {
  throw new Error('Próximo vencimento mensal incorreto.');
}
if (JSON.stringify(summary).includes('2026-05-01')) {
  throw new Error('Vencimento antigo permaneceu no resumo.');
}
console.log('current-month-costs-smoke: OK');
