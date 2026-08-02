import React, { useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { repository } from '../repositories';
import type { EntityRecord } from '../repositories/contracts';
import{isCoreCompany}from'../services/companyProtection';
import Modal from '../components/Modal';
import { createCompanyProtected } from '../services/adminActions';

type Company = EntityRecord & {
  name?: string;
  legal_name?: string;
  kind?: string;
  status?: string;
};

export default function Empresas() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({name:'',legal_name:'',kind:'empresa',password:''});

  useEffect(() => {
    repository.list<Company>('companies')
      .then(setCompanies)
      .catch(() => setError('Não foi possível carregar as empresas cadastradas.'))
      .finally(() => setLoading(false));
  }, [version]);

  const create=async(event:React.FormEvent)=>{event.preventDefault();try{await createCompanyProtected({name:form.name,legal_name:form.legal_name,kind:form.kind},form.password);setOpen(false);setForm({name:'',legal_name:'',kind:'empresa',password:''});setVersion(value=>value+1);setError('')}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível cadastrar a empresa.')}};

  return <div className="space-y-6 animate-fade-in pb-12">
    <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 pb-4">
      <div>
      <h2 className="font-display font-black text-on-surface text-lg tracking-tight">Empresas do Grupo</h2>
      <p className="text-xs text-secondary mt-0.5">Empresas e holdings efetivamente cadastradas no sistema.</p>
      </div>
      <button onClick={()=>setOpen(true)} className="flex items-center gap-2 rounded bg-primary-container px-4 py-2 text-xs font-black"><Plus className="h-4 w-4"/> CRIAR EMPRESA</button>
    </div>
    {loading && <p className="rounded-xl border bg-white p-6 text-xs text-secondary">Carregando empresas...</p>}
    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-xs text-red-700">{error}</p>}
    {!loading && !error && companies.length === 0 && <div className="rounded-xl border bg-white p-10 text-center">
      <Building2 className="mx-auto mb-3 h-9 w-9 text-secondary" />
      <h3 className="font-display font-black">Nenhuma empresa cadastrada</h3>
      <p className="mt-1 text-xs text-secondary">Os dados aparecerão aqui após um cadastro real.</p>
    </div>}
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {companies.map(company => <article key={company.id} className="rounded-xl border border-l-4 border-l-primary-container bg-white p-6 custom-shadow">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-gray-50"><Building2 className="h-5 w-5" /></div><div>
            <h3 className="font-display font-black">{company.name || company.legal_name || 'Empresa sem nome'}</h3>
            <p className="text-[10px] font-bold uppercase text-secondary">{company.kind || 'Empresa do grupo'}</p>
          </div></div>
          <div className="flex flex-col items-end gap-1"><span className="rounded border bg-gray-50 px-2 py-1 text-[9px] font-black uppercase">{company.status || 'Ativa'}</span>{isCoreCompany(company)&&<span className="rounded bg-primary-container px-2 py-1 text-[9px] font-black uppercase">Empresa permanente</span>}</div>
        </div>
      </article>)}
    </div>
    <Modal isOpen={open} onClose={()=>setOpen(false)} title="Criar empresa"><form onSubmit={create} className="space-y-3"><input value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="Nome" className="w-full rounded border p-2 text-xs" required/><input value={form.legal_name} onChange={event=>setForm({...form,legal_name:event.target.value})} placeholder="Razão social" className="w-full rounded border p-2 text-xs"/><select value={form.kind} onChange={event=>setForm({...form,kind:event.target.value})} className="w-full rounded border p-2 text-xs"><option value="empresa">Empresa</option><option value="holding">Holding</option></select><input type="password" value={form.password} onChange={event=>setForm({...form,password:event.target.value})} placeholder="Senha administrativa" className="w-full rounded border p-2 text-xs" required/><button className="w-full rounded bg-black p-3 text-xs font-bold text-white">VALIDAR E CRIAR</button></form></Modal>
  </div>;
}
