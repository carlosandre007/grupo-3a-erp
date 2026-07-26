import { DataRepository, EntityRecord, RepositoryModule } from './contracts';
import{assertCompanyDeletionAllowed,assertCompanyUpdateAllowed}from'../services/companyProtection';

const prefix = 'erp_3a_';
const keyFor = (module: RepositoryModule) => `${prefix}${module}`;

export class LocalStorageRepository implements DataRepository {
  readonly kind = 'localStorage' as const;
  async list<T extends EntityRecord>(module: RepositoryModule): Promise<T[]> {
    const value = localStorage.getItem(keyFor(module));
    return value ? JSON.parse(value) as T[] : [];
  }
  async listPage<T extends EntityRecord>(module: RepositoryModule, offset: number, limit: number, orderBy='id', ascending=true): Promise<{records:T[];total:number}> { const records=await this.list<T>(module);records.sort((a,b)=>String(a[orderBy]??'').localeCompare(String(b[orderBy]??''))*(ascending?1:-1));return{records:records.slice(offset,offset+limit),total:records.length}; }
  async find<T extends EntityRecord>(module: RepositoryModule, id: string): Promise<T | null> {
    return (await this.list<T>(module)).find(record => record.id === id) ?? null;
  }
  async create<T extends EntityRecord>(module: RepositoryModule, record: T): Promise<T> {
    const records = await this.list<T>(module);
    if (records.some(item => item.id === record.id)) throw new Error(`ID já existente em ${module}.`);
    localStorage.setItem(keyFor(module), JSON.stringify([record, ...records]));
    this.notify(module); return record;
  }
  async update<T extends EntityRecord>(module: RepositoryModule, record: T): Promise<T> {
    const records = await this.list<T>(module);
    if(module==='companies')assertCompanyUpdateAllowed(records.find(item=>item.id===record.id)!,record);
    if (!records.some(item => item.id === record.id)) throw new Error(`Registro não encontrado em ${module}.`);
    localStorage.setItem(keyFor(module), JSON.stringify(records.map(item => item.id === record.id ? record : item)));
    this.notify(module); return record;
  }
  async remove(module: RepositoryModule, id: string): Promise<void> {
    const records = await this.list(module);
    if(module==='companies')assertCompanyDeletionAllowed(records.find(item=>item.id===id));
    localStorage.setItem(keyFor(module), JSON.stringify(records.filter(item => item.id !== id)));
    this.notify(module);
  }
  async runAtomically<T>(modules: RepositoryModule[], operation: () => Promise<T>): Promise<T> {
    const snapshots = new Map(modules.map(module => [module, localStorage.getItem(keyFor(module))]));
    try { return await operation(); }
    catch (error) {
      snapshots.forEach((snapshot, module) => snapshot === null ? localStorage.removeItem(keyFor(module)) : localStorage.setItem(keyFor(module), snapshot));
      throw error;
    }
  }
  private notify(module: RepositoryModule) {
    window.dispatchEvent(new CustomEvent('erp-data-updated', { detail: { module } }));
  }
}
