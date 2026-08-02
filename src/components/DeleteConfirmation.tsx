import React, { useState } from 'react';
import Modal from './Modal';
import { validateAdministrativePassword } from '../services/adminValidation';

interface Props {
  isOpen: boolean;
  recordName: string;
  onClose: () => void;
  onValidated: (reason: string, password: string) => void | Promise<void>;
}

export default function DeleteConfirmation({ isOpen, recordName, onClose, onValidated }: Props) {
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || !reason.trim()) return setMessage('Informe a senha administrativa e o motivo.');
    const result = await validateAdministrativePassword(password);
    if (!result.valid) return setMessage(result.message);
    await onValidated(reason.trim(), password);
    setPassword('');
    setReason('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar exclusão protegida">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-secondary">A exclusão de <strong>{recordName}</strong> é permanente e exige validação administrativa.</p>
        <div>
          <label className="text-[10px] font-bold text-secondary uppercase">Motivo da exclusão</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} required className="mt-1 w-full border border-outline-variant rounded p-2 text-xs" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-secondary uppercase">Senha administrativa</label>
          <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 w-full border border-outline-variant rounded p-2 text-xs" />
        </div>
        {message && <p className="text-xs text-error bg-red-50 border border-red-100 rounded p-3">{message}</p>}
        <button type="submit" className="w-full py-2.5 bg-error text-white rounded font-bold text-xs uppercase">Validar e excluir</button>
      </form>
    </Modal>
  );
}
