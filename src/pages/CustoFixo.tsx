import React,{useEffect,useMemo,useState}from'react';
import{repository,type EntityRecord}from'../repositories';

type CostRow=EntityRecord&{description?:string;value?:number;next_due_date?:string;due_date?:string;status?:string;active?:boolean;frequency?:string;company_id?:string;company?:string;category_id?:string;category?:string};
type TransactionRow=EntityRecord&{transaction_date?:string;reference_id?:string;referencia_id?:string;source_module?:string;status?:string};
type NamedRow=EntityRecord&{name?:string};
const brl=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const paid=(status:unknown)=>['paid','pago','confirmed'].includes(String(status??'').toLowerCase());

export default function CustoFixo(){
  const[costs,setCosts]=useState<CostRow[]>([]);
  const[companies,setCompanies]=useState<NamedRow[]>([]);
  const[categories,setCategories]=useState<NamedRow[]>([]);
  const[transactions,setTransactions]=useState<TransactionRow[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  useEffect(()=>{let active=true;Promise.all([repository.list<CostRow>('fixed_costs'),repository.list<NamedRow>('companies'),repository.list<NamedRow>('categories'),repository.list<TransactionRow>('transactions')]).then(([costRows,companyRows,categoryRows,transactionRows])=>{if(!active)return;setCosts(costRows);setCompanies(companyRows);setCategories(categoryRows);setTransactions(transactionRows)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Não foi possível carregar os custos fixos.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  const companyNames=useMemo(()=>new Map(companies.map(item=>[item.id,item.name||''])),[companies]);
  const categoryNames=useMemo(()=>new Map(categories.map(item=>[item.id,item.name||''])),[categories]);
  const active=costs.filter(cost=>cost.active!==false);
  const total=active.reduce((sum,cost)=>sum+Number(cost.value||0),0);
  const totalPaid=active.filter(cost=>paid(cost.status)).reduce((sum,cost)=>sum+Number(cost.value||0),0);
  const next=active.map(cost=>String(cost.next_due_date||cost.due_date||'')).filter(Boolean).sort()[0];
  const currentMonth=new Date().toISOString().slice(0,7);
  const paidThisMonth=(id:string)=>transactions.some(transaction=>(transaction.reference_id===id||transaction.referencia_id===id)&&String(transaction.transaction_date||'').startsWith(currentMonth)&&transaction.status==='pago');
  return <div className="space-y-6">
    <header><h2 className="font-display text-lg font-black">Custos Fixos</h2><p className="text-xs text-secondary">Consulta somente leitura dos custos cadastrados no Supabase.</p></header>
    <section className="grid gap-4 md:grid-cols-4">
      <article className="rounded-xl border bg-white p-5"><small>Total cadastrado</small><b className="block">{brl(total)}</b></article>
      <article className="rounded-xl border bg-white p-5"><small>Pago</small><b className="block">{brl(totalPaid)}</b></article>
      <article className="rounded-xl border bg-white p-5"><small>Pendente</small><b className="block">{brl(total-totalPaid)}</b></article>
      <article className="rounded-xl border bg-white p-5"><small>Próximo vencimento</small><b className="block">{next||'Nenhum registro'}</b></article>
    </section>
    {loading&&<p className="rounded-xl border bg-white p-6 text-xs">Carregando custos...</p>}
    {error&&<p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>}
    {!loading&&!error&&costs.length===0&&<p className="rounded-xl border bg-white p-6 text-xs text-secondary">Nenhum registro.</p>}
    <section className="space-y-3">{costs.map(cost=><article key={cost.id} className="rounded-xl border bg-white p-5">
      <div className="flex justify-between gap-4"><div><b>{cost.description||'Custo sem descrição'}</b><p className="text-xs text-secondary">{companyNames.get(String(cost.company_id||''))||cost.company||'Empresa não vinculada'} · {categoryNames.get(String(cost.category_id||''))||cost.category||'Categoria não vinculada'}</p><p className="mt-1 text-xs">Vencimento: {cost.next_due_date||cost.due_date||'Não informado'} · {cost.frequency||'Recorrência não informada'} · {cost.status||'Status não informado'}</p></div><b>{brl(Number(cost.value||0))}</b></div><div className="mt-3"><button disabled className={`rounded border px-3 py-2 text-xs font-bold ${paidThisMonth(cost.id)?'border-green-300 bg-green-50 text-green-800':'opacity-40'}`} title={paidThisMonth(cost.id)?'Pagamento já localizado no mês atual.':'Pagamento bloqueado até existir autorização server-side e chave lógica compatível.'}>{paidThisMonth(cost.id)?'PAGO NO MÊS ATUAL':'PAGO NO MÊS ATUAL'}</button></div>
    </article>)}</section>
  </div>;
}
