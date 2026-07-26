import { jsPDF } from 'jspdf';
import { Charge, Client, Property, Transaction } from '../types';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value: string) => new Date(value.includes('T') ? value : `${value}T12:00:00`).toLocaleDateString('pt-BR');

export const getReceiptNumber = (charge: Charge) => charge.receiptId || `REC-${charge.id.toUpperCase()}`;

export function buildRentalReceiptPdf(charge: Charge, transaction: Transaction, client?: Client, property?: Property) {
  const receiptNumber = getReceiptNumber(charge);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setDrawColor(41, 49, 56); doc.setLineWidth(0.7); doc.rect(15, 15, 180, 267);
  doc.setFillColor(255, 195, 0); doc.rect(15, 15, 180, 18, 'F');
  doc.setTextColor(41, 49, 56); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('RECIBO DE ALUGUEL', 105, 27, { align: 'center' });
  doc.setFontSize(10); doc.text(`Número: ${receiptNumber}`, 25, 45); doc.text('GRUPO 3A - IMÓVEIS', 185, 45, { align: 'right' });
  doc.setDrawColor(210); doc.line(25, 52, 185, 52);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  const rows = [
    ['Emitente', 'Alane Maria da Silva'],
    ['Cliente', client?.name || charge.client],
    ['Imóvel alugado', property?.name || charge.description],
    ['Endereço do imóvel', property?.address || 'Endereço não cadastrado'],
    ['Período de referência', charge.referencePeriod || new Date(`${charge.dueDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })],
    ['Valor pago', money(charge.value)],
    ['Data do pagamento', date(charge.paidAt || transaction.createdAt || transaction.date)],
    ['Forma de pagamento', charge.paymentMethod || 'Não informada']
  ];
  let y = 65;
  rows.forEach(([label, value]) => { doc.setFont('helvetica', 'bold'); doc.text(`${label}:`, 25, y); doc.setFont('helvetica', 'normal'); const lines = doc.splitTextToSize(value, 110); doc.text(lines, 70, y); y += Math.max(10, lines.length * 6); });
  y += 8; doc.setFont('helvetica', 'normal');
  const declaration = `Declaro, para os devidos fins, que recebi de ${client?.name || charge.client} a importancia de ${money(charge.value)}, referente ao aluguel acima identificado, dando plena quitacao ao periodo informado.`;
  doc.text(doc.splitTextToSize(declaration, 150), 30, y, { align: 'justify' });
  doc.line(55, 235, 155, 235); doc.setFontSize(10); doc.text('Assinatura da emitente', 105, 242, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('GRUPO 3A - IMÓVEIS', 105, 266, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(`Cobranca: ${charge.id} | Lancamento: ${transaction.id}`, 105, 274, { align: 'center' });
  return doc;
}

export function generateRentalReceipt(charge: Charge, transaction: Transaction, client?: Client, property?: Property) {
  const receiptNumber = getReceiptNumber(charge);
  buildRentalReceiptPdf(charge, transaction, client, property).save(`recibo-aluguel-${receiptNumber}.pdf`);
  return receiptNumber;
}

export function normalizeBrazilPhone(phone?: string): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export function openRentalWhatsApp(client: Client, charge: Charge): boolean {
  const phone = normalizeBrazilPhone(client.phone);
  if (!phone) return false;
  const period = charge.referencePeriod || new Date(`${charge.dueDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const message = `Olá, ${client.name}. Confirmamos o pagamento do aluguel referente a ${period}, no valor de ${money(charge.value)}. O recibo foi gerado pelo GRUPO 3A – IMÓVEIS.`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  return true;
}
