import React,{useEffect,useMemo,useState}from'react';
import{Bike,Search}from'lucide-react';
import{useNavigate}from'react-router-dom';
import{repository,type EntityRecord}from'../repositories';

type VehicleRow=EntityRecord&{code?:string;model?:string;description?:string;plate?:string;status?:string;tenant?:string;rental_value?:number;purchase_value?:number;current_value?:number};
const brl=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function Veiculos(){
  const navigate=useNavigate();
  const[vehicles,setVehicles]=useState<VehicleRow[]>([]);
  const[search,setSearch]=useState('');
  const[status,setStatus]=useState('todos');
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  useEffect(()=>{let active=true;repository.list<VehicleRow>('vehicles').then(rows=>{if(active)setVehicles(rows)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Não foi possível carregar os veículos.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  const visible=vehicles.filter(vehicle=>(status==='todos'||vehicle.status===status)&&(!search.trim()||[vehicle.model,vehicle.description,vehicle.plate,vehicle.code,vehicle.tenant].some(value=>String(value||'').toLowerCase().includes(search.trim().toLowerCase()))));
  const metrics=useMemo(()=>({rented:vehicles.filter(vehicle=>vehicle.status==='locado').length,available:vehicles.filter(vehicle=>vehicle.status==='disponivel').length,revenue:vehicles.reduce((sum,vehicle)=>sum+Number(vehicle.rental_value||0),0)}),[vehicles]);
  return <div className="space-y-6"><header><h2 className="font-display text-lg font-black">LOC MOTTUS — Frota</h2><p className="text-xs text-secondary">Consulta somente leitura das motocicletas existentes.</p></header>
    <section className="grid gap-4 md:grid-cols-4"><article className="rounded-xl border bg-white p-5"><Bike/><small className="block">Motocicletas</small><b>{vehicles.length}</b></article><article className="rounded-xl border bg-white p-5"><small>Locadas</small><b>{metrics.rented}</b></article><article className="rounded-xl border bg-white p-5"><small>Disponíveis</small><b>{metrics.available}</b></article><article className="rounded-xl border bg-white p-5"><small>Locação cadastrada</small><b>{brl(metrics.revenue)}</b></article></section>
    <section className="flex gap-3 rounded-xl border bg-white p-4"><label className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar modelo, placa ou código" className="w-full rounded border py-2 pl-9 pr-3 text-xs"/></label><select value={status} onChange={event=>setStatus(event.target.value)} className="rounded border p-2 text-xs"><option value="todos">Todos</option><option value="locado">Locadas</option><option value="disponivel">Disponíveis</option><option value="manutencao">Manutenção</option></select></section>
    {loading&&<p className="rounded-xl border bg-white p-6 text-xs">Carregando motocicletas...</p>}{error&&<p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>}{!loading&&!error&&visible.length===0&&<p className="rounded-xl border bg-white p-6 text-xs text-secondary">Nenhum registro.</p>}
    <section className="grid gap-4 md:grid-cols-2">{visible.map(vehicle=><article key={vehicle.id} onClick={()=>navigate(`/bens/veiculo/${vehicle.id}`)} className="cursor-pointer rounded-xl border bg-white p-5 custom-shadow"><div className="flex justify-between"><div><b>{vehicle.model||vehicle.description||'Veículo sem modelo'} {vehicle.code&&<span className="text-primary">{vehicle.code}</span>}</b><p className="text-xs text-secondary">{vehicle.plate||'Placa não informada'}</p></div><Bike className="h-5 w-5"/></div><div className="mt-4 flex justify-between text-xs"><span>{vehicle.status||'Status não informado'}</span><b>{brl(Number(vehicle.rental_value||0))}</b></div>{vehicle.tenant&&<p className="mt-2 text-xs">Locatário: {vehicle.tenant}</p>}</article>)}</section>
  </div>;
}
