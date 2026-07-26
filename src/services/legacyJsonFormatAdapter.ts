/**
 * legacyJsonFormatAdapter.ts
 *
 * Adaptador para o formato JSON antigo exportado pela aplicação legada.
 * Estrutura esperada: { version, generated_at, tables: { transactions, charges, fixed_costs, ... } }
 *
 * Normaliza campos para o formato canônico do ERP.
 * Preserva company_id, category_id e demais relacionamentos quando presentes.
 * Usa o contexto do Master (empresas, categorias, clientes, assets) para
 * resolver relacionamentos ausentes sem nunca atribuir à HOLDING automaticamente.
 */

import type { RepositoryModule, EntityRecord } from '../repositories/contracts';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface LegacyJsonDiagnostic {
  version: string | number;
  generatedAt: string;
  tableNames: string[];
  tableCounts: Record<string, number>;
}

export interface LegacyJsonAdaptation {
  modules: Partial<Record<RepositoryModule, EntityRecord[]>>;
  diagnostic: LegacyJsonDiagnostic;
  quarantine: Array<{ module: string; index: number; reason: string }>;
  ignored: Array<{ module: string; index: number; reason: string }>;
}

/** Contexto do Master para resolver relacionamentos ausentes no JSON */
export interface MasterContext {
  companies: EntityRecord[];
  categories: EntityRecord[];
  clients: EntityRecord[];
  assets: EntityRecord[];
  properties: EntityRecord[];
  vehicles: EntityRecord[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const normalizedWord = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const financialType = (v: unknown): string => {
  const w = normalizedWord(v);
  if (['receita', 'entrada', 'credito', 'credit', 'in'].includes(w)) return 'receita';
  if (['despesa', 'saida', 'debito', 'debit', 'out'].includes(w)) return 'despesa';
  return String(v ?? '');
};

const financialStatus = (v: unknown): string => {
  const w = normalizedWord(v);
  if (['pago', 'recebido', 'paid', 'confirmed', 'received'].includes(w)) return 'pago';
  if (['pendente', 'pending', 'aberto'].includes(w)) return 'pendente';
  if (['atrasado', 'overdue', 'vencido'].includes(w)) return 'atrasado';
  if (['cancelado', 'cancelled', 'canceled'].includes(w)) return 'cancelado';
  return String(v ?? '');
};

const chargeStatus = (v: unknown): string => {
  const w = normalizedWord(v);
  if (['pago', 'recebido', 'paid', 'confirmed', 'received'].includes(w)) return 'pago';
  if (['pendente', 'pending', 'aberto'].includes(w)) return 'pendente';
  if (['vencido', 'overdue', 'atrasado'].includes(w)) return 'vencido';
  if (['cancelado', 'cancelled', 'canceled'].includes(w)) return 'cancelado';
  return String(v ?? '');
};

const chargeFrequency = (v: unknown): string => {
  const w = normalizedWord(v);
  if (['unica', 'once', 'one_time'].includes(w)) return 'unica';
  if (['semanal', 'weekly'].includes(w)) return 'semanal';
  if (['mensal', 'monthly'].includes(w)) return 'mensal';
  if (['anual', 'yearly', 'annual'].includes(w)) return 'anual';
  if (['personalizada', 'custom'].includes(w)) return 'personalizada';
  return String(v ?? 'mensal');
};

const fixedCostFrequency = (v: unknown): string => {
  const w = normalizedWord(v);
  if (['semanal', 'weekly'].includes(w)) return 'semanal';
  if (['mensal', 'monthly'].includes(w)) return 'mensal';
  if (['anual', 'yearly', 'annual'].includes(w)) return 'anual';
  if (['personalizada', 'custom'].includes(w)) return 'personalizada';
  return 'mensal';
};

const toDateString = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null;
  const match = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && uuid.test(v);

// ── Índices de contexto ──────────────────────────────────────────────────────

interface ContextIndex {
  companyById: Map<string, EntityRecord>;
  companyByName: Map<string, string>; // normalized name → id
  categoryById: Map<string, EntityRecord>;
  categoryByName: Map<string, string>; // normalized "companyId|name" → id
  clientByFirstName: Map<string, string[]>; // normalized first name → [id, ...] (can be ambiguous)
  categoryByNameOnly: Map<string, string>; // normalized name → id (first match)
  clientById: Map<string, EntityRecord>;
  clientByName: Map<string, string>; // normalized name → id
  assetById: Map<string, EntityRecord>;
  assetByCode: Map<string, EntityRecord>; // normalized code → record
  propertyByCode: Map<string, EntityRecord>;
  vehicleByCode: Map<string, EntityRecord>;
  vehicleByClientId: Map<string, EntityRecord>;
  vehicleByClientName: Map<string, EntityRecord>;
}

function buildContextIndex(ctx: MasterContext): ContextIndex {
  const companyById = new Map(ctx.companies.map(c => [c.id, c]));
  const companyByName = new Map<string, string>();
  for (const c of ctx.companies) {
    companyByName.set(normalizedWord(c.name), c.id);
    if (c.slug) companyByName.set(normalizedWord(c.slug), c.id);
  }

  const categoryById = new Map(ctx.categories.map(c => [c.id, c]));
  const categoryByName = new Map<string, string>();
  const categoryByNameOnly = new Map<string, string>();
  for (const c of ctx.categories) {
    const key = `${c.company_id}|${normalizedWord(c.name)}`;
    if (!categoryByName.has(key)) categoryByName.set(key, c.id);
    const nameKey = normalizedWord(c.name);
    if (!categoryByNameOnly.has(nameKey)) categoryByNameOnly.set(nameKey, c.id);
  }

  const clientById = new Map(ctx.clients.map(c => [c.id, c]));
  const clientByName = new Map<string, string>();
  const clientByFirstName = new Map<string, string[]>();
  for (const c of ctx.clients) {
    const name = normalizedWord(c.name);
    if (name && !clientByName.has(name)) clientByName.set(name, c.id);
    // Index by first name for partial matching
    const firstName = name.split(/\s+/)[0];
    if (firstName) {
      const existing = clientByFirstName.get(firstName) ?? [];
      existing.push(c.id);
      clientByFirstName.set(firstName, existing);
    }
  }

  const assetById = new Map(ctx.assets.map(a => [a.id, a]));
  const assetByCode = new Map<string, EntityRecord>();
  for (const a of ctx.assets) {
    if (a.code) assetByCode.set(normalizedWord(a.code), a);
  }

  const propertyByCode = new Map<string, EntityRecord>();
  for (const p of ctx.properties) {
    if (p.code) propertyByCode.set(normalizedWord(p.code), p);
    // Also index by description for ref matching
    if (p.description) propertyByCode.set(normalizedWord(p.description), p);
  }

  const vehicleByCode = new Map<string, EntityRecord>();
  const vehicleByClientId = new Map<string, EntityRecord>();
  const vehicleByClientName = new Map<string, EntityRecord>();
  for (const v of ctx.vehicles) {
    if (v.code) vehicleByCode.set(normalizedWord(v.code), v);
    if (v.client_id && typeof v.client_id === 'string') vehicleByClientId.set(v.client_id, v);
    if (v.client_name) vehicleByClientName.set(normalizedWord(v.client_name), v);
  }

  return { companyById, companyByName, categoryById, categoryByName, categoryByNameOnly, clientById, clientByName, clientByFirstName, assetById, assetByCode, propertyByCode, vehicleByCode, vehicleByClientId, vehicleByClientName };
}

/** Resolve company_id from `ref` or `category` field names that look like company names */
function resolveCompanyFromName(name: unknown, idx: ContextIndex): string | null {
  const n = normalizedWord(name);
  if (!n) return null;
  // Direct match
  if (idx.companyByName.has(n)) return idx.companyByName.get(n)!;
  // Fuzzy patterns
  if (/loc[\s_-]*mottus|mottus/.test(n)) return idx.companyByName.get('loc mottus') ?? null;
  if (/rastrear|rastreamento|3a[\s_-]*rastrear/.test(n)) return idx.companyByName.get('3a rastrear') ?? null;
  if (/imoveis|imovel|mansao|kit[\s_-]*net|kit[\s_-]*\d/.test(n)) return idx.companyByName.get('imoveis') ?? null;
  if (/holding|grupo[\s_-]*3a/.test(n)) return idx.companyByName.get('holding grupo 3a') ?? idx.companyByName.get('custo operacionais') ?? null;
  return null;
}

/** Resolve an asset from a charge `ref` field — matches against vehicle/property codes */
function resolveAssetFromRef(ref: unknown, idx: ContextIndex): EntityRecord | null {
  const raw = String(ref ?? '').trim();
  const n = normalizedWord(ref);
  if (!n) return null;

  // Direct code match (e.g., "M018", "KIT 03", "IM 07")
  if (idx.vehicleByCode.has(n)) return idx.vehicleByCode.get(n)!;
  if (idx.propertyByCode.has(n)) return idx.propertyByCode.get(n)!;
  if (idx.assetByCode.has(n)) return idx.assetByCode.get(n)!;

  // Pure numeric ref → vehicle code M+padded ("018"→"m018", "04"→"m004", "4"→"m004")
  if (/^\d+$/.test(n)) {
    const num = parseInt(n, 10);
    // Try m+3-digit padding (M001-M032)
    const mCode = `m${String(num).padStart(3, '0')}`;
    if (idx.vehicleByCode.has(mCode)) return idx.vehicleByCode.get(mCode)!;
    // Try c+2-digit padding (C01, C02)
    const cCode = `c${String(num).padStart(2, '0')}`;
    if (idx.vehicleByCode.has(cCode)) return idx.vehicleByCode.get(cCode)!;
  }

  // "IM XX" already handled by direct match
  // "KIT XX" / "KIT NET XX" already handled by direct match

  // Try matching against property descriptions (e.g., "BOX" isn't a code but might match a description)
  // No match found — not a recognizable asset ref (could be company name like "LOC MOTTUS")
  return null;
}

/** Resolve client_id from client_name using Master clients */
function resolveClientId(clientName: unknown, idx: ContextIndex): string | null {
  const n = normalizedWord(clientName);
  if (!n) return null;
  // Direct full-name match
  if (idx.clientByName.has(n)) return idx.clientByName.get(n)!;

  const parts = String(clientName ?? '').trim().split(/\s+/);
  if (parts.length > 1) {
    // "L017 DEIVID" → try "DEIVID"
    const last = normalizedWord(parts[parts.length - 1]);
    if (idx.clientByName.has(last)) return idx.clientByName.get(last)!;
    const rest = normalizedWord(parts.slice(1).join(' '));
    if (idx.clientByName.has(rest)) return idx.clientByName.get(rest)!;
    // Try first-name matching for the last token
    const firstNameHits = idx.clientByFirstName.get(last);
    if (firstNameHits?.length === 1) return firstNameHits[0];
  }

  // Single-word name (e.g., "ANDERSON") → search by first name in Master
  if (parts.length === 1) {
    const firstNameHits = idx.clientByFirstName.get(n);
    if (firstNameHits?.length === 1) return firstNameHits[0]; // unambiguous
  }

  return null;
}

/** Resolve category_id from category name */
function resolveCategoryId(name: unknown, companyId: unknown, idx: ContextIndex): string | null {
  const n = normalizedWord(name);
  if (!n) return null;
  // Try company-scoped first
  if (typeof companyId === 'string') {
    const key = `${companyId}|${n}`;
    if (idx.categoryByName.has(key)) return idx.categoryByName.get(key)!;
  }
  // Fallback to name-only
  if (idx.categoryByNameOnly.has(n)) return idx.categoryByNameOnly.get(n)!;
  return null;
}

// ── Adaptador de Transactions ────────────────────────────────────────────────

function adaptTransaction(
  record: Record<string, unknown>,
  index: number,
  quarantine: LegacyJsonAdaptation['quarantine'],
  idx: ContextIndex,
): EntityRecord | null {
  const id = String(record.id ?? '');
  if (!uuid.test(id)) {
    quarantine.push({ module: 'transactions', index, reason: 'UUID ausente ou inválido.' });
    return null;
  }

  const type = financialType(record.type);
  const status = financialStatus(record.status);
  const value = Number(record.value ?? 0);
  const transactionDate = toDateString(record.date) ?? toDateString(record.transaction_date) ?? toDateString(record.created_at);
  const description = String(record.description ?? '');

  // Company: preserve original, resolve from category field name if missing
  let companyId: string | null = isUuid(record.company_id) ? record.company_id : null;
  if (!companyId) {
    // Try to resolve from the `category` field which sometimes holds a company name
    companyId = resolveCompanyFromName(record.category, idx);
  }

  // Category: preserve original, resolve from name if missing
  let categoryId: string | null = isUuid(record.category_id) ? record.category_id : null;
  if (!categoryId) {
    categoryId = isUuid(record.id_categoria_financeira) ? record.id_categoria_financeira as string : null;
  }
  if (!categoryId) {
    categoryId = resolveCategoryId(record.category, companyId, idx);
  }

  // If we have a category but no company, derive company from category
  if (!companyId && categoryId) {
    const cat = idx.categoryById.get(categoryId);
    if (cat && isUuid(cat.company_id)) companyId = cat.company_id as string;
  }

  // Referências opcionais
  const chargeId = record.charge_id ?? record.referencia_id ?? record.reference_id ?? null;
  const clientId = record.client_id ?? null;
  const assetId = record.asset_id ?? null;
  const bankAccountId = record.bank_account_id ?? record.id_conta ?? null;
  const seriesId = record.series_id ?? null;
  const competencyDate = toDateString(record.competency_date ?? record.competencyDate) ?? null;

  if (!transactionDate) {
    quarantine.push({ module: 'transactions', index, reason: 'Data da transação ausente.' });
    return null;
  }

  return {
    id,
    company_id: companyId,
    category_id: categoryId,
    type,
    status,
    description,
    value,
    transaction_date: transactionDate,
    charge_id: isUuid(chargeId) ? chargeId : null,
    client_id: isUuid(clientId) ? clientId : null,
    asset_id: isUuid(assetId) ? assetId : null,
    bank_account_id: isUuid(bankAccountId) ? bankAccountId : null,
    series_id: isUuid(seriesId) ? seriesId : null,
    competency_date: competencyDate,
    created_at: record.created_at ?? null,
  } as EntityRecord;
}

// ── Adaptador de Charges ─────────────────────────────────────────────────────

function adaptCharge(
  record: Record<string, unknown>,
  index: number,
  quarantine: LegacyJsonAdaptation['quarantine'],
  idx: ContextIndex,
): EntityRecord | null {
  const id = String(record.id ?? '');
  if (!uuid.test(id)) {
    quarantine.push({ module: 'charges', index, reason: 'UUID ausente ou inválido.' });
    return null;
  }

  const status = chargeStatus(record.status);
  const value = Number(record.value ?? record.valor_cobranca ?? 0);
  const dueDate = toDateString(record.due_date) ?? toDateString(record.dueDate);
  const description = String(record.description ?? record.client_name ?? '');
  const frequency = chargeFrequency(record.frequency);
  const seriesId = record.series_id ?? null;
  const paidAt = toDateString(record.paid_at ?? record.received_at) ?? null;

  // Company: preserve original
  let companyId: string | null = isUuid(record.company_id) ? record.company_id : null;

  // Category: preserve original
  let categoryId: string | null = isUuid(record.category_id) ? record.category_id : null;
  if (!categoryId) {
    categoryId = isUuid(record.id_categoria_financeira) ? record.id_categoria_financeira as string : null;
  }

  // Resolve asset from `ref` field (vehicle/property codes)
  let assetId: string | null = isUuid(record.asset_id) ? record.asset_id : null;
  let resolvedAsset: EntityRecord | null = null;
  if (!assetId && record.ref) {
    resolvedAsset = resolveAssetFromRef(record.ref, idx);
    if (resolvedAsset) {
      assetId = resolvedAsset.id;
      // The resolved record might be a vehicle/property, not an asset.
      // Look up the corresponding asset to get company_id.
      const correspondingAsset = idx.assetById.get(resolvedAsset.id);
      if (!companyId) {
        const assetCompany = correspondingAsset?.company_id ?? resolvedAsset.company_id;
        if (isUuid(assetCompany)) companyId = assetCompany as string;
      }
    }
  }

  // Resolve company from `ref` if it's a company name, not an asset code
  if (!companyId && record.ref) {
    companyId = resolveCompanyFromName(record.ref, idx);
  }

  // Resolve category from company if we have company but no category
  if (!categoryId && companyId) {
    categoryId = resolveCategoryId(record.category, companyId, idx);
  }

  // If we have a companyId but no category, try to find any category for this company
  if (!categoryId && companyId) {
    // Look for a category named after the company name or a generic one
    for (const [key, id] of idx.categoryByName.entries()) {
      if (key.startsWith(`${companyId}|`)) { categoryId = id; break; }
    }
  }

  // Resolve client from client_name
  let clientId: string | null = isUuid(record.client_id) ? record.client_id : null;
  if (!clientId && record.client_name) {
    clientId = resolveClientId(record.client_name, idx);
  }

  if (!dueDate) {
    quarantine.push({ module: 'charges', index, reason: 'Data de vencimento ausente.' });
    return null;
  }

  return {
    id,
    company_id: companyId,
    category_id: categoryId,
    client_id: clientId,
    asset_id: assetId,
    due_date: dueDate,
    description,
    value,
    status,
    frequency,
    series_id: isUuid(seriesId) ? seriesId : null,
    paid_at: paidAt,
    created_at: record.created_at ?? null,
  } as EntityRecord;
}

// ── Adaptador de Fixed Costs ─────────────────────────────────────────────────

function adaptFixedCost(
  record: Record<string, unknown>,
  index: number,
  quarantine: LegacyJsonAdaptation['quarantine'],
  idx: ContextIndex,
): EntityRecord | null {
  const id = String(record.id ?? '');
  if (!uuid.test(id)) {
    quarantine.push({ module: 'fixed_costs', index, reason: 'UUID ausente ou inválido.' });
    return null;
  }

  const description = String(record.description ?? record.name ?? '');
  const value = Number(record.value ?? record.price ?? record.total ?? 0);
  const companyId: string | null = isUuid(record.company_id) ? record.company_id : null;
  let categoryId: string | null = isUuid(record.category_id) ? record.category_id : null;
  const frequency = fixedCostFrequency(record.frequency);

  // Resolve category from name if missing
  if (!categoryId && record.category) {
    categoryId = resolveCategoryId(record.category, companyId, idx);
  }

  // Extrair due_day do due_date se não tiver due_day explícito
  const dueDateStr = toDateString(record.due_date ?? record.dueDate);
  const dueDay = record.due_day != null
    ? Number(record.due_day)
    : dueDateStr
      ? new Date(`${dueDateStr}T12:00:00`).getDate()
      : 1;

  // start_date: usar due_date, created_at, ou gerar
  const startDate = toDateString(record.start_date ?? record.startDate)
    ?? dueDateStr
    ?? toDateString(record.created_at)
    ?? new Date().toISOString().slice(0, 10);

  // next_due_date: usar existente ou calcular a partir de start_date + due_day
  let nextDueDate = toDateString(record.next_due_date ?? record.nextDueDate);
  if (!nextDueDate) {
    const base = new Date(`${startDate}T12:00:00`);
    base.setDate(dueDay);
    if (base.getTime() < Date.now()) base.setMonth(base.getMonth() + 1);
    nextDueDate = base.toISOString().slice(0, 10);
  }

  const bankAccountId = record.bank_account_id ?? record.bankAccountId ?? null;
  const endDate = toDateString(record.end_date ?? record.endDate) ?? null;

  return {
    id,
    company_id: companyId,
    category_id: categoryId,
    description,
    value,
    due_day: dueDay,
    frequency,
    start_date: startDate,
    next_due_date: nextDueDate,
    end_date: endDate,
    bank_account_id: isUuid(bankAccountId) ? bankAccountId : null,
    created_at: record.created_at ?? null,
  } as EntityRecord;
}

// ── Função principal ─────────────────────────────────────────────────────────

export function adaptLegacyJson(raw: unknown, masterContext?: MasterContext): LegacyJsonAdaptation {
  if (!isObject(raw)) throw new Error('JSON raiz deve ser um objeto.');

  const version = String(raw.version ?? 'desconhecida');
  const generatedAt = String(raw.generated_at ?? raw.generatedAt ?? '');
  const tables = isObject(raw.tables) ? raw.tables : raw;

  const tableNames = Object.keys(tables).sort();
  const tableCounts: Record<string, number> = {};
  for (const key of tableNames) {
    tableCounts[key] = Array.isArray(tables[key]) ? (tables[key] as unknown[]).length : 0;
  }

  const diagnostic: LegacyJsonDiagnostic = { version, generatedAt, tableNames, tableCounts };
  const quarantine: LegacyJsonAdaptation['quarantine'] = [];
  const ignored: LegacyJsonAdaptation['ignored'] = [];
  const modules: Partial<Record<RepositoryModule, EntityRecord[]>> = {};

  // Build context index from Master data
  const ctx = masterContext ?? { companies: [], categories: [], clients: [], assets: [], properties: [], vehicles: [] };
  const idx = buildContextIndex(ctx);

  // ── Transactions ───────────────────────────────────────────────────────────
  const rawTransactions = Array.isArray(tables.transactions) ? tables.transactions as unknown[] : [];
  const adaptedTransactions: EntityRecord[] = [];
  rawTransactions.forEach((record, index) => {
    if (!isObject(record)) {
      quarantine.push({ module: 'transactions', index, reason: 'Registro não é um objeto.' });
      return;
    }
    const adapted = adaptTransaction(record, index, quarantine, idx);
    if (adapted) adaptedTransactions.push(adapted);
  });
  if (adaptedTransactions.length) modules.transactions = adaptedTransactions;

  // ── Charges ────────────────────────────────────────────────────────────────
  const rawCharges = Array.isArray(tables.charges) ? tables.charges as unknown[] : [];
  const adaptedCharges: EntityRecord[] = [];
  rawCharges.forEach((record, index) => {
    if (!isObject(record)) {
      quarantine.push({ module: 'charges', index, reason: 'Registro não é um objeto.' });
      return;
    }
    const adapted = adaptCharge(record, index, quarantine, idx);
    if (adapted) adaptedCharges.push(adapted);
  });
  if (adaptedCharges.length) modules.charges = adaptedCharges;

  // ── Fixed Costs ────────────────────────────────────────────────────────────
  const rawFixedCosts = Array.isArray(tables.fixed_costs) ? tables.fixed_costs as unknown[] : [];
  const adaptedFixedCosts: EntityRecord[] = [];
  rawFixedCosts.forEach((record, index) => {
    if (!isObject(record)) {
      quarantine.push({ module: 'fixed_costs', index, reason: 'Registro não é um objeto.' });
      return;
    }
    const adapted = adaptFixedCost(record, index, quarantine, idx);
    if (adapted) adaptedFixedCosts.push(adapted);
  });
  if (adaptedFixedCosts.length) modules.fixed_costs = adaptedFixedCosts;

  // ── Tabelas ignoradas (logs, auditoria, etc.) ─────────────────────────────
  const financialTables = new Set(['transactions', 'charges', 'fixed_costs']);
  const structuralTables = new Set(['companies', 'categories', 'clients', 'banks', 'category_masters']);
  for (const key of tableNames) {
    if (financialTables.has(key) || structuralTables.has(key)) continue;
    const count = tableCounts[key] ?? 0;
    if (count > 0) {
      ignored.push({ module: key, index: -1, reason: `Tabela '${key}' (${count} registros) não é financeira; ignorada no importador consolidado.` });
    }
  }

  return { modules, diagnostic, quarantine, ignored };
}
