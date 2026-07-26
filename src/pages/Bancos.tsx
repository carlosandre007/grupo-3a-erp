import React,{useEffect,useMemo,useState}from'react';
import{Building2,Landmark}from'lucide-react';
import{repository,type EntityRecord}from'../repositories';

type BankRow=EntityRecord&{bank_name?:string;account_name?:string;account_type?:string;current_balance?:number;company_id?:string;responsavel?:string;active?:boolean};
type CompanyRow=EntityRecord&{name?:string};
const brl=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default function Bancos(){
  const[accounts,setAccounts]=useState<BankRow[]>([]);
  const[companies,setCompanies]=useState<CompanyRow[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  useEffect(()=>{let active=true;Promise.all([repository.list<BankRow>('bank_accounts'),repository.list<CompanyRow>('companies')]).then(([bankRows,companyRows])=>{if(!active)return;setAccounts(bankRows);setCompanies(companyRows)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Não foi possível carregar as contas.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  const companyNames=useMemo(()=>new Map(companies.map(company=>[company.id,company.name||'Empresa não identificada'])),[companies]);
  const visible=accounts.filter(account=>account.active!==false);
  const total=visible.reduce((sum,account)=>sum+Number(account.current_balance||0),0);
  return <div className="space-y-6">
    <header><h2 className="font-display text-lg font-black">Bancos e Contas</h2><p className="text-xs text-secondary">Consulta somente leitura das contas existentes no Supabase.</p></header>
    <section className="grid gap-4 md:grid-cols-3">
      <article className="rounded-xl border bg-white p-5"><small>Saldo consolidado</small><b className="block text-xl">{brl(total)}</b></article>
      <article className="rounded-xl border bg-white p-5"><small>Contas</small><b className="block text-xl">{accounts.length}</b></article>
      <article className="rounded-xl border bg-white p-5"><small>Contas ativas</small><b className="block text-xl">{visible.length}</b></article>
    </section>
    {loading&&<p className="rounded-xl border bg-white p-6 text-xs">Carregando contas...</p>}
    {error&&<p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>}
    {!loading&&!error&&accounts.length===0&&<p className="rounded-xl border bg-white p-6 text-xs text-secondary">Nenhum registro.</p>}
    <section className="grid gap-4 md:grid-cols-2">{accounts.map(account=><article key={account.id} className="rounded-xl border bg-white p-5 custom-shadow">
      <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><Landmark className="mt-1 h-5 w-5 text-primary"/><div><b>{account.bank_name||'Banco não informado'} — {account.account_name||'Conta sem nome'}</b><p className="text-xs text-secondary">{account.account_type||'Tipo não informado'}</p></div></div><b>{brl(Number(account.current_balance||0))}</b></div>
      <div className="mt-4 flex items-center gap-2 border-t pt-3 text-xs text-secondary"><Building2 className="h-4 w-4"/><span>{companyNames.get(String(account.company_id||''))||'Empresa não vinculada'}</span>{account.responsavel&&<span>· {account.responsavel}</span>}</div>
    </article>)}</section>
  </div>;
}
