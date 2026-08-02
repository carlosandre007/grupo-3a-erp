import React,{useState}from'react';
import{payCharge}from'../services/adminActions';
export default function PayChargeButton({id,disabled,onPaid}:{id:string;disabled:boolean;onPaid:(result:{operationId:string;paidAt:string;transaction:Record<string,unknown>})=>void}){
 const[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const pay=async()=>{if(!window.confirm('Confirmar o pagamento e lançar a receita no Fluxo de Caixa?'))return;setBusy(true);setMessage('');try{const result=await payCharge(id);onPaid(result)}catch(reason){setMessage(reason instanceof Error?reason.message:'Falha ao registrar pagamento.')}finally{setBusy(false)}};
 return <div><button disabled={disabled||busy} onClick={()=>void pay()} className="rounded bg-green-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{disabled?'PAGO':busy?'REGISTRANDO...':'PAGO / LANÇAR NO CAIXA'}</button>{message&&<p className="mt-2 max-w-72 text-xs text-red-700">{message}</p>}</div>
}
