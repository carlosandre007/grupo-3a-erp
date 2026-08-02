import React,{useEffect,useMemo,useState}from'react';
import{Building2,Landmark,PiggyBank,Plus}from'lucide-react';
import{repository,type EntityRecord}from'../repositories';
import ProtectedRecordActions from'../components/ProtectedRecordActions';
import ManualInvestmentCard from'../components/ManualInvestmentCard';
import Modal from'../components/Modal';
import{createBankProtected}from'../services/adminActions';

type BankRow=EntityRecord&{bank_name?:string;account_name?:string;account_type?:string;current_balance?:number;company_id?:string;responsavel?:string;active?:boolean};
type CompanyRow=EntityRecord&{name?:string};
const brl=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default function Bancos(){
  const[accounts,setAccounts]=useState<BankRow[]>([]);
  const[companies,setCompanies]=useState<CompanyRow[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[version,setVersion]=useState(0);
  const[open,setOpen]=useState(false);
  const[message,setMessage]=useState('');
  const[form,setForm]=useState({name:'',banco:'',responsavel:'',tipo_conta:'',balance:'0',secondary_balance:'0',company_id:'',password:''});
  useEffect(()=>{let active=true;Promise.all([repository.list<BankRow>('bank_accounts'),repository.list<CompanyRow>('companies')]).then(([bankRows,companyRows])=>{if(!active)return;setAccounts(bankRows);setCompanies(companyRows)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Não foi possível carregar as contas.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[version]);
  const companyNames=useMemo(()=>new Map(companies.map(company=>[company.id,company.name||'Empresa não identificada'])),[companies]);
  const visible=accounts.filter(account=>account.active!==false);
  const total=visible.reduce((sum,account)=>sum+Number(account.current_balance||0),0);
  const hasInvestedCurrent=accounts.some(account=>/investido atual/i.test(String(account.account_name??account.name??account.bank_name??'')));
  const openInvestedCurrent=()=>{setMessage('');setForm({name:'Investido Atual',banco:'Investido Atual',responsavel:'',tipo_conta:'Investimento',balance:'0',secondary_balance:'0',company_id:'',password:''});setOpen(true)};
  const create=async(event:React.FormEvent)=>{event.preventDefault();const{password,...bank}=form;try{await createBankProtected({...bank,balance:Number(bank.balance),secondary_balance:Number(bank.secondary_balance)},password);setMessage('');setOpen(false);setForm({name:'',banco:'',responsavel:'',tipo_conta:'',balance:'0',secondary_balance:'0',company_id:'',password:''});setVersion(value=>value+1)}catch(reason){setMessage(reason instanceof Error?reason.message:'Não foi possível criar o banco.')}};
  return <div className="space-y-6">
    <header className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-black">Bancos e Contas</h2><p className="text-xs text-secondary">Contas existentes no Supabase.</p></div><div className="flex flex-wrap justify-end gap-2">{!hasInvestedCurrent&&<button onClick={openInvestedCurrent} className="flex items-center gap-2 rounded border border-primary px-4 py-2 text-xs font-black text-primary"><PiggyBank className="h-4 w-4"/> CRIAR INVESTIDO ATUAL</button>}<button onClick={()=>setOpen(true)} className="flex items-center gap-2 rounded bg-primary-container px-4 py-2 text-xs font-black"><Plus className="h-4 w-4"/> CRIAR BANCO</button></div></header>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border bg-white p-5"><small>Saldo consolidado</small><b className="block text-xl">{brl(total)}</b></article>
      <article className="rounded-xl border bg-white p-5"><small>Contas</small><b className="block text-xl">{accounts.length}</b></article>
      <article className="rounded-xl border bg-white p-5"><small>Contas ativas</small><b className="block text-xl">{visible.length}</b></article>
      <ManualInvestmentCard onChanged={()=>setVersion(value=>value+1)}/>
    </section>
    {loading&&<p className="rounded-xl border bg-white p-6 text-xs">Carregando contas...</p>}
    {error&&<p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>}
    {!loading&&!error&&accounts.length===0&&<p className="rounded-xl border bg-white p-6 text-xs text-secondary">Nenhum registro.</p>}
    <section className="grid gap-4 md:grid-cols-2">{accounts.map(account=><article key={account.id} className="rounded-xl border bg-white p-5 custom-shadow">
      <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><Landmark className="mt-1 h-5 w-5 text-primary"/><div><b>{account.bank_name||'Banco não informado'} — {account.account_name||'Conta sem nome'}</b><p className="text-xs text-secondary">{account.account_type||'Tipo não informado'}</p></div></div><b>{brl(Number(account.current_balance||0))}</b></div>
      <div className="mt-4 flex items-center gap-2 border-t pt-3 text-xs text-secondary"><Building2 className="h-4 w-4"/><span>{companyNames.get(String(account.company_id||''))||'Empresa não vinculada'}</span>{account.responsavel&&<span>· {account.responsavel}</span>}</div>
      <div className="mt-3 flex justify-end"><ProtectedRecordActions table="banks" record={account} fields={[{key:'name',label:'Nome'},{key:'banco',label:'Banco'},{key:'responsavel',label:'Responsável'},{key:'balance',label:'Saldo',type:'number'}]} onChanged={()=>setVersion(value=>value+1)}/></div>
    </article>)}</section>
    <Modal isOpen={open} onClose={()=>setOpen(false)} title="Criar banco"><form onSubmit={create} className="grid gap-3 sm:grid-cols-2"><input value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="Nome da conta" className="rounded border p-2 text-xs" required/><input value={form.banco} onChange={event=>setForm({...form,banco:event.target.value})} placeholder="Banco" className="rounded border p-2 text-xs" required/><input value={form.responsavel} onChange={event=>setForm({...form,responsavel:event.target.value})} placeholder="Responsável" className="rounded border p-2 text-xs"/><input value={form.tipo_conta} onChange={event=>setForm({...form,tipo_conta:event.target.value})} placeholder="Tipo da conta" className="rounded border p-2 text-xs"/><input type="number" step="0.01" value={form.balance} onChange={event=>setForm({...form,balance:event.target.value})} placeholder="Saldo" className="rounded border p-2 text-xs"/><input type="number" step="0.01" value={form.secondary_balance} onChange={event=>setForm({...form,secondary_balance:event.target.value})} placeholder="Saldo secundário" className="rounded border p-2 text-xs"/><select value={form.company_id} onChange={event=>setForm({...form,company_id:event.target.value})} className="rounded border p-2 text-xs sm:col-span-2"><option value="">Sem empresa vinculada</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name||company.id}</option>)}</select><input type="password" value={form.password} onChange={event=>setForm({...form,password:event.target.value})} placeholder="Senha administrativa" className="rounded border p-2 text-xs sm:col-span-2" required/>{message&&<p className="text-xs sm:col-span-2">{message}</p>}<button className="rounded bg-black p-3 text-xs font-bold text-white sm:col-span-2">VALIDAR E CRIAR</button></form></Modal>
  </div>;
}
