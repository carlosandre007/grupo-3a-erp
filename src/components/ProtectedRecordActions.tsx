import React, { useState } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import Modal from './Modal';
import DeleteConfirmation from './DeleteConfirmation';
import { deleteProtected, updateProtected, type AdminTable } from '../services/adminActions';
import type { EntityRecord } from '../repositories';

type Field = { key: string; label: string; type?: 'text' | 'number' | 'date' };

type Props = {
  table: AdminTable;
  record: EntityRecord;
  fields: Field[];
  onChanged: () => void;
  onView?: () => void;
};

export default function ProtectedRecordActions({ table, record, fields, onChanged, onView }: Props) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});

  const openEdit = () => {
    setValues(Object.fromEntries(fields.map(field => [field.key, record[field.key] ?? ''])));
    setMessage('');
    setEditing(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await updateProtected(table, record.id, password, values);
      setEditing(false);
      setPassword('');
      onChanged();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Falha ao editar.');
    }
  };

  return (
    <div className="flex gap-1" onClick={event => event.stopPropagation()}>
      {onView && (
        <button onClick={onView} className="rounded border p-2" title="Visualizar">
          <Eye className="h-4 w-4" />
        </button>
      )}
      <button onClick={openEdit} className="rounded border p-2" title="Editar">
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={() => setDeleting(true)} className="rounded border p-2 text-red-700" title="Excluir">
        <Trash2 className="h-4 w-4" />
      </button>

      <Modal isOpen={editing} onClose={() => setEditing(false)} title="Editar registro">
        <form onSubmit={save} className="space-y-3">
          {fields.map(field => (
            <label key={field.key} className="block text-xs font-bold">
              {field.label}
              <input
                type={field.type || 'text'}
                value={String(values[field.key] ?? '')}
                onChange={event => setValues(current => ({
                  ...current,
                  [field.key]: field.type === 'number' ? Number(event.target.value) : event.target.value,
                }))}
                className="mt-1 w-full rounded border p-2 font-normal"
              />
            </label>
          ))}
          <label className="block text-xs font-bold">
            Senha administrativa
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="mt-1 w-full rounded border p-2"
              required
            />
          </label>
          {message && <p className="text-xs text-red-700">{message}</p>}
          <button className="w-full rounded bg-black p-3 text-xs font-bold text-white">
            VALIDAR E SALVAR
          </button>
        </form>
      </Modal>

      <DeleteConfirmation
        isOpen={deleting}
        recordName={String(record.name || record.description || record.id)}
        onClose={() => setDeleting(false)}
        onValidated={async (reason, masterPassword) => {
          await deleteProtected(table, record.id, masterPassword, reason);
          setDeleting(false);
          onChanged();
        }}
      />
    </div>
  );
}
