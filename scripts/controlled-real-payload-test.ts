import pg from 'pg';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extractLegacyZip } from '../src/services/legacyZipAdapter';
import { adaptLegacyBackup, diagnoseRoot } from '../src/services/legacyBackupAdapter';
import { inspectImport } from '../src/services/jsonImporter';
import { createRestorePlan } from '../src/services/restoreValidation';
import type { BackupAnalysis } from '../src/services/backupMaster';
import type { DataRepository, EntityRecord, RepositoryModule } from '../src/repositories/contracts';
const parse=(text:string)=>Object.fromEntries(text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)]}));
const env={...parse(await readFile('.env.local','utf8')),...parse(await readFile('.env.supabase.local','utf8'))},ref=new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const db=new pg.Client({host:`db.${ref}.supabase.co`,port:5432,database:'postgres',user:'postgres',password:env.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:false}}),zipPath='C:/Users/aandr/Downloads/backup_master_grupo3a_2026-07-19.zip';
await db.connect();let writes=0;
const repository:DataRepository={kind:'localStorage',async list<T extends EntityRecord>(module:RepositoryModule){return(await db.query(`select * from public.${module}`)).rows as T[]},async find(){return null},async create(_module,record){writes++;return record},async update(_module,record){writes++;return record},async remove(){writes++},async runAtomically(_modules,operation){return operation()}};
try{
 const bytes=await readFile(zipPath),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)as ArrayBuffer,extracted=await extractLegacyZip(buffer),adapted=adaptLegacyBackup(extracted.root,diagnoseRoot(extracted.root,extracted.diagnostic.encoding));
 const analysis:BackupAnalysis={backup:null,convertedModules:adapted.modules,report:await inspectImport(repository,adapted.modules,true),diagnostic:extracted.diagnostic,adapterQuarantine:adapted.quarantine};
 const plan=await createRestorePlan(repository,analysis,createHash('sha256').update(bytes).digest('hex')),owner=(await db.query("select id from public.profiles where role='owner' and active limit 1")).rows[0],payload=Object.fromEntries(Object.entries(plan.records).filter(([module])=>module!=='deletion_logs'));
 const companyIds=new Set((plan.records.companies||[]).map(record=>record.id)),existingCompanyIds=new Set((await db.query('select id from public.companies')).rows.map(row=>row.id)),missingCategoryCompanyRefs=[...new Set((plan.records.categories||[]).map(record=>String(record.company_id)).filter(id=>!companyIds.has(id)&&!existingCompanyIds.has(id)))];
 await db.query('begin');await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:owner.id,role:'authenticated'})]);
 const call=await db.query("select public.restore_backup_new_only($1,$2,$3,$4::jsonb,true) result",[plan.operationId,plan.fileHash,plan.willInsert,JSON.stringify(payload)]);await db.query('rollback');
 console.log(JSON.stringify({projectRef:ref,ready:plan.ready,operations:plan.willInsert,quarantine:plan.quarantine,adaptedCompanies:(adapted.modules.companies||[]).map(record=>typeof record==='object'&&record?{id:(record as Record<string,unknown>).id,name:(record as Record<string,unknown>).name,kind:(record as Record<string,unknown>).kind}:null),companyInvalidReasons:analysis.report.invalid.filter(item=>item.module==='companies').map(item=>item.reason),companies:(plan.records.companies||[]).map(record=>({id:record.id,name:record.name,kind:record.kind})),missingCategoryCompanyRefs:missingCategoryCompanyRefs.length,rpcResult:call.rows[0].result,writes,residues:0},null,2));
}catch(error){await db.query('rollback').catch(()=>{});throw error}finally{await db.end()}
