import React from 'react';
import Modal from './Modal';
import type { EntityRecord } from '../repositories';

type CostRow = EntityRecord & {
  name?: string;
  description?: string;
  total?: number;
  value?: number;
  price?: number;
  due_date?: string;
  next_due_date?: string;
  status?: string;
  paid_at?: string;
  is_recurrent?: boolean;
  frequency?: string;
};
type PaymentRow = EntityRecord & {
  description?: string;
  value?: number;
  transaction_date?: string;
  date?: string;
  status?: string;
};

type Props = {
  cost: CostRow | null;
  payments: PaymentRow[];
  company: string;
  category: string;
  onClose: () => void;
};

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const paid = (status: unknown) =>
  ['paid', 'pago', 'confirmed'].includes(String(status ?? '').toLowerCase());
const datePt = (value?: string) => {
  if (!value) return 'Não informado';
  const [date] = value.split('T');
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export default function FixedCostDetails({ cost, payments, company, category, onClose }: Props) {
  const sortedPayments = [...payments].sort((left, right) =>
    String(right.transaction_date || right.date || '').localeCompare(
      String(left.transaction_date || left.date || ''),
    ));
  const lastPayment = sortedPayments[0]?.transaction_date
    || sortedPayments[0]?.date
    || cost?.paid_at;
  const totalPaid = sortedPayments
    .filter(payment => paid(payment.status))
    .reduce((sum, payment) => sum + Math.abs(Number(payment.value || 0)), 0);
  const now = new Date();
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = date.toISOString().slice(0, 7);
    const value = sortedPayments
      .filter(payment =>
        String(payment.transaction_date || payment.date || '').startsWith(key)
        && paid(payment.status))
      .reduce((sum, payment) => sum + Math.abs(Number(payment.value || 0)), 0);
    return { label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), value };
  });
  const maximum = Math.max(...monthly.map(point => point.value), 1);
  const monthlyValue = Number(cost?.total ?? cost?.value ?? cost?.price ?? 0);
  const recurrence = cost?.frequency
    || (cost?.is_recurrent ? 'Mensal' : 'Não recorrente');

  return (
    <Modal isOpen={!!cost} onClose={onClose} title="Detalhes do custo fixo">
      {cost && (
        <div className="max-h-[76vh] space-y-5 overflow-y-auto pr-1 text-sm">
          <section className="grid gap-3 rounded-xl border bg-gray-50 p-4 sm:grid-cols-2">
            <Info label="Nome" value={String(cost.name || cost.description || 'Sem descrição')} />
            <Info label="Empresa" value={company} />
            <Info label="Categoria" value={category} />
            <Info label="Valor mensal" value={money(monthlyValue)} />
            <Info label="Vencimento" value={datePt(cost.due_date)} />
            <Info label="Situação" value={paid(cost.status) ? 'Pago' : 'Pendente'} />
            <Info label="Data do último pagamento" value={datePt(lastPayment)} />
            <Info label="Próximo vencimento" value={datePt(cost.next_due_date || cost.due_date)} />
            <Info label="Recorrência" value={recurrence} />
            <Info label="Total pago" value={money(totalPaid)} />
            <div className="sm:col-span-2">
              <p className="text-[10px] font-black uppercase text-secondary">Observações</p>
              <p className="mt-1">Nenhuma observação cadastrada.</p>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-black uppercase">Histórico de pagamentos</h3>
            {sortedPayments.length === 0 ? (
              <p className="rounded border p-3 text-xs text-secondary">Nenhum pagamento relacionado.</p>
            ) : sortedPayments.map(payment => (
              <article key={payment.id} className="mb-2 flex justify-between gap-3 rounded border p-3 text-xs">
                <div>
                  <b>{datePt(payment.transaction_date || payment.date)}</b>
                  <p>{paid(payment.status) ? 'Pagamento confirmado' : 'Pagamento pendente'}</p>
                </div>
                <b className="whitespace-nowrap">{money(Number(payment.value || 0))}</b>
              </article>
            ))}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-black uppercase">Valores pagos por mês</h3>
            <div className="flex h-40 items-end gap-2 rounded border bg-gray-50 p-3">
              {monthly.map(point => (
                <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[9px] font-bold">{money(point.value)}</span>
                  <div
                    className="w-full rounded-t bg-primary-container"
                    style={{ height: `${Math.max(4, Math.round(point.value / maximum * 100))}%` }}
                    title={`${point.label}: ${money(point.value)}`}
                  />
                  <span className="text-[9px] capitalize">{point.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase text-secondary">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
