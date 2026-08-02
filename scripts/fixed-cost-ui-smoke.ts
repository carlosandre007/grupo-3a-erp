import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/CustoFixo.tsx', 'utf8');
const details = readFileSync('src/components/FixedCostDetails.tsx', 'utf8');
const actions = readFileSync('src/components/ProtectedRecordActions.tsx', 'utf8');
const payment = readFileSync('src/components/ProtectedPayButton.tsx', 'utf8');

for (const range of ['dias 9–15', 'dias 16–18', 'dias 19–23', 'dias 24–31']) {
  if (!page.includes(range)) throw new Error(`Grupo ausente: ${range}.`);
}
if (!page.includes('Fora das faixas 9–31') || !page.includes('.filter(group => group.costs.length > 0)')) {
  throw new Error('Grupos vazios ou vencimentos fora das faixas não foram tratados.');
}
for (const label of [
  'Nome', 'Empresa', 'Categoria', 'Valor mensal', 'Vencimento', 'Situação',
  'Data do último pagamento', 'Próximo vencimento', 'Recorrência', 'Total pago',
  'Observações', 'Histórico de pagamentos', 'Valores pagos por mês',
]) {
  if (!details.includes(label)) throw new Error(`Campo do Visualizar ausente: ${label}.`);
}
if (/UUID|company_id|category_id|recurrence_group_id/.test(details)) {
  throw new Error('O painel Visualizar expõe nome técnico ou UUID.');
}
for (const action of ['title="Visualizar"', 'title="Editar"', 'title="Excluir"']) {
  if (!actions.includes(action)) throw new Error(`Ação ausente: ${action}.`);
}
if (!payment.includes('markFixedCostPaid') || !payment.includes('Senha administrativa')) {
  throw new Error('Marcar como pago não está protegido.');
}

for (const required of [
  'projectCostsForMonth',
  'monthRange',
  'selectedMonth',
  'availableMonths',
  'selectedMonth === currentMonth',
  'border-sky-200',
  'border-violet-200',
  'border-amber-200',
  'border-rose-200',
]) {
  if (!page.includes(required)) throw new Error(`Filtro mensal ou cor de grupo ausente: ${required}.`);
}
if (/\.insert\(|\.update\(|\.delete\(/.test(page)) {
  throw new Error('A projeção mensal introduziu gravação direta no banco.');
}

console.log('fixed-cost-ui-smoke: OK');
