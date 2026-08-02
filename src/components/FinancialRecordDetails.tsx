import React from 'react';
import Modal from './Modal';
import type { EntityRecord } from '../repositories';

type MonthlyPoint = { label: string; value: number };
type HistoryItem = { at: string; label: string; detail?: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  record: EntityRecord | null;
  related: EntityRecord[];
  monthly: MonthlyPoint[];
  history: HistoryItem[];
};

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const display = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Não informado';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

export default function FinancialRecordDetails({
  isOpen,
  onClose,
  title,
  record,
  related,
  monthly,
  history,
}: Props) {
  const maximum = Math.max(...monthly.map(point => Math.abs(point.value)), 1);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {record && (
        <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
          <section>
            <h3 className="mb-2 text-xs font-black uppercase">Detalhes completos</h3>
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(record).map(([key, value]) => (
                <div key={key} className="min-w-0 rounded border bg-gray-50 p-2 text-xs">
                  <dt className="font-bold text-secondary">{key}</dt>
                  <dd className="mt-1 break-words whitespace-pre-wrap">{display(value)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-black uppercase">Histórico de alterações</h3>
            {history.length === 0 ? (
              <p className="rounded border p-3 text-xs text-secondary">
                Nenhuma alteração registrada nos campos de auditoria existentes.
              </p>
            ) : history.map((item, index) => (
              <article key={`${item.at}-${index}`} className="border-l-2 border-primary-container py-1 pl-3 text-xs">
                <b>{item.label}</b>
                <p>{new Date(item.at).toLocaleString('pt-BR')}</p>
                {item.detail && <p className="mt-1 break-words text-secondary">{item.detail}</p>}
              </article>
            ))}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-black uppercase">Pagamentos relacionados</h3>
            {related.length === 0 ? (
              <p className="rounded border p-3 text-xs text-secondary">Nenhum pagamento relacionado.</p>
            ) : related.map(item => (
              <article key={item.id} className="mb-2 flex items-center justify-between gap-3 rounded border p-3 text-xs">
                <div className="min-w-0">
                  <b className="block truncate">{String(item.description || item.name || item.id)}</b>
                  <span>{String(item.transaction_date || item.date || item.paid_at || 'Data não informada')}</span>
                </div>
                <b className="shrink-0">{money(Number(item.value || item.total || item.price || 0))}</b>
              </article>
            ))}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-black uppercase">Evolução mensal</h3>
            <div className="flex h-40 items-end gap-2 rounded border bg-gray-50 p-3">
              {monthly.map(point => (
                <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[9px] font-bold">{money(point.value)}</span>
                  <div
                    className="w-full rounded-t bg-primary-container"
                    style={{ height: `${Math.max(4, Math.round(Math.abs(point.value) / maximum * 100))}%` }}
                    title={`${point.label}: ${money(point.value)}`}
                  />
                  <span className="text-[9px]">{point.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
