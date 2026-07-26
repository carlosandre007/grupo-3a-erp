import type { DataRepository, EntityRecord, RepositoryModule } from '../repositories';
import type { BackupAnalysis } from './backupMaster';

export type RestoreIssue = { severity:'critical'|'quarantine'; module:string; index:number; code:string; field:string; message:string };
export type ValidationCount = { module:string; total:number; valid:number; duplicates:number; conflicts:number; invalid:number; prohibited:number };
export type ErrorGroup = { module:string; field:string; reason:string; code:string; quantity:number };
export type CanonicalValidation = {
  modules:ValidationCount[];
  total:number; valid:number; duplicates:number; conflicts:number; invalid:number;
  ready:number; quarantine:number; prohibited:number; ignored:number;
  technicalGenerated:number; plannedOperations:number;
  criticalErrors:number; errorGroups:ErrorGroup[]; consistent:boolean;
};
export type RestorePlan = { operationId:string; fileHash:string; policy:'new_only'; ready:boolean; willInsert:number; ignored:number; quarantine:number; affectedModules:RepositoryModule[]; dependencyOrder:RepositoryModule[]; issues:RestoreIssue[]; summary:CanonicalValidation; records:Partial<Record<RepositoryModule,EntityRecord[]>> };

const order:RepositoryModule[]=['companies','categories','clients','assets','properties','vehicles','bank_accounts','bank_movements','recurring_series','fixed_costs','charges','transactions','investments','alerts','receipts','company_metrics'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,date=/^\d{4}-\d{2}-\d{2}$/;
const relations:Partial<Record<RepositoryModule,Array<[string,RepositoryModule,boolean]>>>={categories:[['company_id','companies',false]],clients:[['company_id','companies',false]],assets:[['company_id','companies',false]],properties:[['id','assets',false]],vehicles:[['id','assets',false]],bank_accounts:[['company_id','companies',false]],bank_movements:[['company_id','companies',false],['account_id','bank_accounts',false]],recurring_series:[['company_id','companies',false]],fixed_costs:[['company_id','companies',false],['category_id','categories',false],['bank_account_id','bank_accounts',true],['current_transaction_id','transactions',true]],charges:[['company_id','companies',false],['category_id','categories',false],['client_id','clients',false],['asset_id','assets',false],['series_id','recurring_series',true]],transactions:[['company_id','companies',false],['category_id','categories',false],['client_id','clients',true],['asset_id','assets',true],['bank_account_id','bank_accounts',true],['charge_id','charges',true],['series_id','recurring_series',true]],investments:[['company_id','companies',false],['category_id','categories',false],['asset_id','assets',true]],alerts:[['company_id','companies',false]],receipts:[['company_id','companies',false],['charge_id','charges',false],['transaction_id','transactions',false]],company_metrics:[['company_id','companies',false]]};
const statuses:Partial<Record<RepositoryModule,Record<string,string[]>>>={companies:{kind:['loc_mottus','rastrear','imoveis','holding']},categories:{type:['receita','despesa']},assets:{status:['ativo','disponivel','manutencao','locado','alugado']},transactions:{status:['pago','pendente','atrasado','cancelado'],type:['receita','despesa']},charges:{status:['pago','pendente','vencido','cancelado']}};
const dateFields=['due_date','competency_date','transaction_date','initial_balance_date','movement_date','start_date','end_date','next_due_date','investment_date','acquisition_date','ipva_due_date','licensing_due_date','annual_adjustment_date','contract_end_date'];
const moneyFields=['value','initial_balance','purchase_value','current_value','rent_value','rental_value','total','available','installed','maintenance'];
const credentialKey=(key:string)=>/(password|passwd|senha|secret|token|credential)/i.test(key);
const containsCredential=(value:unknown):boolean=>Boolean(value&&typeof value==='object'&&Object.entries(value as Record<string,unknown>).some(([key,nested])=>credentialKey(key)||containsCredential(nested)));
const validDate=(value:unknown)=>typeof value==='string'&&date.test(value)&&!Number.isNaN(new Date(`${value}T12:00:00`).getTime())&&new Date(`${value}T12:00:00`).toISOString().slice(0,10)===value;
const fieldFrom=(message:string)=>message.match(/ausente:\s*([^.]+)/i)?.[1].trim()||message.match(/(?:em|inexistente:)\s*([\w_]+)/i)?.[1]||'registro';
const groupErrors=(issues:RestoreIssue[]):ErrorGroup[]=>{
  const groups=new Map<string,ErrorGroup>();
  for(const issue of issues){const key=[issue.module,issue.field,issue.code,issue.message].join('|'),current=groups.get(key);if(current)current.quantity++;else groups.set(key,{module:issue.module,field:issue.field,reason:issue.message,code:issue.code,quantity:1});}
  return [...groups.values()].sort((a,b)=>b.quantity-a.quantity||a.module.localeCompare(b.module));
};

export async function createRestorePlan(repository:DataRepository,analysis:BackupAnalysis,fileHash:string):Promise<RestorePlan>{
 const issues:RestoreIssue[]=analysis.adapterQuarantine.map(item=>({severity:'quarantine',module:item.module,index:item.index,code:'PROHIBITED_OR_INCOMPATIBLE',field:'registro',message:item.reason}));
 const existingIds=new Map<RepositoryModule,Set<string>>(),incomingIds=new Map<RepositoryModule,Set<string>>(),candidates:Partial<Record<RepositoryModule,EntityRecord[]>>={};
 for(const module of order){existingIds.set(module,new Set((await repository.list(module)).map(record=>record.id)));const source=analysis.report.accepted[module]||[];candidates[module]=source;incomingIds.set(module,new Set(source.map(record=>record.id)));}
 const rejected=new Set<string>();
 const critical=(module:RepositoryModule,index:number,code:string,field:string,message:string)=>{issues.push({severity:'quarantine',module,index,code,field,message});rejected.add(`${module}:${index}`);};
 for(const module of order){const seen=new Set<string>();(candidates[module]||[]).forEach((record,index)=>{
  if(typeof record.id!=='string'||!uuid.test(record.id))return critical(module,index,'INVALID_UUID','id','UUID ausente ou inválido.');
  if(seen.has(record.id))return critical(module,index,'DUPLICATE_UUID','id','UUID duplicado no arquivo.');seen.add(record.id);
  if(existingIds.get(module)!.has(record.id))critical(module,index,'PLAN_DIVERGENCE','id','ID passou pelo dry-run, mas já existe no destino.');
  if(containsCredential(record))critical(module,index,'CREDENTIAL_FOUND','credencial','Campo de senha, token ou credencial detectado.');
  for(const field of dateFields)if(record[field]!=null&&!validDate(record[field]))critical(module,index,'INVALID_DATE',field,'Data inválida.');
  for(const field of moneyFields)if(record[field]!=null&&(typeof record[field]!=='number'||!Number.isFinite(record[field] as number)||(record[field] as number)<0))critical(module,index,'INVALID_MONEY',field,'Valor monetário inválido.');
  for(const[field,allowed]of Object.entries(statuses[module]||{}))if(record[field]!=null&&!allowed.includes(String(record[field])))critical(module,index,'INVALID_STATUS',field,'Status ou tipo não reconhecido.');
 });}
 let dependencyChanged=true;while(dependencyChanged){dependencyChanged=false;const available=new Map<RepositoryModule,Set<string>>();for(const module of order)available.set(module,new Set([...(existingIds.get(module)||[]),...(candidates[module]||[]).filter((_record,index)=>!rejected.has(`${module}:${index}`)).map(record=>record.id)]));for(const module of order)(candidates[module]||[]).forEach((record,index)=>{if(rejected.has(`${module}:${index}`))return;for(const[field,target,optional]of relations[module]||[]){const value=record[field];if((value==null||value==='')&&optional)continue;if(typeof value!=='string'||!available.get(target)?.has(value)){critical(module,index,'MISSING_RELATION',field,`Relacionamento inexistente com ${target}.`);dependencyChanged=true;break;}}});}
 analysis.report.invalid.forEach(item=>issues.push({severity:'quarantine',module:item.module,index:item.index,code:'SOURCE_INVALID',field:fieldFrom(item.reason),message:item.reason}));
 analysis.report.conflicts.forEach(item=>issues.push({severity:'quarantine',module:item.module,index:item.index,code:'ID_CONFLICT',field:'id',message:item.reason}));
 const records:RestorePlan['records']={};for(const module of order)records[module]=(candidates[module]||[]).filter((_record,index)=>!rejected.has(`${module}:${index}`));
 const adapterIgnored=analysis.adapterIgnored||[],moduleNames=new Set<string>([...order.filter(module=>module!=='assets'),...analysis.adapterQuarantine.map(item=>item.module).filter(module=>module!=='assets'),...adapterIgnored.map(item=>item.module).filter(module=>module!=='assets')]),moduleCounts:ValidationCount[]=[];
 for(const module of moduleNames){const rejectedIndexes=new Set(issues.filter(i=>i.module===module&&!['SOURCE_INVALID','ID_CONFLICT','PROHIBITED_OR_INCOMPATIBLE'].includes(i.code)).map(i=>i.index)),adapter=analysis.adapterQuarantine.filter(i=>i.module===module).length,candidateCount=analysis.report.valid[module]||0,conflicts=analysis.report.conflicts.filter(i=>i.module===module).length,baseInvalid=analysis.report.invalid.filter(i=>i.module===module).length,duplicates=(analysis.report.duplicates[module]||0)+adapterIgnored.filter(i=>i.module===module).length,valid=Math.max(0,candidateCount-rejectedIndexes.size),sourceInvalid=order.includes(module as RepositoryModule)?baseInvalid+adapter:Math.max(baseInvalid,adapter),invalid=sourceInvalid+rejectedIndexes.size;moduleCounts.push({module,total:valid+duplicates+conflicts+invalid,valid,duplicates,conflicts,invalid,prohibited:adapter});}
 const declaredCounts=analysis.diagnostic.moduleCounts||{};
 for(const row of moduleCounts){const declared=declaredCounts[row.module];if(typeof declared==='number'&&declared>row.total){const compatibleMetadata=declared-row.total;row.valid+=compatibleMetadata;row.total+=compatibleMetadata;}}
 if(analysis.diagnostic.metadataPath)moduleCounts.push({module:'metadata',total:1,valid:1,duplicates:0,conflicts:0,invalid:0,prohibited:0});
 const totals=moduleCounts.reduce((a,m)=>({total:a.total+m.total,valid:a.valid+m.valid,duplicates:a.duplicates+m.duplicates,conflicts:a.conflicts+m.conflicts,invalid:a.invalid+m.invalid,prohibited:a.prohibited+m.prohibited}),{total:0,valid:0,duplicates:0,conflicts:0,invalid:0,prohibited:0});
 const quarantine=totals.conflicts+totals.invalid,ignored=totals.duplicates,technicalGenerated=records.assets?.length||0,plannedOperations=totals.valid+technicalGenerated;
 const metadataRecords=analysis.diagnostic.metadataPath?1:0,consistent=totals.total===totals.valid+totals.duplicates+totals.conflicts+totals.invalid&&totals.valid===Object.entries(records).filter(([module])=>module!=='assets').reduce((n,[,list])=>n+(list?.length||0),0)+metadataRecords&&quarantine===totals.conflicts+totals.invalid;
 const criticalErrors=consistent?0:1;
 const summary:CanonicalValidation={modules:moduleCounts,...totals,ready:totals.valid,quarantine,ignored,technicalGenerated,plannedOperations,criticalErrors,errorGroups:groupErrors(issues),consistent};
 const affectedModules=order.filter(module=>(records[module]?.length||0)>0),ready=summary.ready>0&&summary.criticalErrors===0&&summary.consistent;
 return{operationId:crypto.randomUUID(),fileHash,policy:'new_only',ready,willInsert:summary.plannedOperations,ignored:summary.ignored,quarantine:summary.quarantine,affectedModules,dependencyOrder:order,issues,summary,records};
}

export async function executeRestorePlan(repository:DataRepository,plan:RestorePlan,onBatch?:(module:RepositoryModule,batch:number,count:number)=>void){
 const recordTotal=Object.values(plan.records).reduce((n,list)=>n+(list?.length||0),0)+(plan.summary.modules.some(row=>row.module==='metadata')?1:0);
 if(!plan.ready||!plan.summary.consistent||plan.summary.criticalErrors>0||plan.willInsert!==plan.summary.plannedOperations||recordTotal!==plan.summary.plannedOperations||plan.quarantine!==plan.summary.quarantine)throw new Error('Restauração bloqueada: plano e dry-run não são canônicos ou contêm erros globais.');
 if(repository.kind==='supabase')throw new Error('Modo somente leitura: restauração remota desativada para preservar o database existente.');
 const modules=plan.affectedModules;return repository.runAtomically(modules,async()=>{const before=new Map<RepositoryModule,number>();for(const module of modules)before.set(module,(await repository.list(module)).length);for(const module of plan.dependencyOrder){const list=plan.records[module]||[];for(let index=0;index<list.length;index+=100){const batch=list.slice(index,index+100);for(const record of batch)await repository.create(module,record);onBatch?.(module,index/100+1,batch.length);}}for(const module of modules){const expected=(before.get(module)||0)+(plan.records[module]?.length||0),actual=(await repository.list(module)).length;if(actual!==expected)throw new Error(`Total divergente após restauração em ${module}.`);}return{operationId:plan.operationId,status:'completed',inserted:plan.willInsert};});
}
export const restoreAuthorizationValid=(role:string|undefined,passwordConfirmed:boolean,phrase:string)=>role==='owner'&&passwordConfirmed&&phrase==='RESTAURAR BACKUP';
