/**
 * consolidated-local-dry-run.ts
 *
 * Importador consolidado local-only (dry-run).
 *
 * Fontes:
 *   1. Master ZIP  → empresas, categorias, clientes, imóveis, veículos (+ assets gerados)
 *   2. JSON comum  → 1.290 transactions, 638 charges, 102 fixed_costs
 *
 * Regras:
 *   - Sem conexão com Supabase
 *   - Comparação por UUID
 *   - Nunca duplica ou substitui
 *   - Preserva empresa, categoria, cliente, bem, data, valor, tipo
 *   - Não atribui à HOLDING automaticamente
 *   - Usa dados do Master para completar relacionamentos
 *   - Conflitos reais ficam em quarentena
 *   - Somente dry-run; zero writes
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { extractLegacyZip } from '../src/services/legacyZipAdapter';
import { adaptLegacyBackup, diagnoseRoot } from '../src/services/legacyBackupAdapter';
import { adaptLegacyJson, MasterContext } from '../src/services/legacyJsonFormatAdapter';
import { inspectImport } from '../src/services/jsonImporter';
import { createRestorePlan } from '../src/services/restoreValidation';
import type { BackupAnalysis } from '../src/services/backupMaster';
import type { DataRepository, EntityRecord, RepositoryModule } from '../src/repositories/contracts';

// ── Caminhos ─────────────────────────────────────────────────────────────────

const MASTER_ZIP_PATH = 'C:/Users/aandr/Downloads/backup_master_grupo3a_2026-07-23.zip';
const LEGACY_JSON_PATH = 'C:/Users/aandr/Downloads/backup-grupo-3a-2026-07-23-14-13.json';

// ── Repositório em memória (read-only, zero writes) ──────────────────────────

function createInMemoryRepository(seed: Partial<Record<RepositoryModule, EntityRecord[]>>): DataRepository & { writes: number } {
  const store = new Map<RepositoryModule, EntityRecord[]>();
  for (const [module, records] of Object.entries(seed)) {
    store.set(module as RepositoryModule, [...(records as EntityRecord[])]);
  }

  let writes = 0;

  return {
    kind: 'localStorage' as const,
    writes,
    async list<T extends EntityRecord>(module: RepositoryModule): Promise<T[]> {
      return (store.get(module) || []) as T[];
    },
    async find<T extends EntityRecord>(module: RepositoryModule, id: string): Promise<T | null> {
      return ((store.get(module) || []).find(r => r.id === id) as T) ?? null;
    },
    async create(_module: RepositoryModule, record: EntityRecord) {
      writes++;
      return record;
    },
    async update(_module: RepositoryModule, record: EntityRecord) {
      writes++;
      return record;
    },
    async remove() { writes++; },
    async runAtomically<T>(_modules: RepositoryModule[], operation: () => Promise<T>) {
      return operation();
    },
    get _writes() { return writes; },
  } as DataRepository & { writes: number };
}

// ── Utilitários de relatório ─────────────────────────────────────────────────

type CompanySummary = {
  transactions: { count: number; receitas: { count: number; value: number }; despesas: { count: number; value: number }; pending: number; paid: number; overdue: number };
  charges: { count: number; receitas: { count: number; value: number }; despesas: { count: number; value: number }; pending: number; paid: number; overdue: number };
  fixedCosts: { count: number; value: number };
};

const emptyCompanySummary = (): CompanySummary => ({
  transactions: { count: 0, receitas: { count: 0, value: 0 }, despesas: { count: 0, value: 0 }, pending: 0, paid: 0, overdue: 0 },
  charges: { count: 0, receitas: { count: 0, value: 0 }, despesas: { count: 0, value: 0 }, pending: 0, paid: 0, overdue: 0 },
  fixedCosts: { count: 0, value: 0 },
});

const companyNames = ['LOC MOTTUS', '3A RASTREAR', 'IMÓVEIS', 'HOLDING GRUPO 3A', 'custo operacionais'] as const;

// ── MAIN ─────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════');
console.log('  IMPORTADOR CONSOLIDADO LOCAL — DRY-RUN');
console.log('═══════════════════════════════════════════════════════════════');
console.log();

// 1. Ler e adaptar o Master ZIP (estrutura e cadastros)
console.log('▸ Lendo Master ZIP...');
const zipBytes = await readFile(MASTER_ZIP_PATH);
const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer;
const zipHash = createHash('sha256').update(zipBytes).digest('hex');
const extracted = await extractLegacyZip(zipBuffer);
const masterAdapted = adaptLegacyBackup(extracted.root, diagnoseRoot(extracted.root, extracted.diagnostic.encoding));
console.log(`  ✓ ZIP lido: ${extracted.diagnostic.modulesFound?.length ?? 0} módulos detectados`);

// 2. Ler e adaptar o JSON comum (financeiro) — com contexto do Master
console.log('▸ Lendo JSON legado...');
const jsonText = await readFile(LEGACY_JSON_PATH, 'utf-8');
const jsonRaw = JSON.parse(jsonText);

// Montar contexto do Master para resolver relacionamentos
const masterContext: MasterContext = {
  companies: (masterAdapted.modules.companies ?? []) as EntityRecord[],
  categories: (masterAdapted.modules.categories ?? []) as EntityRecord[],
  clients: (masterAdapted.modules.clients ?? []) as EntityRecord[],
  assets: (masterAdapted.modules.assets ?? []) as EntityRecord[],
  properties: (masterAdapted.modules.properties ?? []) as EntityRecord[],
  vehicles: (masterAdapted.modules.vehicles ?? []) as EntityRecord[],
};
console.log(`  ✓ Contexto Master: ${masterContext.companies.length} empresas, ${masterContext.categories.length} categorias, ${masterContext.clients.length} clientes, ${masterContext.assets.length} assets, ${masterContext.properties.length} imóveis, ${masterContext.vehicles.length} veículos`);

const jsonAdapted = adaptLegacyJson(jsonRaw, masterContext);
console.log(`  ✓ JSON lido: ${jsonAdapted.diagnostic.tableNames.length} tabelas, versão ${jsonAdapted.diagnostic.version}`);
console.log(`    Transactions: ${jsonAdapted.modules.transactions?.length ?? 0}`);
console.log(`    Charges:      ${jsonAdapted.modules.charges?.length ?? 0}`);
console.log(`    Fixed costs:  ${jsonAdapted.modules.fixed_costs?.length ?? 0}`);
console.log(`    Quarentena:   ${jsonAdapted.quarantine.length}`);
console.log(`    Ignorados:    ${jsonAdapted.ignored.length}`);
console.log();

// 3. Consolidar módulos: Master = estrutura, JSON = financeiro
//    Regra: registros do Master são a base de referência.
//    Registros financeiros vêm exclusivamente do JSON.
const consolidatedModules: Partial<Record<RepositoryModule, unknown[]>> = {};

// Do Master: empresas, categorias, clientes, assets, properties, vehicles
for (const module of ['companies', 'categories', 'clients', 'assets', 'properties', 'vehicles'] as RepositoryModule[]) {
  const masterRecords = masterAdapted.modules[module] ?? [];
  if (masterRecords.length > 0) consolidatedModules[module] = masterRecords;
}

// Do JSON: transactions, charges, fixed_costs
for (const module of ['transactions', 'charges', 'fixed_costs'] as RepositoryModule[]) {
  const jsonRecords = jsonAdapted.modules[module] ?? [];
  if (jsonRecords.length > 0) consolidatedModules[module] = jsonRecords;
}

console.log('▸ Módulos consolidados:');
for (const [module, records] of Object.entries(consolidatedModules)) {
  console.log(`    ${module}: ${(records as unknown[]).length}`);
}
console.log();

// 4. Criar repositório em memória (vazio = sem dados existentes no destino)
//    Os registros do Master servem como referência para resolver relacionamentos,
//    mas o destino começa vazio (simula um Supabase limpo).
const repository = createInMemoryRepository({});

// 5. Executar inspectImport (dry-run) sobre os módulos consolidados
console.log('▸ Executando inspectImport (dry-run)...');
const importReport = await inspectImport(repository, consolidatedModules, true);
console.log(`  ✓ Válidos:     ${JSON.stringify(importReport.valid)}`);
console.log(`  ✓ Duplicados:  ${JSON.stringify(importReport.duplicates)}`);
console.log(`  ✓ Conflitos:   ${importReport.conflicts.length}`);
console.log(`  ✓ Inválidos:   ${importReport.invalid.length}`);
console.log();

// 6. Criar análise completa e plano de restauração
const analysis: BackupAnalysis = {
  backup: null,
  convertedModules: consolidatedModules,
  report: importReport,
  diagnostic: {
    ...extracted.diagnostic,
    format: 'legacy-zip' as const,
    modulesFound: Object.keys(consolidatedModules),
  },
  adapterQuarantine: [...masterAdapted.quarantine, ...jsonAdapted.quarantine],
  adapterIgnored: [...(masterAdapted.ignored ?? []), ...jsonAdapted.ignored],
};

console.log('▸ Criando plano de restauração...');
const plan = await createRestorePlan(repository, analysis, zipHash);
console.log(`  ✓ Pronto:       ${plan.ready}`);
console.log(`  ✓ Inserções:    ${plan.willInsert}`);
console.log(`  ✓ Ignorados:    ${plan.ignored}`);
console.log(`  ✓ Quarentena:   ${plan.quarantine}`);
console.log(`  ✓ Consistente:  ${plan.summary.consistent}`);
console.log();

// 7. Montar mapa de empresas para relatório por empresa
const allCompanies = [...(consolidatedModules.companies ?? [])] as EntityRecord[];
const companyById = new Map<string, string>(allCompanies.map(c => [c.id as string, String(c.name)]));

const byCompany: Record<string, CompanySummary> = {};
for (const name of companyNames) byCompany[name] = emptyCompanySummary();
byCompany['SEM EMPRESA COMPROVADA'] = emptyCompanySummary();

// Indexar categorias por id para descobrir company_id
const allCategories = [...(consolidatedModules.categories ?? [])] as EntityRecord[];
const categoryCompanyMap = new Map<string, string>(allCategories.map(c => [c.id as string, String(c.company_id)]));

// 8. Classificar transactions por empresa
let minDate = '9999-12-31', maxDate = '0000-01-01';
let totalReceitas = 0, totalDespesas = 0;
let transactionsWithoutCompany = 0;

for (const record of (plan.records.transactions ?? []) as EntityRecord[]) {
  const date = String(record.transaction_date ?? '');
  if (date && date < minDate) minDate = date;
  if (date && date > maxDate) maxDate = date;

  const name = companyById.get(String(record.company_id ?? ''));
  const bucket = name && byCompany[name] ? name : 'SEM EMPRESA COMPROVADA';
  if (bucket === 'SEM EMPRESA COMPROVADA') transactionsWithoutCompany++;

  const row = byCompany[bucket].transactions;
  const value = Math.abs(Number(record.value ?? 0));
  row.count++;

  if (record.type === 'receita') { row.receitas.count++; row.receitas.value += value; totalReceitas += value; }
  if (record.type === 'despesa') { row.despesas.count++; row.despesas.value += value; totalDespesas += value; }
  if (record.status === 'pendente') row.pending++;
  if (record.status === 'pago') row.paid++;
  if (record.status === 'atrasado') row.overdue++;
}

// 9. Classificar charges por empresa
for (const record of (plan.records.charges ?? []) as EntityRecord[]) {
  const date = String(record.due_date ?? '');
  if (date && date < minDate) minDate = date;
  if (date && date > maxDate) maxDate = date;

  const name = companyById.get(String(record.company_id ?? ''));
  const bucket = name && byCompany[name] ? name : 'SEM EMPRESA COMPROVADA';
  const row = byCompany[bucket].charges;
  const value = Math.abs(Number(record.value ?? 0));
  row.count++;

  // Cobranças são receitas esperadas
  row.receitas.count++;
  row.receitas.value += value;

  if (record.status === 'pendente') row.pending++;
  if (record.status === 'pago') row.paid++;
  if (record.status === 'vencido') row.overdue++;
}

// 10. Classificar fixed_costs por empresa
for (const record of (plan.records.fixed_costs ?? []) as EntityRecord[]) {
  const name = companyById.get(String(record.company_id ?? ''));
  const bucket = name && byCompany[name] ? name : 'SEM EMPRESA COMPROVADA';
  const row = byCompany[bucket].fixedCosts;
  row.count++;
  row.value += Math.abs(Number(record.value ?? 0));
}

// 11. Montar relatório completo
const report = {
  titulo: 'IMPORTADOR CONSOLIDADO LOCAL — DRY-RUN',
  executadoEm: new Date().toISOString(),
  fontes: {
    masterZip: { path: MASTER_ZIP_PATH, sha256: zipHash },
    legacyJson: { path: LEGACY_JSON_PATH, version: jsonAdapted.diagnostic.version, generatedAt: jsonAdapted.diagnostic.generatedAt },
  },
  totalPorModulo: {
    companies: { entrada: (consolidatedModules.companies as unknown[])?.length ?? 0, validos: plan.records.companies?.length ?? 0 },
    categories: { entrada: (consolidatedModules.categories as unknown[])?.length ?? 0, validos: plan.records.categories?.length ?? 0 },
    clients: { entrada: (consolidatedModules.clients as unknown[])?.length ?? 0, validos: plan.records.clients?.length ?? 0 },
    assets: { entrada: (consolidatedModules.assets as unknown[])?.length ?? 0, validos: plan.records.assets?.length ?? 0 },
    properties: { entrada: (consolidatedModules.properties as unknown[])?.length ?? 0, validos: plan.records.properties?.length ?? 0 },
    vehicles: { entrada: (consolidatedModules.vehicles as unknown[])?.length ?? 0, validos: plan.records.vehicles?.length ?? 0 },
    transactions: { entrada: (consolidatedModules.transactions as unknown[])?.length ?? 0, validos: plan.records.transactions?.length ?? 0 },
    charges: { entrada: (consolidatedModules.charges as unknown[])?.length ?? 0, validos: plan.records.charges?.length ?? 0 },
    fixed_costs: { entrada: (consolidatedModules.fixed_costs as unknown[])?.length ?? 0, validos: plan.records.fixed_costs?.length ?? 0 },
  },
  periodo: { inicio: minDate, fim: maxDate },
  porEmpresa: Object.fromEntries(
    Object.entries(byCompany)
      .filter(([, v]) => v.transactions.count > 0 || v.charges.count > 0 || v.fixedCosts.count > 0)
      .map(([name, v]) => [name, {
        transactions: {
          total: v.transactions.count,
          receitas: { count: v.transactions.receitas.count, valor: Number(v.transactions.receitas.value.toFixed(2)) },
          despesas: { count: v.transactions.despesas.count, valor: Number(v.transactions.despesas.value.toFixed(2)) },
          saldo: Number((v.transactions.receitas.value - v.transactions.despesas.value).toFixed(2)),
          pagos: v.transactions.paid, pendentes: v.transactions.pending, atrasados: v.transactions.overdue,
        },
        charges: {
          total: v.charges.count,
          valor: Number(v.charges.receitas.value.toFixed(2)),
          pagos: v.charges.paid, pendentes: v.charges.pending, vencidos: v.charges.overdue,
        },
        fixedCosts: { total: v.fixedCosts.count, valor: Number(v.fixedCosts.value.toFixed(2)) },
      }]),
  ),
  totaisFinanceiros: {
    receitas: Number(totalReceitas.toFixed(2)),
    despesas: Number(totalDespesas.toFixed(2)),
    saldoLiquido: Number((totalReceitas - totalDespesas).toFixed(2)),
    movimentacao: Number((totalReceitas + totalDespesas).toFixed(2)),
    transactionsValidas: plan.records.transactions?.length ?? 0,
    chargesValidas: plan.records.charges?.length ?? 0,
    fixedCostsValidos: plan.records.fixed_costs?.length ?? 0,
  },
  quarentena: {
    total: plan.quarantine,
    transactionsSemEmpresa: transactionsWithoutCompany,
    adapterQuarantine: analysis.adapterQuarantine.length,
    planQuarantine: plan.issues.length,
    motivosAgrupados: plan.summary.errorGroups.map(g => ({
      modulo: g.module, campo: g.field, motivo: g.reason, quantidade: g.quantity,
    })),
  },
  ignorados: {
    total: plan.ignored,
    adapterIgnored: (analysis.adapterIgnored ?? []).length,
    tabelasIgnoradas: jsonAdapted.ignored.map(i => i.reason),
  },
  validacao: {
    consistent: plan.summary.consistent,
    criticalErrors: plan.summary.criticalErrors,
    ready: plan.ready,
    plannedOperations: plan.summary.plannedOperations,
    writes: (repository as unknown as { _writes: number })._writes,
    supabaseConectado: false,
  },
};

// 12. Salvar relatório
const reportPath = `C:/Users/aandr/Downloads/consolidated-dry-run-${new Date().toISOString().slice(0, 10)}.json`;
await writeFile(reportPath, JSON.stringify(report, null, 2));

// 13. Imprimir resumo
console.log('═══════════════════════════════════════════════════════════════');
console.log('  RELATÓRIO CONSOLIDADO');
console.log('═══════════════════════════════════════════════════════════════');
console.log();
console.log('┌─────────────────┬──────────┬──────────┐');
console.log('│ Módulo          │ Entrada  │ Válidos  │');
console.log('├─────────────────┼──────────┼──────────┤');
for (const [mod, counts] of Object.entries(report.totalPorModulo)) {
  console.log(`│ ${mod.padEnd(15)} │ ${String(counts.entrada).padStart(8)} │ ${String(counts.validos).padStart(8)} │`);
}
console.log('└─────────────────┴──────────┴──────────┘');
console.log();
console.log(`Período: ${report.periodo.inicio} a ${report.periodo.fim}`);
console.log();

for (const [name, data] of Object.entries(report.porEmpresa)) {
  const d = data as { transactions: { total: number; receitas: { count: number; valor: number }; despesas: { count: number; valor: number }; saldo: number }; charges: { total: number; valor: number }; fixedCosts: { total: number; valor: number } };
  console.log(`  ◆ ${name}`);
  console.log(`    Lançamentos: ${d.transactions.total}  │  Receitas: ${d.transactions.receitas.count} (R$ ${d.transactions.receitas.valor.toLocaleString('pt-BR')})  │  Despesas: ${d.transactions.despesas.count} (R$ ${d.transactions.despesas.valor.toLocaleString('pt-BR')})  │  Saldo: R$ ${d.transactions.saldo.toLocaleString('pt-BR')}`);
  console.log(`    Cobranças:   ${d.charges.total} (R$ ${d.charges.valor.toLocaleString('pt-BR')})  │  Custos fixos: ${d.fixedCosts.total} (R$ ${d.fixedCosts.valor.toLocaleString('pt-BR')})`);
  console.log();
}

console.log('  TOTAIS FINANCEIROS');
console.log(`    Receitas:      R$ ${report.totaisFinanceiros.receitas.toLocaleString('pt-BR')}`);
console.log(`    Despesas:      R$ ${report.totaisFinanceiros.despesas.toLocaleString('pt-BR')}`);
console.log(`    Saldo líquido: R$ ${report.totaisFinanceiros.saldoLiquido.toLocaleString('pt-BR')}`);
console.log(`    Movimentação:  R$ ${report.totaisFinanceiros.movimentacao.toLocaleString('pt-BR')}`);
console.log();

console.log(`  QUARENTENA: ${report.quarentena.total} registros`);
if (report.quarentena.motivosAgrupados.length) {
  for (const g of report.quarentena.motivosAgrupados) {
    console.log(`    [${g.modulo}] ${g.campo}: ${g.motivo} (×${g.quantidade})`);
  }
}
console.log();

console.log(`  VALIDAÇÃO`);
console.log(`    Consistente:       ${report.validacao.consistent}`);
console.log(`    Erros críticos:    ${report.validacao.criticalErrors}`);
console.log(`    Pronto:            ${report.validacao.ready}`);
console.log(`    Operações planej.: ${report.validacao.plannedOperations}`);
console.log(`    Writes (Supabase): ${report.validacao.writes}`);
console.log(`    Supabase conectado: ${report.validacao.supabaseConectado}`);
console.log();
console.log(`  Relatório salvo em: ${reportPath}`);
console.log('═══════════════════════════════════════════════════════════════');
