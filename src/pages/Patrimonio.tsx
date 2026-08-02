import React,{useEffect,useState}from'react';
import{Bike,Building2}from'lucide-react';
import{useNavigate}from'react-router-dom';
import{repository,type EntityRecord}from'../repositories';
import ProtectedRecordActions from'../components/ProtectedRecordActions';

type AssetRow=EntityRecord&{code?:string;name?:string;description?:string;model?:string;plate?:string;status?:string;purchase_value?:number;current_value?:number};
const brl=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function Patrimonio(){
  const navigate=useNavigate();
  const[properties,setProperties]=useState<AssetRow[]>([]);
  const[vehicles,setVehicles]=useState<AssetRow[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[version,setVersion]=useState(0);
  useEffect(()=>{let active=true;Promise.all([repository.list<AssetRow>('properties'),repository.list<AssetRow>('vehicles')]).then(([propertyRows,vehicleRows])=>{if(!active)return;setProperties(propertyRows);setVehicles(vehicleRows)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Não foi possível carregar o patrimônio.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[version]);
  const assets=[...properties.map(asset=>({...asset,kind:'imovel' as const})),...vehicles.map(asset=>({...asset,kind:'veiculo' as const}))];
  const purchase=assets.reduce((sum,asset)=>sum+Number(asset.purchase_value||0),0);
  const current=assets.reduce((sum,asset)=>sum+Number(asset.current_value||asset.purchase_value||0),0);
  return <div className="space-y-6">
    <header><h2 className="font-display text-lg font-black">Patrimônio</h2><p className="text-xs text-secondary">Consolidação somente leitura de imóveis e motocicletas existentes.</p></header>
    <section className="grid gap-4 md:grid-cols-4"><article className="rounded-xl border bg-white p-5"><small>Bens</small><b className="block text-xl">{assets.length}</b></article><article className="rounded-xl border bg-white p-5"><small>Imóveis</small><b className="block text-xl">{properties.length}</b></article><article className="rounded-xl border bg-white p-5"><small>Motocicletas</small><b className="block text-xl">{vehicles.length}</b></article><article className="rounded-xl border bg-white p-5"><small>Valor atual</small><b className="block">{brl(current)}</b><small>Aquisição: {brl(purchase)}</small></article></section>
    {loading&&<p className="rounded-xl border bg-white p-6 text-xs">Carregando patrimônio...</p>}{error&&<p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>}{!loading&&!error&&assets.length===0&&<p className="rounded-xl border bg-white p-6 text-xs text-secondary">Nenhum registro.</p>}
    <section className="grid gap-4 md:grid-cols-2">{assets.map(asset=><article key={`${asset.kind}-${asset.id}`} onClick={()=>navigate(`/bens/${asset.kind}/${asset.id}`)} className="cursor-pointer rounded-xl border bg-white p-5 custom-shadow"><div className="flex justify-between"><div><b>{asset.name||asset.model||asset.description||'Bem sem nome'} {asset.code&&<span className="text-primary">{asset.code}</span>}</b><p className="text-xs text-secondary">{asset.kind==='veiculo'?(asset.plate||'Placa não informada'):'Imóvel'} · {asset.status||'Status não informado'}</p></div><div className="flex items-start gap-2">{asset.kind==='veiculo'?<Bike className="h-5 w-5"/>:<Building2 className="h-5 w-5"/>}<ProtectedRecordActions table={asset.kind==='veiculo'?'motorcycles':'properties'} record={asset} fields={asset.kind==='veiculo'?[{key:'description',label:'Descrição'},{key:'status',label:'Status'},{key:'valor_atual',label:'Valor atual',type:'number'}]:[{key:'description',label:'Descrição'},{key:'address',label:'Endereço'},{key:'status',label:'Status'},{key:'valor_atual',label:'Valor atual',type:'number'}]} onChanged={()=>setVersion(value=>value+1)}/></div></div><p className="mt-3 text-xs">Valor atual: <b>{brl(Number(asset.current_value||asset.purchase_value||0))}</b></p></article>)}</section>
  </div>;
}
