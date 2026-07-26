import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { chargeAgendaDryRun, enrichChargeToAgenda } from '../src/services/chargeAgendaAdapter';
import type { EntityRecord } from '../src/repositories/contracts';

config({ path: '.env.local', quiet: true });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Configuração pública do Supabase ausente.');

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const pages = async (table: string) => {
  const records: EntityRecord[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select('*').order('id').range(offset, offset + 999);
    if (error) throw new Error(`Falha de leitura sanitizada em ${table}: ${error.code ?? 'READ_ERROR'}`);
    const page = (data ?? []) as EntityRecord[];
    records.push(...page);
    if (page.length < 1000) break;
  }
  return records;
};

const [source, clients, properties, vehicles] = await Promise.all([
  pages('charges'), pages('clients'), pages('properties'), pages('motorcycles'),
]);
const calendar = source.map(row => enrichChargeToAgenda(row, { clients, properties, vehicles }));
const report = chargeAgendaDryRun(source, calendar);
const mappingCoverage = {
  uuid: calendar.filter(row => Boolean(row.id)).length,
  company_id: calendar.filter(row => Boolean(row.company_id)).length,
  category_id: calendar.filter(row => Boolean(row.category_id)).length,
  client_id: calendar.filter(row => Boolean(row.client_id)).length,
  asset_id: calendar.filter(row => Boolean(row.asset_id)).length,
  valor: calendar.filter(row => Number.isFinite(row.value)).length,
  vencimento: calendar.filter(row => Boolean(row.due_date)).length,
  frequencia: calendar.filter(row => Boolean(row.frequency)).length,
  status: calendar.filter(row => Boolean(row.status)).length,
  descricao: calendar.filter(row => Boolean(row.description)).length,
  caucao_fianca: calendar.filter(row => Boolean(row.guarantee)).length,
  observacoes: calendar.filter(row => Boolean(row.observation)).length,
};

console.log(JSON.stringify({
  ...report,
  sourceFields: Object.keys(source[0] ?? {}).sort(),
  clientFields: Object.keys(clients[0] ?? {}).sort(),
  propertyFields: Object.keys(properties[0] ?? {}).sort(),
  vehicleFields: Object.keys(vehicles[0] ?? {}).sort(),
  mappingCoverage,
}, null, 2));
