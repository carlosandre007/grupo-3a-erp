import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { repository } from '../repositories';
import type { EntityRecord } from '../repositories/contracts';
import{isCoreCompany}from'../services/companyProtection';

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

  useEffect(() => {
    repository.list<Company>('companies')
      .then(setCompanies)
      .catch(() => setError('Não foi possível carregar as empresas cadastradas.'))
      .finally(() => setLoading(false));
  }, []);

  return <div className="space-y-6 animate-fade-in pb-12">
    <div className="border-b border-outline-variant/30 pb-4">
      <h2 className="font-display font-black text-on-surface text-lg tracking-tight">Empresas do Grupo</h2>
      <p className="text-xs text-secondary mt-0.5">Empresas e holdings efetivamente cadastradas no sistema.</p>
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
        <p className="mt-5 break-all text-[10px] text-secondary">ID: {company.id}</p>
      </article>)}
    </div>
  </div>;
}
