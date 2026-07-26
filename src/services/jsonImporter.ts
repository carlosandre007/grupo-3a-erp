import { DataRepository, EntityRecord, RepositoryModule } from '../repositories';

export type ImportMode = 'new_only';
export type ImportIssue = { module: RepositoryModule; index: number; reason: string; record: unknown };
export type ImportReport = { mode: ImportMode; dryRun: boolean; valid: Record<string, number>; duplicates: Record<string, number>; conflicts: ImportIssue[]; invalid: ImportIssue[]; accepted: Partial<Record<RepositoryModule,EntityRecord[]>> };
const modules: RepositoryModule[] = ['companies', 'categories', 'clients', 'assets', 'properties', 'vehicles', 'bank_accounts', 'bank_movements', 'recurring_series', 'fixed_costs', 'investments', 'charges', 'transactions', 'alerts', 'receipts', 'company_metrics', 'deletion_logs'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const required:Partial<Record<RepositoryModule,string[]>>={companies:['id','name','kind'],categories:['id','company_id','name'],clients:['id','company_id','name'],assets:['id','company_id','asset_type','name','status'],properties:['id','address'],vehicles:['id','plate','model'],bank_accounts:['id','company_id','bank_name','account_name','account_type','initial_balance','initial_balance_date'],bank_movements:['id','company_id','account_id','movement_type','value','movement_date','description'],transactions:['id','company_id','category_id','type','status','description','value','transaction_date'],charges:['id','company_id','category_id','client_id','asset_id','due_date','description','value','status'],recurring_series:['id','company_id','frequency'],fixed_costs:['id','company_id','category_id','description','value','due_day','frequency','start_date','next_due_date'],investments:['id','company_id','category_id','description','value','investment_date'],company_metrics:['id','company_id','metric_key']};
const stable = (value: unknown) => JSON.stringify(value, Object.keys((value ?? {}) as object).sort());

export async function inspectImport(repository: DataRepository, input: unknown, dryRun = true): Promise<ImportReport> {
  const report: ImportReport = { mode: 'new_only', dryRun, valid: {}, duplicates: {}, conflicts: [], invalid: [], accepted: {} };
  const deferredChargeLinks: EntityRecord[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('O backup deve ser um objeto JSON separado por módulo.');
  const source = input as Record<string, unknown>;
  for (const module of modules) {
    const incoming = source[module]; if (incoming === undefined) continue;
    if (!Array.isArray(incoming)) { report.invalid.push({ module, index: -1, reason: 'O módulo deve ser uma lista.', record: incoming }); continue; }
    const existing = await repository.list(module); const accepted: EntityRecord[] = [];
    incoming.forEach((record, index) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return report.invalid.push({ module, index, reason: 'Registro não é um objeto.', record });
      const entity = record as EntityRecord;
      if (typeof entity.id !== 'string' || !uuid.test(entity.id)) return report.invalid.push({ module, index, reason: 'UUID ausente ou inválido.', record });
      const missing=(required[module]||[]).filter(field=>entity[field]===undefined||entity[field]===null||entity[field]==='');
      if(missing.length)return report.invalid.push({module,index,reason:`Campo obrigatório ausente: ${missing.join(', ')}.`,record});
      const current = existing.find(item => item.id === entity.id);
      if (current && stable(current) === stable(entity)) { report.duplicates[module] = (report.duplicates[module] || 0) + 1; return; }
      if (current) return report.conflicts.push({ module, index, reason: 'ID existente com conteúdo diferente; enviado à quarentena.', record });
      if (!current) accepted.push(entity);
    });
    report.valid[module] = accepted.length;
    report.accepted[module] = accepted;
    if (!dryRun && !report.invalid.some(issue => issue.module === module)) for (let index=0;index<accepted.length;index+=100) for (const record of accepted.slice(index,index+100)) {
      if(module==='charges'&&record.transaction_id){deferredChargeLinks.push(record);const{transaction_id:_transactionId,...charge}=record;await repository.create(module,charge as EntityRecord);}
      else await repository.create(module, record);
    }
  }
  if(!dryRun)for(const charge of deferredChargeLinks)await repository.update('charges',charge);
  return report;
}

// Import is never started automatically. Callers must explicitly run dry-run first and confirm each module.
