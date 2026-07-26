import React,{useEffect,useState}from'react';
import{useParams}from'react-router-dom';
import{repository,type EntityRecord}from'../repositories';

type AssetRow=EntityRecord&{code?:string;name?:string;description?:string;model?:string;plate?:string;status?:string;address?:string;tenant?:string;purchase_value?:number;current_value?:number;acquisition_date?:string};
const brl=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function PainelBem(){
  const{assetType,id}=useParams();
  const[asset,setAsset]=useState<AssetRow|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  useEffect(()=>{if(!id){setLoading(false);return}const module=assetType==='veiculo'?'vehicles':'properties';repository.find<AssetRow>(module,id).then(setAsset).catch(reason=>setError(reason instanceof Error?reason.message:'Não foi possível carregar o bem.')).finally(()=>setLoading(false))},[assetType,id]);
  if(loading)return <div className="rounded-xl border bg-white p-6">Carregando bem...</div>;
  if(error)return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;
  if(!asset)return <div className="rounded-xl border bg-white p-6">Bem não encontrado.</div>;
  return <div className="space-y-5 rounded-xl border bg-white p-6 custom-shadow"><header><h2 className="font-display text-lg font-black">{asset.name||asset.model||asset.description||'Bem sem nome'}</h2><p className="text-xs text-secondary">{asset.code||'Código não informado'} · {asset.status||'Status não informado'}</p></header><section className="grid gap-4 text-sm md:grid-cols-2"><p><b>Tipo:</b> {assetType==='veiculo'?'Motocicleta':'Imóvel'}</p><p><b>Placa:</b> {asset.plate||'Não informada'}</p><p><b>Endereço:</b> {asset.address||'Não informado'}</p><p><b>Responsável/locatário:</b> {asset.tenant||'Não informado'}</p><p><b>Data de aquisição:</b> {asset.acquisition_date||'Não informada'}</p><p><b>Valor de aquisição:</b> {brl(Number(asset.purchase_value||0))}</p><p><b>Valor atual:</b> {brl(Number(asset.current_value||asset.purchase_value||0))}</p></section><p className="rounded bg-gray-50 p-3 text-xs text-secondary">Relacionamentos financeiros são exibidos somente quando existe vínculo explícito no schema; nenhum lançamento é atribuído automaticamente.</p></div>;
}
