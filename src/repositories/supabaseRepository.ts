import { requireSupabase } from '../lib/supabase';
import { DataRepository, EntityRecord, RepositoryModule } from './contracts';
import { adaptChargeToAgenda } from '../services/chargeAgendaAdapter';

const sourceTables:Partial<Record<RepositoryModule,string>>={
  bank_accounts:'banks',
  vehicles:'motorcycles',
};
const absentLegacyModules=new Set<RepositoryModule>([
  'assets','bank_movements','recurring_series','investments','alerts',
  'deletion_logs','receipts','company_metrics',
]);
const sourceTable=(module:RepositoryModule)=>sourceTables[module]??module;
const sourceOrder=(module:RepositoryModule,orderBy:string)=>
  module==='transactions'&&orderBy==='transaction_date'?'date':orderBy;
const financialType=(value:unknown)=>{
  const normalized=String(value??'').toLowerCase();
  return['in','income','entrada','receita','revenue'].includes(normalized)?'receita':
    ['out','expense','saida','despesa'].includes(normalized)?'despesa':normalized;
};
const financialStatus=(value:unknown)=>{
  const normalized=String(value??'').toLowerCase();
  return['confirmed','received','paid','pago'].includes(normalized)?'pago':
    ['pending','pendente'].includes(normalized)?'pendente':
    ['overdue','late','atrasado','vencido'].includes(normalized)?'atrasado':normalized;
};
const normalizeRecord=(module:RepositoryModule,row:EntityRecord):EntityRecord=>{
  if(module==='transactions')return{
    ...row,
    transaction_date:row.transaction_date??row.date,
    bank_account_id:row.bank_account_id??row.id_conta,
    type:financialType(row.type),
    status:financialStatus(row.status),
  };
  if(module==='categories')return{
    ...row,
    type:financialType(row.type),
    active:row.active??row.is_active,
  };
  if(module==='clients')return{
    ...row,
    name:row.name??row.nome,
    email:row.email??row.email_address,
    phone:row.phone??row.telefone,
    document:row.document??row.cpf??row.cnpj,
    person_type:row.person_type??(row.cnpj?'PJ':'PF'),
    address:row.address??row.endereco,
    cnh_number:row.cnh_number??row.cnh,
    cnh_expiry:row.cnh_expiry??row.cnh_validade,
  };
  if(module==='bank_accounts')return{
    ...row,
    bank_name:row.bank_name??row.banco??row.name,
    account_name:row.account_name??row.name,
    account_type:row.account_type??row.tipo_conta,
    initial_balance:row.initial_balance??row.balance,
    current_balance:row.current_balance??Number(row.balance??0)+Number(row.secondary_balance??0),
  };
  if(module==='properties')return{
    ...row,
    name:row.name??row.description,
    rent_value:row.rent_value??row.value,
    purchase_value:row.purchase_value??row.valor_patrimonial,
    current_value:row.current_value??row.valor_atual,
    acquisition_date:row.acquisition_date??row.data_aquisicao,
    status:String(row.status??'').toLowerCase()==='rented'?'alugado':row.status,
  };
  if(module==='vehicles')return{
    ...row,
    model:row.model??row.description??row.name,
    purchase_value:row.purchase_value??row.valor_patrimonial??row.value,
    current_value:row.current_value??row.valor_atual,
    acquisition_date:row.acquisition_date??row.data_aquisicao,
    rental_value:row.rental_value??row.valor_aluguel??row.rent_value,
    status:String(row.status??'').toLowerCase()==='rented'?'locado':row.status,
  };
  if(module==='charges')return adaptChargeToAgenda(row);
  if(module==='fixed_costs')return{
    ...row,
    description:row.description??row.name,
    value:row.value??row.total??row.price,
    next_due_date:row.next_due_date??row.due_date,
    start_date:row.start_date??row.created_at,
    active:row.active??!['inactive','paused','cancelled','encerrado'].includes(String(row.status??'').toLowerCase()),
    frequency:row.frequency??(row.is_recurrent?'mensal':'unica'),
  };
  return row;
};
const normalizeRecords=<T extends EntityRecord>(module:RepositoryModule,rows:EntityRecord[])=>
  rows.map(row=>normalizeRecord(module,row)) as T[];
const readCache=new Map<RepositoryModule,{expires:number;records:EntityRecord[]}>();
const pendingReads=new Map<RepositoryModule,Promise<EntityRecord[]>>();
const CACHE_TTL_MS=5*60_000;
export const clearSupabaseReadCache=()=>{readCache.clear();pendingReads.clear()};

export class SupabaseRepository implements DataRepository {
  readonly kind = 'supabase' as const;
  async list<T extends EntityRecord>(module: RepositoryModule): Promise<T[]> {
    if(absentLegacyModules.has(module))return[];
    const cached=readCache.get(module);
    if(cached&&cached.expires>Date.now())return cached.records as T[];
    const pending=pendingReads.get(module);
    if(pending)return pending as Promise<T[]>;
    const request=(async()=>{
      const records:EntityRecord[]=[];
      const orderBy=sourceOrder(module,module==='transactions'?'transaction_date':'id');
      for(let offset=0;;offset+=1000){
        const{data,error}=await requireSupabase().from(sourceTable(module)).select('*').order(orderBy,{ascending:true}).range(offset,offset+999);
        if(error)throw error;
        const page=(data??[])as EntityRecord[];
        records.push(...page);
        if(page.length<1000)break;
      }
      const normalized=normalizeRecords<EntityRecord>(module,records);
      readCache.set(module,{expires:Date.now()+CACHE_TTL_MS,records:normalized});
      return normalized;
    })();
    pendingReads.set(module,request);
    try{return await request as T[]}finally{pendingReads.delete(module)}
  }
  async listPage<T extends EntityRecord>(module: RepositoryModule, offset: number, limit: number, orderBy='id', ascending=true): Promise<{records:T[];total:number}> {
    const records=await this.list<T>(module);
    const sorted=[...records].sort((left,right)=>{
      const a=String(left[orderBy]??''),b=String(right[orderBy]??'');
      return(ascending?1:-1)*a.localeCompare(b);
    });
    return{records:sorted.slice(offset,offset+limit),total:records.length};
  }
  async find<T extends EntityRecord>(module: RepositoryModule, id: string): Promise<T | null> {
    if(absentLegacyModules.has(module))return null;
    const { data, error } = await requireSupabase().from(sourceTable(module)).select('*').eq('id', id).maybeSingle();
    if (error) throw error; return data?normalizeRecord(module,data as EntityRecord) as T:null;
  }
  async create<T extends EntityRecord>(module: RepositoryModule, record: T): Promise<T> {
    void module;void record;
    throw new Error('Modo somente leitura: gravações no Supabase existente estão bloqueadas.');
  }
  async update<T extends EntityRecord>(module: RepositoryModule, record: T): Promise<T> {
    void module;void record;
    throw new Error('Modo somente leitura: alterações no Supabase existente estão bloqueadas.');
  }
  async remove(module: RepositoryModule, id: string): Promise<void> {
    void module;void id;
    throw new Error('Modo somente leitura: exclusões no Supabase existente estão bloqueadas.');
  }
  async runAtomically<T>(_modules: RepositoryModule[], operation: () => Promise<T>): Promise<T> {
    // Multi-write business operations must call a PostgreSQL RPC; this fallback is only for single writes.
    return operation();
  }
}
