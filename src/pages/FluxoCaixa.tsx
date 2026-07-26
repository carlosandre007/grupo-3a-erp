import React,{useEffect,useMemo,useState}from'react';
import{Search}from'lucide-react';
import{repository,type EntityRecord}from'../repositories';

type TransactionRow=EntityRecord&{transaction_date?:string;description?:string;value?:number;type?:string;status?:string;company_id?:string;category_id?:string;bank_account_id?:string};
type NamedRow=EntityRecord&{name?:string};
const brl=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function allTransactions(){
  if(!repository.listPage)return repository.list<TransactionRow>('transactions');
  const rows:TransactionRow[]=[];
  for(let offset=0;;offset+=1000){
    const page=await repository.listPage<TransactionRow>('transactions',offset,1000,'transaction_date',false);
    rows.push(...page.records);
    if(rows.length>=page.total||page.records.length<1000)break;
  }
  return rows;
}
export default function FluxoCaixa(){
  const[transactions,setTransactions]=useState<TransactionRow[]>([]);
  const[companies,setCompanies]=useState<NamedRow[]>([]);
  const[categories,setCategories]=useState<NamedRow[]>([]);
  const[search,setSearch]=useState('');
  const[type,setType]=useState('todos');
  const[status,setStatus]=useState('todos');
  const[company,setCompany]=useState('todas');
  const[start,setStart]=useState('');
  const[end,setEnd]=useState('');
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  useEffect(()=>{let active=true;Promise.all([allTransactions(),repository.list<NamedRow>('companies'),repository.list<NamedRow>('categories')]).then(([rows,companyRows,categoryRows])=>{if(!active)return;setTransactions(rows);setCompanies(companyRows);setCategories(categoryRows)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Não foi possível carregar o fluxo de caixa.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  const companyNames=useMemo(()=>new Map(companies.map(item=>[item.id,item.name||''])),[companies]);
  const categoryNames=useMemo(()=>new Map(categories.map(item=>[item.id,item.name||''])),[categories]);
  const visible=transactions.filter(transaction=>{
    const date=String(transaction.transaction_date||'');
    const term=search.trim().toLowerCase();
    return(type==='todos'||transaction.type===type)&&(status==='todos'||transaction.status===status)&&(company==='todas'||transaction.company_id===company)&&(!start||date>=start)&&(!end||date<=end)&&(!term||[transaction.description,companyNames.get(String(transaction.company_id||'')),categoryNames.get(String(transaction.category_id||''))].some(value=>String(value||'').toLowerCase().includes(term)));
  });
  const revenues=visible.filter(item=>item.type==='receita'&&item.status==='pago').reduce((sum,item)=>sum+Math.abs(Number(item.value||0)),0);
  const expenses=visible.filter(item=>item.type==='despesa'&&item.status==='pago').reduce((sum,item)=>sum+Math.abs(Number(item.value||0)),0);
  return <div className="space-y-6">
    <header><h2 className="font-display text-lg font-black">Fluxo de Caixa</h2><p className="text-xs text-secondary">Todas as transações do Supabase, carregadas com paginação completa.</p></header>
    <section className="grid gap-4 md:grid-cols-4"><article className="rounded-xl border bg-white p-5"><small>Registros</small><b className="block text-xl">{visible.length}</b></article><article className="rounded-xl border bg-white p-5"><small>Receitas pagas</small><b className="block">{brl(revenues)}</b></article><article className="rounded-xl border bg-white p-5"><small>Despesas pagas</small><b className="block">{brl(expenses)}</b></article><article className="rounded-xl border bg-white p-5"><small>Resultado</small><b className="block">{brl(revenues-expenses)}</b></article></section>
    <section className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6"><label className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar lançamento" className="w-full rounded border py-2 pl-9 pr-3 text-xs"/></label><select value={type} onChange={event=>setType(event.target.value)} className="rounded border p-2 text-xs"><option value="todos">Receitas e despesas</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select><select value={status} onChange={event=>setStatus(event.target.value)} className="rounded border p-2 text-xs"><option value="todos">Todos os status</option><option value="pago">Pago</option><option value="pendente">Pendente</option><option value="atrasado">Atrasado</option></select><select value={company} onChange={event=>setCompany(event.target.value)} className="rounded border p-2 text-xs"><option value="todas">Todas as empresas</option>{companies.map(item=><option key={item.id} value={item.id}>{item.name||item.id}</option>)}</select><div className="flex gap-1"><input type="date" value={start} onChange={event=>setStart(event.target.value)} className="min-w-0 rounded border p-2 text-xs"/><input type="date" value={end} onChange={event=>setEnd(event.target.value)} className="min-w-0 rounded border p-2 text-xs"/></div></section>
    {loading&&<p className="rounded-xl border bg-white p-6 text-xs">Carregando lançamentos...</p>}{error&&<p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>}{!loading&&!error&&visible.length===0&&<p className="rounded-xl border bg-white p-6 text-xs text-secondary">Nenhum registro.</p>}
    <section className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[850px] text-left text-xs"><thead><tr className="border-b bg-gray-50"><th className="p-3">Data</th><th>Descrição</th><th>Empresa</th><th>Categoria</th><th>Tipo</th><th>Status</th><th className="pr-3 text-right">Valor</th></tr></thead><tbody>{visible.map(item=><tr key={item.id} className="border-b last:border-0"><td className="p-3">{item.transaction_date||'—'}</td><td>{item.description||'Sem descrição'}</td><td>{companyNames.get(String(item.company_id||''))||'Não vinculada'}</td><td>{categoryNames.get(String(item.category_id||''))||'Não vinculada'}</td><td>{item.type||'Não informado'}</td><td>{item.status||'Não informado'}</td><td className="pr-3 text-right font-bold">{brl(Number(item.value||0))}</td></tr>)}</tbody></table></section>
  </div>;
}
