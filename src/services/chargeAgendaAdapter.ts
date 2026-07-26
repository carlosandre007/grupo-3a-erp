import type { EntityRecord } from '../repositories/contracts';

export type AgendaCharge = EntityRecord & {
  company_id: string | null;
  category_id: string | null;
  client_id: string | null;
  asset_id: string | null;
  value: number;
  due_date: string;
  frequency: string;
  status: string;
  description: string;
  guarantee: string | null;
  observation: string;
  client_name: string;
};

export type ChargeAgendaDryRun = {
  mode: 'dry-run';
  sourceTable: 'charges';
  source: number;
  adapted: number;
  calendar: number;
  duplicates: number;
  invalid: number;
  consistent: boolean;
  zeroWrites: true;
};
export type AgendaLookupContext = {
  clients?: EntityRecord[];
  properties?: EntityRecord[];
  vehicles?: EntityRecord[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nullableUuid = (value: unknown) => uuid.test(String(value ?? '')) ? String(value) : null;
const text = (...values: unknown[]) => String(values.find(value => value != null && String(value).trim()) ?? '');
const key = (value: unknown) => text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

const normalizedStatus = (value: unknown) => {
  const status = text(value).toLowerCase();
  if (['received', 'confirmed', 'paid', 'pago'].includes(status)) return 'pago';
  if (['overdue', 'late', 'atrasado', 'vencido'].includes(status)) return 'vencido';
  if (['cancelled', 'canceled', 'cancelado'].includes(status)) return 'cancelado';
  return status || 'pendente';
};

export function adaptChargeToAgenda(row: EntityRecord): AgendaCharge {
  const observation = text(row.observation, row.observations, row.observacao, row.observacoes);
  return {
    ...row,
    id: String(row.id),
    company_id: nullableUuid(row.company_id),
    category_id: nullableUuid(row.category_id ?? row.id_categoria_financeira),
    client_id: nullableUuid(row.client_id),
    asset_id: nullableUuid(row.asset_id),
    value: Number(row.value ?? row.valor_cobranca ?? 0),
    due_date: text(row.due_date, row.dueDate, row.vencimento, row.date),
    frequency: text(row.frequency, row.frequencia, row.is_recurring ? 'mensal' : 'unica') || 'unica',
    status: normalizedStatus(row.status),
    description: text(row.description, row.ref, row.client_name, observation),
    guarantee: text(row.guarantee, row.garantia, row.caucao, row.fianca) || null,
    observation,
    client_name: text(row.client_name, row.client, row.cliente),
  };
}

export function enrichChargeToAgenda(row: EntityRecord, context: AgendaLookupContext): AgendaCharge {
  const charge = adaptChargeToAgenda(row);
  if (!charge.client_id && charge.client_name) {
    const match = context.clients?.find(client => key(client.name ?? client.nome) === key(charge.client_name));
    if (match) charge.client_id = nullableUuid(match.id);
  }
  if (!charge.asset_id && row.ref) {
    const assets = [...(context.properties ?? []), ...(context.vehicles ?? [])];
    const match = assets.find(asset =>
      [asset.id, asset.code, asset.codigo, asset.plate, asset.placa, asset.ref]
        .some(value => value != null && key(value) === key(row.ref)));
    if (match) charge.asset_id = nullableUuid(match.id);
  }
  return charge;
}

export function chargeAgendaDryRun(source: EntityRecord[], calendar: AgendaCharge[]): ChargeAgendaDryRun {
  const adapted = source.map(adaptChargeToAgenda);
  const ids = new Set<string>();
  let duplicates = 0;
  let invalid = 0;
  for (const charge of adapted) {
    if (!uuid.test(charge.id) || !charge.due_date || !Number.isFinite(charge.value)) invalid++;
    if (ids.has(charge.id)) duplicates++;
    ids.add(charge.id);
  }
  return {
    mode: 'dry-run',
    sourceTable: 'charges',
    source: source.length,
    adapted: adapted.length,
    calendar: calendar.length,
    duplicates,
    invalid,
    consistent: source.length === adapted.length && adapted.length === calendar.length && duplicates === 0,
    zeroWrites: true,
  };
}
