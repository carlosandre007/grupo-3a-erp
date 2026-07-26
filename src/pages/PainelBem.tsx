import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAssetDetails, getProperties, getTransactions, getVehicles } from '../mockData';
import { Property, Vehicle } from '../types';

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function PainelBem() {
  const { assetType, id } = useParams();
  const navigate = useNavigate();
  const asset = assetType === 'veiculo' ? getVehicles().find(v => v.id === id) : getProperties().find(p => p.id === id);
  const details = getAssetDetails().find(item => item.assetId === id);
  const allTransactions = getTransactions().filter(t => t.assetId === id && t.nature !== 'caucao_passivo');
  const years = [...new Set(allTransactions.map(t => Number(t.date.slice(0, 4))).filter(Boolean))].sort((a, b) => b - a);
  const [year, setYear] = useState<number | 'all'>(years[0] || new Date().getFullYear());
  const [month, setMonth] = useState('all');
  const transactions = allTransactions.filter(t => (year === 'all' || Number(t.date.slice(0, 4)) === year) && (month === 'all' || t.date.slice(5, 7) === month));
  const purchaseValue = asset?.purchaseValue || 0;
  const financialInvestments = allTransactions.filter(t => t.type === 'despesa' && t.investmentKind === 'investimento').reduce((sum, t) => sum + Math.abs(t.value), 0);
  const invested = purchaseValue + financialInvestments + (details?.improvements || 0);
  const received = allTransactions.filter(t => t.type === 'receita').reduce((sum, t) => sum + Math.abs(t.value), 0);
  const expenses = allTransactions.filter(t => t.type === 'despesa').reduce((sum, t) => sum + Math.abs(t.value), 0);
  const profit = received - expenses;
  const roi = invested > 0 ? profit / invested * 100 : null;
  const recovered = invested > 0 ? received / invested * 100 : null;
  const acquisition = asset?.acquisitionDate ? new Date(`${asset.acquisitionDate}T12:00:00`) : null;
  const elapsedMonths = acquisition && !Number.isNaN(acquisition.getTime()) ? Math.max(1, (new Date().getFullYear() - acquisition.getFullYear()) * 12 + new Date().getMonth() - acquisition.getMonth() + 1) : null;
  const monthlyProfit = elapsedMonths ? profit / elapsedMonths : null;
  const estimatedReturn = monthlyProfit && monthlyProfit > 0 ? Math.max(0, invested - received) / monthlyProfit : null;
  const chart = useMemo(() => {
    let accumulated = 0;
    return Array.from({ length: 12 }, (_, index) => {
      const list = transactions.filter(t => Number(t.date.slice(5, 7)) === index + 1);
      const revenues = list.filter(t => t.type === 'receita').reduce((sum, t) => sum + Math.abs(t.value), 0);
      const costs = list.filter(t => t.type === 'despesa').reduce((sum, t) => sum + Math.abs(t.value), 0);
      const result = revenues - costs;
      accumulated += result;
      return { mes: months[index], Receitas: revenues, Despesas: costs, Lucro: result, Acumulado: accumulated, ROI: invested > 0 ? accumulated / invested * 100 : 0 };
    });
  }, [transactions, invested]);
  if (!asset) return <div className="bg-white border rounded-xl p-8">Bem não encontrado.</div>;
  const isVehicle = assetType === 'veiculo';
  const vehicle = isVehicle ? asset as Vehicle : null;
  const property = !isVehicle ? asset as Property : null;
  const code = asset.code || 'SEM CÓDIGO';
  const name = vehicle?.model || property?.name || '';
  const category = details?.category || vehicle?.kind || property?.type || 'Não informada';
  const tenant = vehicle?.tenant || property?.tenant;
  const timeline = [
    ...(asset.acquisitionDate ? [{ date: asset.acquisitionDate, label: 'Aquisição do bem' }] : []),
    ...(details?.rentalStartDate ? [{ date: details.rentalStartDate, label: `Início da locação${tenant ? ` — ${tenant}` : ''}` }] : []),
    ...allTransactions.map(t => ({ date: t.date, label: `${t.type === 'receita' ? 'Receita' : 'Despesa'} — ${t.description}` })),
    ...(details?.saleDate ? [{ date: details.saleDate, label: 'Venda ou baixa do bem' }] : [])
  ].sort((a, b) => b.date.localeCompare(a.date));
  const metrics: [string, string][] = [
    ['Total investido', brl(invested)], ['Total recebido', brl(received)], ['Total de despesas', brl(expenses)], ['Lucro/déficit', brl(profit)],
    ['ROI', roi === null ? 'Não disponível' : `${roi.toFixed(2)}%`], ['Rentabilidade mensal', monthlyProfit === null ? 'Não disponível' : brl(monthlyProfit)],
    ['Rentabilidade anual', monthlyProfit === null ? 'Não disponível' : brl(monthlyProfit * 12)], ['Investimento recuperado', recovered === null ? 'Não disponível' : `${recovered.toFixed(2)}%`],
    ['Prazo estimado de retorno', estimatedReturn === null ? 'Não disponível' : `${estimatedReturn.toFixed(1)} meses`], ['Lançamentos', String(allTransactions.length)]
  ];
  return <div className="space-y-6 pb-12">
    <header className="flex gap-4 items-center"><img src={asset.image} alt={name} className="w-24 h-20 object-cover rounded-xl bg-gray-100"/><div><h2 className="font-display font-black text-lg">Painel do Bem: {code}</h2><p className={`text-xs font-bold ${profit > 0 ? 'text-green-700' : profit < 0 ? 'text-red-700' : 'text-secondary'}`}>{allTransactions.length === 0 ? 'Sem movimentação' : profit >= 0 ? 'Operação lucrativa' : 'Déficit acumulado'}</p></div></header>
    <section className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">{[['Nome', name], ['Código', code], ['Categoria', category], ['Empresa', isVehicle ? 'LOC MOTTUS' : 'IMÓVEIS'], ['Status', asset.status], ['Aquisição', asset.acquisitionDate || 'Não informada'], ['Valor de compra', brl(purchaseValue)], ['Valor atual', brl(asset.currentValue || 0)], ['Cliente atual', tenant || 'Nenhum'], ['Contrato/documentos', details?.documents || 'Não informado'], ['Valor da locação', brl(vehicle?.rentalValue || property?.rentValue || 0)], ['Frequência', details?.rentalFrequency || 'Não informada']].map(([label, value]) => <div key={label} className="bg-white border border-outline-variant rounded-lg p-4"><p className="text-[9px] uppercase font-bold text-secondary">{label}</p><p className="font-bold text-sm mt-1">{value}</p></div>)}</section>
    <section className="grid sm:grid-cols-2 md:grid-cols-5 gap-4">{metrics.map(([label, value]) => <div key={label} className="bg-white border border-outline-variant rounded-lg p-4"><p className="text-[9px] uppercase font-bold text-secondary">{label}</p><p className="font-bold text-sm mt-1">{value}</p></div>)}</section>
    <div className="flex gap-2 justify-end"><select value={year} onChange={e => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="border rounded px-3 py-2 text-xs"><option value="all">Todos os anos</option>{years.map(item => <option key={item}>{item}</option>)}</select><select value={month} onChange={e => setMonth(e.target.value)} className="border rounded px-3 py-2 text-xs"><option value="all">Todos os meses</option>{months.map((item, index) => <option key={item} value={String(index + 1).padStart(2, '0')}>{item}</option>)}</select></div>
    <section className="grid xl:grid-cols-2 gap-5"><div className="bg-white border rounded-xl p-5"><h3 className="font-bold mb-4">Receitas versus despesas por mês</h3><div className="h-72"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="mes"/><YAxis/><Tooltip formatter={value => brl(Number(value))}/><Legend/><Bar dataKey="Receitas" fill="#ffc300"/><Bar dataKey="Despesas" fill="#293138"/><Bar dataKey="Lucro" fill="#81765f"/></BarChart></ResponsiveContainer></div></div><div className="bg-white border rounded-xl p-5"><h3 className="font-bold mb-4">Lucro acumulado e evolução do ROI</h3><div className="h-72"><ResponsiveContainer><LineChart data={chart}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="mes"/><YAxis/><Tooltip/><Legend/><Line type="monotone" dataKey="Acumulado" stroke="#293138" strokeWidth={3}/><Line type="monotone" dataKey="ROI" stroke="#ffc300" strokeWidth={3}/></LineChart></ResponsiveContainer></div></div></section>
    <section className="bg-white border rounded-xl p-5"><h3 className="font-bold mb-4">Histórico do bem</h3>{timeline.length ? <div className="space-y-3">{timeline.map((event, index) => <div key={`${event.date}-${index}`} className="flex gap-3 text-xs"><span className="font-bold w-24">{event.date}</span><span className="border-l-2 border-primary pl-3">{event.label}</span></div>)}</div> : <p className="text-xs text-secondary">Nenhum evento registrado.</p>}</section>
    <section className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left bg-gray-50"><th className="p-3">Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Status</th><th>Valor</th><th>Ação</th></tr></thead><tbody>{allTransactions.map(t => <tr key={t.id} className="border-t"><td className="p-3">{t.date}</td><td>{t.description}</td><td>{t.category}</td><td>{t.type}</td><td>{t.status}</td><td>{brl(t.value)}</td><td><button onClick={() => navigate(`/fluxo-caixa?edit=${t.id}`)} className="font-bold text-primary">Editar</button></td></tr>)}</tbody></table>{allTransactions.length === 0 && <p className="p-5 text-secondary text-xs">Nenhum lançamento vinculado.</p>}</section>
  </div>;
}
