import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Plus, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getActiveAlerts, type ActiveAlert } from '../components/AlertsPanel';
import Modal from '../components/Modal';
import { createAlertProtected } from '../services/adminActions';
import { requireSupabase } from '../lib/supabase';

export default function Alertas() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [version, setVersion] = useState(0);
  const [manual, setManual] = useState<ActiveAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ title: '', description: '', priority: 'media', due_date: '', password: '' });
  const [hidden, setHidden] = useState<string[]>(() =>
    JSON.parse(sessionStorage.getItem('erp_hidden_alerts') || '[]'));

  useEffect(() => {
    const update = () => setVersion(value => value + 1);
    window.addEventListener('erp-data-updated', update);
    window.addEventListener('erp-transactions-updated', update);
    return () => {
      window.removeEventListener('erp-data-updated', update);
      window.removeEventListener('erp-transactions-updated', update);
    };
  }, []);
  useEffect(() => {
    requireSupabase().from('alerts').select('id,title,description,priority,due_date,status')
      .eq('status', 'ativo')
      .then(({ data, error }) => {
        if (error) return;
        setManual((data || []).map(item => ({
          id: item.id,
          type: 'Manual',
          name: item.title,
          description: item.description,
          due: item.due_date || 'Sem vencimento',
          company: 'GRUPO 3A',
          status: item.status,
          priority: item.priority === 'media' ? 'média' : item.priority,
          route: '/alertas',
        } as ActiveAlert)));
      });
  }, [version]);

  const all = [...getActiveAlerts(), ...manual];
  const type = params.get('tipo');
  const alerts = useMemo(
    () => all.filter(alert => !hidden.includes(alert.id) && (!type || alert.type === type)),
    [all, hidden, type, version],
  );
  const hide = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    sessionStorage.setItem('erp_hidden_alerts', JSON.stringify(next));
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createAlertProtected({
        title: form.title,
        description: form.description,
        priority: form.priority,
        due_date: form.due_date || null,
      }, form.password);
      setMessage('Operação concluída.');
      setForm({ title: '', description: '', priority: 'media', due_date: '', password: '' });
      setVersion(value => value + 1);
      setOpen(false);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível criar o alerta.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div><h1 className="flex items-center gap-2 font-display text-xl font-black"><AlertTriangle className="text-amber-600" /> Central de Alertas</h1><p className="text-xs text-secondary">Alertas ativos do sistema.</p></div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded bg-primary-container px-4 py-2 text-xs font-black"><Plus className="h-4 w-4" /> CRIAR ALERTA</button>
      </header>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => navigate('/alertas')} className="rounded border px-3 py-2 text-xs font-bold">Todos ({all.length})</button>
        {[...new Set(all.map(alert => alert.type))].map(item => <button key={item} onClick={() => navigate(`/alertas?tipo=${encodeURIComponent(item)}`)} className={`rounded border px-3 py-2 text-xs font-bold ${type === item ? 'bg-primary-container' : 'bg-white'}`}>{item}</button>)}
      </div>
      <section className="space-y-3">
        {alerts.map(alert => <article key={alert.id} onClick={() => navigate(alert.route)} className="cursor-pointer rounded-xl border bg-white p-5"><div className="flex justify-between gap-4"><div><div className="flex gap-2"><span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-black uppercase">{alert.priority}</span><span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-black uppercase">{alert.type}</span></div><h2 className="mt-3 font-black">{alert.name}</h2><p className="text-xs">{alert.description}</p><p className="mt-2 text-xs text-secondary">Empresa: {alert.company} · Vencimento: {alert.due} · Status: {alert.status}</p></div><button onClick={event => { event.stopPropagation(); hide(alert.id); }} title="Ocultar nesta sessão"><X className="w-5" /></button></div><button className="mt-4 flex items-center gap-1 text-xs font-black text-primary"><ExternalLink className="w-4" /> Abrir cadastro correspondente</button></article>)}
        {!alerts.length && <div className="rounded-xl border bg-white p-8 text-center text-sm text-secondary">Nenhum alerta ativo neste filtro.</div>}
      </section>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Criar alerta">
        <form onSubmit={create} className="space-y-3">
          <input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Título" className="w-full rounded border p-2 text-xs" required />
          <textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Descrição" className="w-full rounded border p-2 text-xs" required />
          <select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })} className="w-full rounded border p-2 text-xs"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select>
          <input type="date" value={form.due_date} onChange={event => setForm({ ...form, due_date: event.target.value })} className="w-full rounded border p-2 text-xs" />
          <input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="Senha administrativa" className="w-full rounded border p-2 text-xs" required />
          {message && <p className="text-xs">{message}</p>}
          <button className="w-full rounded bg-black p-3 text-xs font-bold text-white">VALIDAR E CRIAR</button>
        </form>
      </Modal>
    </div>
  );
}
