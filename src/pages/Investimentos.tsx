import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import Modal from '../components/Modal';
import DeleteConfirmation from '../components/DeleteConfirmation';
import { Investment } from '../types';
import { addDeletionLog, addInvestment, deleteInvestment, getInvestments, getProperties, getTransactions, getVehicles, updateInvestment } from '../mockData';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const empty = { company: '' as Investment['company'] | '', description: '', category: '', value: 0, date: new Date().toISOString().slice(0, 10), notes: '', assetId: '' };

export default function Investimentos() {
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);
  const [details, setDetails] = useState<Investment | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const investments = getInvestments();
  const vehicles = getVehicles();
  const properties = getProperties();
  const assets = [...vehicles.map(v => ({ id: v.id, code: v.code, name: v.model, company: 'LOC MOTTUS' as const, value: v.purchaseValue || 0, type: 'Veículo' })), ...properties.map(p => ({ id: p.id, code: p.code, name: p.name, company: 'IMÓVEIS' as const, value: p.purchaseValue || 0, type: 'Imóvel' }))];
  const categories = useMemo(() => [...new Set(getTransactions().filter(t => t.nature!=='caucao_passivo'&&(!form.company || t.company === form.company)).map(t => t.category).filter(Boolean))].sort(), [form.company, version]);
  const manualCounted = investments.filter(i => !i.assetId);
  const rows = [...assets.map(a => ({ id: `asset-${a.id}`, date: '', company: a.company, description: `${a.code || 'Sem código'} — ${a.name}`, category: a.type, value: a.value, source: 'Bem cadastrado' })), ...investments.map(i => ({ ...i, source: i.assetId ? 'Aporte vinculado (não somado novamente)' : 'Investimento manual' }))];
  const totalVehicles = vehicles.reduce((s, v) => s + (v.purchaseValue || 0), 0);
  const totalProperties = properties.reduce((s, p) => s + (p.purchaseValue || 0), 0);
  const totalManual = manualCounted.reduce((s, i) => s + i.value, 0);
  const total = totalVehicles + totalProperties + totalManual;
  const totalsByCompany = (['LOC MOTTUS', '3A RASTREAR', 'IMÓVEIS', 'HOLDING'] as Investment['company'][]).map(company => ({ company, value: assets.filter(a => a.company === company).reduce((s, a) => s + a.value, 0) + manualCounted.filter(i => i.company === company).reduce((s, i) => s + i.value, 0) }));
  const evolution = [...manualCounted.map(i => ({ date: i.date, value: i.value })), ...assets.filter(a => a.value > 0).map(a => ({ date: '', value: a.value }))].sort((a, b) => a.date.localeCompare(b.date));

  const save = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try {
      const payload = { ...form, company: form.company as Investment['company'], assetId: form.assetId || undefined, notes: form.notes || undefined };
      editing ? updateInvestment({ ...editing, ...payload }) : addInvestment(payload);
      setOpen(false); setEditing(null); setForm(empty); setVersion(v => v + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.'); }
  };
  const edit = (item: Investment) => { setEditing(item); setForm({ company: item.company, description: item.description, category: item.category, value: item.value, date: item.date, notes: item.notes || '', assetId: item.assetId || '' }); setOpen(true); };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-xl font-black">Investimentos</h1><p className="text-xs text-secondary">Bens e aportes registrados, sem dupla contagem.</p></div><button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} className="flex items-center gap-2 rounded bg-primary-container px-4 py-2 text-xs font-black"><Plus className="w-4"/> NOVO INVESTIMENTO</button></header>
    <section className="grid gap-3 md:grid-cols-4"><Card label="Total geral investido" value={total}/><Card label="Veículos" value={totalVehicles}/><Card label="Imóveis" value={totalProperties}/><Card label="Investimentos manuais" value={totalManual}/></section>
    <section className="grid gap-3 md:grid-cols-4">{totalsByCompany.map(item => <Card key={item.company} label={item.company === 'HOLDING' ? 'HOLDING GRUPO 3A' : item.company} value={item.value}/>)}</section>
    <section className="rounded-xl border bg-white p-5"><h2 className="font-black">Evolução dos investimentos</h2>{evolution.length ? <div className="mt-4 flex h-28 items-end gap-2">{evolution.map((item, index) => <div key={`${item.date}-${index}`} title={`${item.date || 'Aquisição'}: ${money(item.value)}`} className="min-w-3 flex-1 rounded-t bg-primary-container" style={{ height: `${Math.max(8, item.value / Math.max(...evolution.map(e => e.value)) * 100)}%` }}/>)}</div> : <p className="mt-3 text-xs text-secondary">Nenhum investimento cadastrado.</p>}</section>
    <section className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-xs"><thead className="bg-gray-50 text-left"><tr><th className="p-3">Data</th><th>Descrição</th><th>Empresa</th><th>Categoria</th><th>Origem</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.date || 'Aquisição'}</td><td>{row.description}</td><td>{row.company}</td><td>{row.category}</td><td>{row.source}</td><td>{money(row.value)}</td><td>{!row.id.startsWith('asset-') && <div className="flex gap-2"><button onClick={() => setDetails(investments.find(i => i.id === row.id) || null)}>Ver detalhes</button><button onClick={() => edit(investments.find(i => i.id === row.id)!)}><Pencil className="w-4"/></button><button onClick={() => setDeleting(investments.find(i => i.id === row.id) || null)} className="text-red-700"><Trash2 className="w-4"/></button></div>}</td></tr>)}</tbody></table>{!rows.length && <p className="p-5 text-xs text-secondary">Nenhum bem ou investimento cadastrado.</p>}</section>
    <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Editar investimento' : 'Novo investimento'}><form onSubmit={save} className="grid grid-cols-2 gap-3"><select required value={form.company} onChange={e => setForm({...form, company: e.target.value as Investment['company'], category: ''})} className="border p-2"><option value="">Empresa ou Holding</option><option>LOC MOTTUS</option><option>3A RASTREAR</option><option>IMÓVEIS</option><option value="HOLDING">HOLDING GRUPO 3A</option></select><input required placeholder="Descrição" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="border p-2"/><select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="border p-2"><option value="">Categoria cadastrada</option>{categories.map(c => <option key={c}>{c}</option>)}</select><input required type="number" min="0.01" step="0.01" value={form.value} onChange={e => setForm({...form, value: Number(e.target.value)})} className="border p-2"/><input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="border p-2"/><select value={form.assetId} onChange={e => setForm({...form, assetId: e.target.value})} className="border p-2"><option value="">Sem bem relacionado</option>{assets.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select><textarea placeholder="Observação" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="col-span-2 border p-2"/>{error && <p className="col-span-2 text-xs text-red-700">{error}</p>}<button className="col-span-2 bg-primary-container p-3 font-black">SALVAR</button></form></Modal>
    <Modal isOpen={!!details} onClose={() => setDetails(null)} title="Detalhes do investimento">{details && <dl className="grid grid-cols-2 gap-3 text-xs"><dt>Descrição</dt><dd>{details.description}</dd><dt>Empresa</dt><dd>{details.company}</dd><dt>Categoria</dt><dd>{details.category}</dd><dt>Data</dt><dd>{details.date}</dd><dt>Valor</dt><dd>{money(details.value)}</dd><dt>Observação</dt><dd>{details.notes || 'Sem observação'}</dd></dl>}</Modal>
    <DeleteConfirmation isOpen={!!deleting} recordName={deleting?.description || ''} onClose={() => setDeleting(null)} onValidated={reason => { if (!deleting) return; deleteInvestment(deleting.id); addDeletionLog({ recordType: 'investimento', originalId: deleting.id, description: deleting.description, company: deleting.company, sourceModule: 'Investimentos', responsibleUser: 'Usuário local', reason, adminValidated: true, recordValue: deleting.value, category: deleting.category, recordDate: deleting.date }); setDeleting(null); setVersion(v => v + 1); }}/>
  </div>;
}

function Card({ label, value }: { label: string; value: number; key?: React.Key }) { return <article className="rounded-xl border bg-white p-5"><TrendingUp className="mb-2 w-4 text-primary"/><p className="text-[10px] font-bold uppercase text-secondary">{label}</p><b>{money(value)}</b></article>; }
