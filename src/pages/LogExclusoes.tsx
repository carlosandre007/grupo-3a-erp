import React, { useEffect, useState } from 'react';
import { Lock, Search } from 'lucide-react';
import { validateOwnerPassword } from '../services/adminValidation';
import { requireSupabase } from '../lib/supabase';

type LogRow = {
  id: string;
  deleted_at: string;
  deleted_by?: string;
  table_name: string;
  record_id: string;
  record_description?: string;
};
type LogContent = { reason?: string; snapshot?: Record<string, unknown>; ip?: string };

const contentOf = (log: LogRow): LogContent => {
  try {
    return JSON.parse(log.record_description || '{}') as LogContent;
  } catch {
    return {};
  }
};

export default function LogExclusoes() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Acesso protegido por validação administrativa.');
  const [unlocked, setUnlocked] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!unlocked) return;
    let active = true;
    (async () => {
      const all: LogRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await requireSupabase()
          .from('deletion_logs')
          .select('*')
          .order('deleted_at', { ascending: false })
          .range(offset, offset + 999);
        if (error) throw error;
        all.push(...(data as LogRow[]));
        if ((data?.length || 0) < 1000) break;
      }
      if (active) setLogs(all);
    })().catch(() => setMessage('Não foi possível consultar os logs permitidos pela sessão.'));
    return () => { active = false; };
  }, [unlocked]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await validateOwnerPassword(password);
    setPassword('');
    setMessage(result.message);
    setUnlocked(result.valid);
  };

  if (!unlocked) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl border bg-white p-8 text-center">
        <Lock className="mx-auto mb-4 h-10 w-10" />
        <h2 className="font-black">Log de Exclusões</h2>
        <p className="my-4 text-xs">{message}</p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="w-full rounded border p-3 text-xs"
            placeholder="Senha administrativa"
            required
          />
          <button className="mt-3 w-full rounded bg-black p-3 text-xs font-bold text-white">
            VALIDAR
          </button>
        </form>
      </div>
    );
  }

  const visible = logs.filter(log => {
    const content = contentOf(log);
    return !search || [
      log.id, log.table_name, log.record_id, log.deleted_by,
      content.reason, content.ip, JSON.stringify(content.snapshot || {}),
    ].some(value => String(value || '').toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-black">Log de Exclusões Administrativas</h2>
        <p className="text-xs text-secondary">Registros imutáveis, visíveis somente ao proprietário.</p>
      </header>
      <label className="relative block">
        <Search className="absolute left-3 top-2.5 h-4 w-4" />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar módulo, usuário, ID, motivo ou IP" className="w-full rounded border py-2 pl-9 text-xs" />
      </label>
      {visible.length === 0 && <p className="rounded border bg-white p-6 text-xs">Nenhuma exclusão registrada.</p>}
      {visible.map(log => {
        const content = contentOf(log);
        return (
          <article key={log.id} className="rounded border bg-white p-4 text-xs">
            <div className="flex flex-wrap justify-between gap-2">
              <b>{log.table_name} · {log.record_id}</b>
              <span>{new Date(log.deleted_at).toLocaleString('pt-BR')}</span>
            </div>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div><dt className="font-bold text-secondary">Usuário</dt><dd>{log.deleted_by || 'Não informado'}</dd></div>
              <div><dt className="font-bold text-secondary">IP</dt><dd>{content.ip || 'Não disponível'}</dd></div>
              <div className="sm:col-span-2"><dt className="font-bold text-secondary">Motivo</dt><dd>{content.reason || 'Não informado'}</dd></div>
              <div className="sm:col-span-2"><dt className="font-bold text-secondary">Dados anteriores completos</dt><dd><pre className="mt-1 max-h-72 overflow-auto rounded bg-gray-50 p-3 text-[10px]">{JSON.stringify(content.snapshot || {}, null, 2)}</pre></dd></div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}
