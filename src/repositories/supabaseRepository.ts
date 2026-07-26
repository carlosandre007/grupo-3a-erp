import { requireSupabase } from '../lib/supabase';
import { DataRepository, EntityRecord, RepositoryModule } from './contracts';
import{assertCompanyDeletionAllowed,assertCompanyUpdateAllowed}from'../services/companyProtection';

export class SupabaseRepository implements DataRepository {
  readonly kind = 'supabase' as const;
  async list<T extends EntityRecord>(module: RepositoryModule): Promise<T[]> {
    const { data, error } = await requireSupabase().from(module).select('*');
    if (error) throw error; return (data ?? []) as T[];
  }
  async listPage<T extends EntityRecord>(module: RepositoryModule, offset: number, limit: number, orderBy='id', ascending=true): Promise<{records:T[];total:number}> { const {data,error,count}=await requireSupabase().from(module).select('*',{count:'exact'}).order(orderBy,{ascending}).range(offset,offset+limit-1);if(error)throw error;return{records:(data??[])as T[],total:count??0}; }
  async find<T extends EntityRecord>(module: RepositoryModule, id: string): Promise<T | null> {
    const { data, error } = await requireSupabase().from(module).select('*').eq('id', id).maybeSingle();
    if (error) throw error; return data as T | null;
  }
  async create<T extends EntityRecord>(module: RepositoryModule, record: T): Promise<T> {
    const { data, error } = await requireSupabase().from(module).insert(record as never).select().single();
    if (error) throw error; return data as T;
  }
  async update<T extends EntityRecord>(module: RepositoryModule, record: T): Promise<T> {
    if(module==='companies')assertCompanyUpdateAllowed(await this.find(module,record.id),record);
    const { data, error } = await requireSupabase().from(module).update(record as never).eq('id', record.id).select().single();
    if (error) throw error; return data as T;
  }
  async remove(module: RepositoryModule, id: string): Promise<void> {
    if(module==='companies')assertCompanyDeletionAllowed(await this.find(module,id));
    const { error } = await requireSupabase().from(module).delete().eq('id', id);
    if (error) throw error;
  }
  async runAtomically<T>(_modules: RepositoryModule[], operation: () => Promise<T>): Promise<T> {
    // Multi-write business operations must call a PostgreSQL RPC; this fallback is only for single writes.
    return operation();
  }
}
