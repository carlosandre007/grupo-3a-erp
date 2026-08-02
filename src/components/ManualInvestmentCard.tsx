import React, { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import Modal from './Modal';
import {
  getManualInvestment,
  getManualInvestmentHistory,
  ManualInvestmentStorageUnavailableError,
  saveManualInvestment,
  type ManualInvestment,
  type ManualInvestmentHistory,
} from '../services/manualInvestment';

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ManualInvestmentCard({ onChanged }: { onChanged?: () => void }) {
  const [investment, setInvestment] = useState<ManualInvestment | null>(null);
  const [history, setHistory] = useState<ManualInvestmentHistory[]>([]);
  const [available, setAvailable] = useState(true);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const [current, changes] = await Promise.all([
      getManualInvestment(),
      getManualInvestmentHistory(),
    ]);
    setInvestment(current);
    setHistory(changes);
    setAvailable(true);
    setValue(current ? String(current.value) : '');
  };
  useEffect(() => {
    void load().catch(reason => {
      setAvailable(!(reason instanceof ManualInvestmentStorageUnavailableError));
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível consultar o Investido Atual.');
    });
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await saveManualInvestment(Number(value), password);
      setMessage('Operação concluída.');
      setPassword('');
      await load();
      onChanged?.();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.');
    }
  };

  return (
    <article className="rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div><small>INVESTIDO ATUAL</small><b className="block text-xl">{investment ? money(investment.value) : 'Não configurado'}</b></div>
        <button disabled={!available} onClick={() => setOpen(true)} title="Editar Investido Atual" className="rounded border p-2 disabled:opacity-40"><Pencil className="h-4 w-4" /></button>
      </div>
      {!available && <p className="mt-2 text-[10px] text-amber-700">Estrutura SQL pendente de autorização.</p>}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Editar Investido Atual">
        <form onSubmit={save} className="space-y-3">
          <label className="block text-xs font-bold">Valor manual<input type="number" min="0" step="0.01" value={value} onChange={event => setValue(event.target.value)} className="mt-1 w-full rounded border p-2" required /></label>
          <label className="block text-xs font-bold">Senha administrativa<input type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded border p-2" required /></label>
          {message && <p className="rounded bg-gray-50 p-2 text-xs">{message}</p>}
          <button className="w-full rounded bg-black p-3 text-xs font-bold text-white">VALIDAR E SALVAR</button>
        </form>
        <h3 className="mt-5 text-xs font-black uppercase">Histórico de alterações</h3>
        {history.length === 0 ? <p className="mt-2 text-xs text-secondary">Nenhuma alteração registrada.</p> : history.map(item => <p key={item.id} className="mt-2 rounded border p-2 text-xs">{new Date(item.changedAt).toLocaleString('pt-BR')}: {item.previousValue === undefined ? 'sem valor anterior' : money(item.previousValue)} → {money(item.newValue)}</p>)}
      </Modal>
    </article>
  );
}
