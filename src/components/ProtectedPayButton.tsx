import React, { useState } from 'react';
import { Check } from 'lucide-react';
import Modal from './Modal';
import { markFixedCostPaid } from '../services/adminActions';

export default function ProtectedPayButton({
  id,
  paid,
  onChanged,
}: {
  id: string;
  paid: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await markFixedCostPaid(id, password);
      setOpen(false);
      setPassword('');
      setMessage('');
      onChanged();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Falha ao marcar pagamento.');
    }
  };

  return (
    <>
      <button
        disabled={paid}
        onClick={() => setOpen(true)}
        className={`rounded border p-2 text-[10px] font-bold ${paid ? 'border-green-300 bg-green-50 text-green-800' : 'bg-white'}`}
        title={paid ? 'Pago no mês atual' : 'Marcar como pago no mês corrente'}
      >
        <Check className="h-4 w-4" />
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Confirmar pagamento">
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs">Será permitido apenas um pagamento desta recorrência no mês.</p>
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Senha administrativa"
            className="w-full rounded border p-2 text-xs"
            required
          />
          {message && <p className="text-xs text-red-700">{message}</p>}
          <button className="w-full rounded bg-black p-3 text-xs font-bold text-white">
            VALIDAR E MARCAR PAGO
          </button>
        </form>
      </Modal>
    </>
  );
}
