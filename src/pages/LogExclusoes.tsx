import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { validateOwnerPassword } from '../services/adminValidation';
import { getDeletionLogs } from '../mockData';

export default function LogExclusoes() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Acesso exclusivo do proprietário. Informe a senha para continuar.');
  const [unlocked, setUnlocked] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const result = await validateOwnerPassword(password); setPassword(''); setMessage(result.message); setUnlocked(result.valid); };
  if (unlocked) { const logs = getDeletionLogs(); return <div className="space-y-4"><div><h2 className="font-display font-black text-lg">Log de Exclusões</h2><p className="text-xs text-secondary">Auditoria somente leitura.</p></div>{logs.length===0&&<div className="bg-white border rounded-xl p-6 text-xs text-secondary">Nenhuma exclusão registrada.</div>}{logs.map(log=><article key={log.id} className="bg-white border rounded-xl p-4 text-xs"><div className="flex justify-between"><b>{log.description}</b><span>{new Date(log.deletedAt).toLocaleString('pt-BR')}</span></div><p className="text-secondary mt-2">{log.recordType} · {log.company} · {log.category||'Sem categoria'} · {log.recordDate||'Sem data'} · {log.recordValue!==undefined?`R$ ${Math.abs(log.recordValue).toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'Sem valor'}</p><p className="mt-1">Motivo: {log.reason} · Usuário: {log.responsibleUser}</p></article>)}</div>; }
  return <div className="max-w-md mx-auto mt-16 bg-white border border-outline-variant rounded-xl p-8 custom-shadow text-center">
    <Lock className="w-10 h-10 mx-auto text-primary mb-4"/><h2 className="font-display font-black text-lg">Log de Exclusões</h2>
    <p className="text-xs text-secondary mt-2 mb-6">{message}</p>
    <form onSubmit={submit} className="space-y-3"><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha exclusiva do proprietário" className="w-full border border-outline-variant rounded p-3 text-xs"/><button className="w-full bg-primary text-white rounded p-3 text-xs font-bold uppercase">Validar acesso</button></form>
  </div>;
}
