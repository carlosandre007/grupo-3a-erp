import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
export default function AcessoNegado(){const{signOut}=useAuth(),location=useLocation();const reason=(location.state as{reason?:string}|null)?.reason;return <main className="min-h-screen grid place-items-center bg-background p-4"><section className="max-w-md rounded-xl border bg-white p-8 text-center"><h1 className="font-display text-xl font-black">Acesso negado</h1><p className="mt-2 text-sm text-secondary">{reason||'Seu perfil não possui permissão para esta área.'}</p><button onClick={()=>void signOut()} className="mt-5 rounded bg-primary-container px-5 py-3 text-xs font-black">ENCERRAR SESSÃO</button></section></main>}
