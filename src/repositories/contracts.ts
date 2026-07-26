export type RepositoryModule =
  | 'companies' | 'categories' | 'clients' | 'assets' | 'properties' | 'vehicles'
  | 'bank_accounts' | 'bank_movements' | 'transactions' | 'charges' | 'recurring_series'
  | 'fixed_costs' | 'investments' | 'alerts' | 'deletion_logs' | 'receipts' | 'company_metrics';

export interface EntityRecord { id: string; [key: string]: unknown }

export interface DataRepository {
  readonly kind: 'localStorage' | 'supabase';
  list<T extends EntityRecord>(module: RepositoryModule): Promise<T[]>;
  listPage?<T extends EntityRecord>(module: RepositoryModule, offset: number, limit: number, orderBy?: string, ascending?: boolean): Promise<{ records:T[]; total:number }>;
  find<T extends EntityRecord>(module: RepositoryModule, id: string): Promise<T | null>;
  create<T extends EntityRecord>(module: RepositoryModule, record: T): Promise<T>;
  update<T extends EntityRecord>(module: RepositoryModule, record: T): Promise<T>;
  remove(module: RepositoryModule, id: string): Promise<void>;
  runAtomically<T>(modules: RepositoryModule[], operation: () => Promise<T>): Promise<T>;
}
