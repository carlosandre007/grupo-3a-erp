import { jsPDF } from 'jspdf';
import type { Charge, Client, Property } from '../types';

export function buildSecurityDepositReceipt(charge:Charge,client?:Client,property?:Property){
 const guarantee=charge.rentalGuarantee;if(!guarantee||guarantee.type!=='cash_deposit'||!guarantee.receivedAt)throw new Error('Caução recebida não encontrada.');
 const number=guarantee.receiptId||`CAU-${guarantee.id.slice(0,8).toUpperCase()}`,pdf=new jsPDF();
 pdf.setFont('helvetica','bold');pdf.setFontSize(18);pdf.text('RECIBO DE CAUÇÃO',105,24,{align:'center'});pdf.setFontSize(10);pdf.text(`Nº ${number}`,105,32,{align:'center'});
 pdf.setFont('helvetica','normal');pdf.setFontSize(11);let y=50;const line=(label:string,value:string)=>{pdf.setFont('helvetica','bold');pdf.text(`${label}:`,20,y);pdf.setFont('helvetica','normal');pdf.text(value||'Não informado',65,y);y+=9;};
 line('Emitente','Alane Maria da Silva');line('Cliente',client?.name||charge.client);line('Imóvel',property?.name||charge.assetName||'');line('Endereço',property?.address||'');line('Valor',guarantee.value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));line('Recebimento',new Date(`${guarantee.receivedAt}T12:00:00`).toLocaleDateString('pt-BR'));line('Classificação','Caução sob responsabilidade');
 y+=8;pdf.text('Declaro o recebimento do valor acima como garantia da locação, sem natureza de receita de aluguel.',20,y,{maxWidth:170});y+=34;pdf.line(55,y,155,y);pdf.text('Assinatura',105,y+6,{align:'center'});pdf.setFont('helvetica','bold');pdf.text('GRUPO 3A - IMÓVEIS',105,278,{align:'center'});return{pdf,number};
}
export function generateSecurityDepositReceipt(charge:Charge,client?:Client,property?:Property){const{pdf,number}=buildSecurityDepositReceipt(charge,client,property);pdf.save(`recibo-caucao-${number}.pdf`);return number;}
