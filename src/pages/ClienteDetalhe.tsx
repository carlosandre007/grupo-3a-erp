import React,{useEffect,useState}from'react';
import{useParams}from'react-router-dom';
import{repository,type EntityRecord}from'../repositories';

type ClientRow=EntityRecord&{name?:string;person_type?:string;document?:string;phone?:string;email?:string;address?:string;cnh_number?:string;cnh_expiry?:string};
export default function ClienteDetalhe(){
  const{id}=useParams();
  const[client,setClient]=useState<ClientRow|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  useEffect(()=>{if(!id){setLoading(false);return}repository.find<ClientRow>('clients',id).then(setClient).catch(reason=>setError(reason instanceof Error?reason.message:'Não foi possível carregar o cliente.')).finally(()=>setLoading(false))},[id]);
  if(loading)return <div className="rounded-xl border bg-white p-6">Carregando cliente...</div>;
  if(error)return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;
  if(!client)return <div className="rounded-xl border bg-white p-6">Cliente não encontrado.</div>;
  return <div className="rounded-xl border bg-white p-6 custom-shadow"><h2 className="font-display text-lg font-black">Detalhes do Cliente</h2><div className="mt-5 grid gap-4 text-sm md:grid-cols-2"><p><b>Nome:</b> {client.name||'Não informado'}</p><p><b>Tipo:</b> {client.person_type||'Não informado'}</p><p><b>Documento:</b> {client.document||'Não informado'}</p><p><b>Telefone:</b> {client.phone||'Não informado'}</p><p><b>E-mail:</b> {client.email||'Não informado'}</p><p><b>Endereço:</b> {client.address||'Não informado'}</p><p><b>CNH:</b> {client.cnh_number||'Não informada'}</p><p><b>Vencimento CNH:</b> {client.cnh_expiry||'Não informado'}</p></div></div>;
}
