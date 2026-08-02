import{jsPDF}from'jspdf';
import type{AgendaCharge}from'./chargeAgendaAdapter';
import type{EntityRecord}from'../repositories';
const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function generateAgendaPropertyReceipt(charge:AgendaCharge,property:EntityRecord,paidAt:string,transactionId:string){
 const pdf=new jsPDF({unit:'mm',format:'a4'}),paidDate=new Date(paidAt),competency=paidDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 pdf.setDrawColor(41,49,56);pdf.rect(15,15,180,267);pdf.setFillColor(255,195,0);pdf.rect(15,15,180,18,'F');
 pdf.setFont('helvetica','bold');pdf.setFontSize(18);pdf.text('RECIBO DE ALUGUEL',105,27,{align:'center'});
 pdf.setFontSize(10);pdf.text(`REC-${charge.id.slice(0,8).toUpperCase()}`,25,45);pdf.text('GRUPO 3A - IMÓVEIS',185,45,{align:'right'});
 const rows=[
  ['Locatária','Alane Maira'],
  ['Imóvel',String(property.description??property.name??charge.ref??'Não informado')],
  ['Código do imóvel',String(property.code??charge.ref??'Não informado')],
  ['Endereço',String(property.address??'Não informado')],
  ['Competência',competency],
  ['Valor pago',money(charge.value)],
  ['Data do pagamento',paidDate.toLocaleString('pt-BR')],
  ['Cobrança',charge.id],
  ['Lançamento financeiro',transactionId],
 ];
 let y=62;pdf.setFontSize(11);for(const[label,value]of rows){pdf.setFont('helvetica','bold');pdf.text(`${label}:`,25,y);pdf.setFont('helvetica','normal');pdf.text(pdf.splitTextToSize(value,110),70,y);y+=11}
 y+=10;pdf.text(pdf.splitTextToSize(`Recebemos de Alane Maira a importância de ${money(charge.value)}, referente ao aluguel do imóvel identificado acima, relativo à competência ${competency}.`,150),30,y);
 pdf.line(55,235,155,235);pdf.setFontSize(10);pdf.text('Assinatura da emitente',105,242,{align:'center'});
 pdf.save(`recibo-aluguel-${charge.id.slice(0,8)}-${paidDate.toISOString().slice(0,10)}.pdf`);
}
