import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Home, MapPin, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { repository, type EntityRecord } from '../repositories';

type PropertyRow = EntityRecord & {
  code?: string; name?: string; description?: string; tipo?: string; address?: string;
  rent_value?: number; tenant?: string; status?: string;
};
type ChargeRow = EntityRecord & {
  ref?: string; value?: number; valor_cobranca?: number; due_date?: string;
  status?: string; received_at?: string;
};
const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const paid = (status: unknown) =>
  ['pago', 'paid', 'received', 'confirmed'].includes(String(status || '').toLowerCase());
const fortalezaMonth = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find(item => item.type === 'year')?.value;
  const month = parts.find(item => item.type === 'month')?.value;
  return `${year}-${month}`;
};

export default function Imoveis() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      repository.list<PropertyRow>('properties'),
      repository.list<ChargeRow>('charges'),
    ]).then(([propertyRows, chargeRows]) => {
      if (active) { setProperties(propertyRows); setCharges(chargeRows); }
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os imóveis.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = properties.filter(property =>
    (status === 'todos' || property.status === status)
    && (!search.trim() || [property.name, property.description, property.address, property.tenant, property.code]
      .some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))));
  const metrics = useMemo(() => ({
    rented: properties.filter(property => property.status === 'alugado').length,
    available: properties.filter(property => property.status === 'disponivel').length,
  }), [properties]);
  const month = fortalezaMonth();
  const financial = (property: PropertyRow) => {
    const propertyCharges = charges.filter(charge =>
      String(charge.ref || '').trim().toLowerCase() === String(property.code || '').trim().toLowerCase()
      && String(charge.due_date || '').startsWith(month));
    const received = propertyCharges
      .filter(charge => paid(charge.status) || String(charge.received_at || '').startsWith(month))
      .reduce((sum, charge) => sum + Number(charge.value ?? charge.valor_cobranca ?? 0), 0);
    const receivable = propertyCharges
      .filter(charge => !paid(charge.status) && !String(charge.received_at || '').startsWith(month))
      .reduce((sum, charge) => sum + Number(charge.value ?? charge.valor_cobranca ?? 0), 0);
    return { received, receivable };
  };

  return (
    <div className="space-y-6">
      <header><h2 className="font-display text-lg font-black">Imóveis</h2><p className="text-xs text-secondary">Valores mensais vinculados às cobranças pelo código real do imóvel.</p></header>
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border bg-white p-5"><Building2 /><small className="block">Imóveis</small><b>{properties.length}</b></article>
        <article className="rounded-xl border bg-white p-5"><small>Alugados</small><b>{metrics.rented}</b></article>
        <article className="rounded-xl border bg-white p-5"><small>Disponíveis</small><b>{metrics.available}</b></article>
      </section>
      <section className="flex gap-3 rounded-xl border bg-white p-4">
        <label className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar imóvel" className="w-full rounded border py-2 pl-9 pr-3 text-xs" /></label>
        <select value={status} onChange={event => setStatus(event.target.value)} className="rounded border p-2 text-xs"><option value="todos">Todos</option><option value="alugado">Alugados</option><option value="disponivel">Disponíveis</option><option value="manutencao">Manutenção</option></select>
      </section>
      {loading && <p className="rounded-xl border bg-white p-6 text-xs">Carregando imóveis...</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>}
      {!loading && !error && visible.length === 0 && <p className="rounded-xl border bg-white p-6 text-xs text-secondary">Nenhum registro.</p>}
      <section className="grid gap-4 md:grid-cols-2">
        {visible.map(property => {
          const values = financial(property);
          return <article key={property.id} onClick={() => navigate(`/bens/imovel/${property.id}`)} className="cursor-pointer rounded-xl border bg-white p-5 custom-shadow">
            <div className="flex justify-between"><div><b>{property.name || property.description || 'Imóvel sem nome'} {property.code && <span className="text-primary">{property.code}</span>}</b><p className="text-xs text-secondary"><MapPin className="mr-1 inline h-4 w-4" />{property.address || 'Endereço não informado'}</p></div><Home className="h-5 w-5" /></div>
            <p className="mt-3 text-xs">{property.tipo || 'Tipo não informado'} · {property.status || 'Status não informado'}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
              <div><small className="text-secondary">A receber no mês</small><b className="block">{brl(values.receivable)}</b></div>
              <div><small className="text-secondary">Recebido no mês</small><b className="block text-green-700">{brl(values.received)}</b></div>
            </div>
            {property.tenant && <p className="mt-2 text-xs">Inquilino: {property.tenant}</p>}
          </article>;
        })}
      </section>
    </div>
  );
}
