import React from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getBankAccounts, getAccountBalance, getCharges, getClients, getFixedCosts, getProperties, getVehicles } from '../mockData';

export type ActiveAlert = { id: string; type: string; name: string; description: string; due: string; company: string; status: string; priority: 'alta' | 'média' | 'baixa'; route: string };
const today = () => new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00');
const daysUntil = (date?: string) => date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Math.ceil((new Date(`${date}T12:00:00`).getTime() - today().getTime()) / 86400000) : null;
const dueState = (date: string) => { const days = daysUntil(date); return days !== null && days < 0 ? 'vencido' : days === 0 ? 'vence hoje' : `vence em ${days} dia(s)`; };

export function getActiveAlerts(): ActiveAlert[] {
  const alerts: ActiveAlert[] = [];
  getClients().forEach(client => { const days = daysUntil(client.cnhExpiry); if (client.cnhExpiry && days !== null && days <= 15) alerts.push({ id: `cnh-${client.id}`, type: 'CNH', name: client.name, description: `CNH ${client.cnhNumber || 'sem número informado'}`, due: client.cnhExpiry, company: 'GRUPO 3A', status: dueState(client.cnhExpiry), priority: days < 0 ? 'alta' : 'média', route: `/clientes?edit=${client.id}` }); });
  getCharges().forEach(charge => { const days = daysUntil(charge.dueDate); if (charge.status !== 'pago' && days !== null && days < 0) alerts.push({ id: `charge-${charge.id}`, type: 'Cobrança', name: charge.client, description: charge.description, due: charge.dueDate, company: charge.company, status: 'vencida', priority: 'alta', route: `/calendario-cobranca?charge=${charge.id}` }); });
  getFixedCosts().forEach(cost => { const days = daysUntil(cost.nextDueDate); if (cost.active && days !== null && days <= 7) alerts.push({ id: `fixed-${cost.id}`, type: 'Custo fixo', name: cost.description, description: cost.category, due: cost.nextDueDate, company: cost.company, status: dueState(cost.nextDueDate), priority: days < 0 ? 'alta' : 'média', route: `/custo-fixo?edit=${cost.id}` }); });
  getVehicles().forEach(vehicle => {
    ([['IPVA', vehicle.ipvaDueDate], ['Licenciamento', vehicle.licensingDueDate]] as const).forEach(([type, date]) => { const days = daysUntil(date); if (date && days !== null && days <= 30) alerts.push({ id: `${type}-${vehicle.id}`, type, name: `${vehicle.code || 'Sem código'} — ${vehicle.model}`, description: vehicle.plate, due: date, company: 'LOC MOTTUS', status: dueState(date), priority: days < 0 ? 'alta' : days <= 15 ? 'média' : 'baixa', route: `/veiculos?edit=${vehicle.id}` }); });
  });
  getProperties().forEach(property => {
    ([['Reajuste anual', property.annualAdjustmentDate], ['Contrato', property.contractEndDate]] as const).forEach(([type, date]) => { const days = daysUntil(date); if (date && days !== null && days <= 30) alerts.push({ id: `${type}-${property.id}`, type, name: `${property.code || 'Sem código'} — ${property.name}`, description: property.address, due: date, company: 'IMÓVEIS', status: dueState(date), priority: days < 0 ? 'alta' : days <= 15 ? 'média' : 'baixa', route: `/imoveis?edit=${property.id}` }); });
  });
  getBankAccounts().filter(account => account.active && getAccountBalance(account.id) < 0).forEach(account => alerts.push({ id: `bank-${account.id}`, type: 'Saldo bancário baixo', name: account.accountName, description: account.bankName, due: 'Imediato', company: account.company, status: 'saldo negativo', priority: 'alta', route: `/bancos?account=${account.id}` }));
  return alerts.sort((a, b) => ({ alta: 0, média: 1, baixa: 2 }[a.priority] - { alta: 0, média: 1, baixa: 2 }[b.priority]));
}

export default function AlertsPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate(); const alerts = getActiveAlerts();
  return <><div className="fixed inset-0 z-[80] bg-black/40" onClick={onClose}/><aside className="fixed right-0 top-0 z-[90] h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl"><header className="sticky top-0 flex items-center justify-between border-b bg-white p-5"><div className="flex items-center gap-2"><AlertTriangle className="w-5 text-amber-600"/><h2 className="font-black">Alertas ativos</h2></div><button onClick={onClose} aria-label="Fechar alertas"><X/></button></header><div className="space-y-3 p-5">{!alerts.length && <p className="text-sm text-secondary">Nenhuma pendência ativa.</p>}{alerts.slice(0, 8).map(alert => <article key={alert.id} className="rounded-lg border p-4 text-xs"><div className="flex justify-between"><b>{alert.type}</b><span className="uppercase">{alert.priority}</span></div><p className="mt-2 font-bold">{alert.name}</p><p>{alert.status} · {alert.company}</p><button onClick={() => { navigate(`/alertas?tipo=${encodeURIComponent(alert.type)}`); onClose(); }} className="mt-3 flex items-center gap-1 font-bold text-primary"><ExternalLink className="w-4"/> Ver registros</button></article>)}<button onClick={() => { navigate('/alertas'); onClose(); }} className="w-full rounded bg-primary-container p-3 font-black">ABRIR CENTRAL DE ALERTAS</button></div></aside></>;
}
