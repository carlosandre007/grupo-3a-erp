import React,{useEffect,useMemo,useState}from'react';
import{Building,ExternalLink,Mail,Phone,Search,User,Users}from'lucide-react';
import{useNavigate}from'react-router-dom';
import{repository,type EntityRecord}from'../repositories';

type ClientRow=EntityRecord&{name?:string;email?:string;phone?:string;document?:string;person_type?:string;address?:string;company_id?:string};
type CompanyRow=EntityRecord&{name?:string};
export default function Clientes(){
  const navigate=useNavigate();
  const[clients,setClients]=useState<ClientRow[]>([]);
  const[companies,setCompanies]=useState<CompanyRow[]>([]);
  const[search,setSearch]=useState('');
  const[type,setType]=useState('Todos');
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  useEffect(()=>{let active=true;Promise.all([repository.list<ClientRow>('clients'),repository.list<CompanyRow>('companies')]).then(([clientRows,companyRows])=>{if(!active)return;setClients(clientRows);setCompanies(companyRows)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Não foi possível carregar os clientes.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  const companyNames=useMemo(()=>new Map(companies.map(company=>[company.id,company.name||''])),[companies]);
  const visible=clients.filter(client=>(type==='Todos'||client.person_type===type)&&(!search.trim()||[client.name,client.email,client.document,client.phone].some(value=>String(value||'').toLowerCase().includes(search.trim().toLowerCase()))));
  return <div className="space-y-6">
    <header><h2 className="font-display text-lg font-black">Clientes</h2><p className="text-xs text-secondary">Consulta somente leitura dos clientes existentes no Supabase.</p></header>
    <section className="grid gap-4 md:grid-cols-3"><article className="rounded-xl border bg-white p-5"><Users className="h-5 w-5"/><small className="block">Total</small><b className="text-xl">{clients.length}</b></article><article className="rounded-xl border bg-white p-5"><User className="h-5 w-5"/><small className="block">Pessoa física</small><b className="text-xl">{clients.filter(client=>client.person_type==='PF').length}</b></article><article className="rounded-xl border bg-white p-5"><Building className="h-5 w-5"/><small className="block">Pessoa jurídica</small><b className="text-xl">{clients.filter(client=>client.person_type==='PJ').length}</b></article></section>
    <section className="flex flex-wrap gap-3 rounded-xl border bg-white p-4"><label className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar cliente" className="w-full rounded border py-2 pl-9 pr-3 text-xs"/></label><select value={type} onChange={event=>setType(event.target.value)} className="rounded border p-2 text-xs"><option>Todos</option><option>PF</option><option>PJ</option></select></section>
    {loading&&<p className="rounded-xl border bg-white p-6 text-xs">Carregando clientes...</p>}{error&&<p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>}{!loading&&!error&&visible.length===0&&<p className="rounded-xl border bg-white p-6 text-xs text-secondary">Nenhum registro.</p>}
    <section className="grid gap-4 md:grid-cols-2">{visible.map(client=><article key={client.id} className="rounded-xl border bg-white p-5 custom-shadow"><div className="flex justify-between gap-3"><div><b>{client.name||'Cliente sem nome'}</b><p className="text-xs text-secondary">{client.person_type||'Tipo não informado'} · {client.document||'Documento não informado'}</p></div><button onClick={()=>navigate(`/clientes/${client.id}`)} title="Ver detalhes"><ExternalLink className="h-4 w-4"/></button></div><div className="mt-4 space-y-1 text-xs">{client.email&&<p><Mail className="mr-2 inline h-4 w-4"/>{client.email}</p>}{client.phone&&<p><Phone className="mr-2 inline h-4 w-4"/>{client.phone}</p>}<p><Building className="mr-2 inline h-4 w-4"/>{companyNames.get(String(client.company_id||''))||'Empresa não vinculada'}</p></div></article>)}</section>
  </div>;
}
