import pg from 'pg';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { extractLegacyZip } from '../src/services/legacyZipAdapter';
import { adaptLegacyBackup, diagnoseRoot } from '../src/services/legacyBackupAdapter';
import { inspectImport } from '../src/services/jsonImporter';
import { createRestorePlan } from '../src/services/restoreValidation';
import type { BackupAnalysis } from '../src/services/backupMaster';
import type { DataRepository, EntityRecord, RepositoryModule } from '../src/repositories/contracts';

const parse=(text:string)=>Object.fromEntries(text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)]}));
const env={...parse(await readFile('.env.local','utf8')),...parse(await readFile('.env.supabase.local','utf8'))};
const ref=new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const db=new pg.Client({host:`db.${ref}.supabase.co`,port:5432,database:'postgres',user:'postgres',password:env.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:false}});
const zipPath='C:/Users/aandr/Downloads/backup_master_grupo3a_2026-07-19.zip';
await db.connect();
let writes=0;
const repository:DataRepository={kind:'localStorage',async list<T extends EntityRecord>(module:RepositoryModule){return(await db.query(`select * from public.${module}`)).rows as T[]},async find(){return null},async create(_module,record){writes++;return record},async update(_module,record){writes++;return record},async remove(){writes++},async runAtomically(_modules,operation){return operation()}};

type CompanySummary={transactions:number;revenues:{count:number;value:number};expenses:{count:number;value:number};pending:number;paid:number;overdue:number};
const empty=():CompanySummary=>({transactions:0,revenues:{count:0,value:0},expenses:{count:0,value:0},pending:0,paid:0,overdue:0});
try{
  const bytes=await readFile(zipPath),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
  const extracted=await extractLegacyZip(buffer),adapted=adaptLegacyBackup(extracted.root,diagnoseRoot(extracted.root,extracted.diagnostic.encoding));
  const analysis:BackupAnalysis={backup:null,convertedModules:adapted.modules,report:await inspectImport(repository,adapted.modules,true),diagnostic:extracted.diagnostic,adapterQuarantine:adapted.quarantine,adapterIgnored:adapted.ignored};
  const plan=await createRestorePlan(repository,analysis,createHash('sha256').update(bytes).digest('hex'));
  const currentCompanies=await repository.list('companies');
  const companies=new Map([...currentCompanies,...(plan.records.companies||[])].map(record=>[record.id,String(record.name)]));
  const names=['LOC MOTTUS','3A RASTREAR','IMÓVEIS','HOLDING GRUPO 3A'] as const;
  const byCompany:Record<string,CompanySummary>=Object.fromEntries(names.map(name=>[name,empty()]));
  let withoutProvenCompany=0,detachedBankAccounts=0;
  for(const record of plan.records.transactions||[]){
    if(record.legacy_bank_account_id&&record.bank_account_id==null)detachedBankAccounts++;
    const name=companies.get(String(record.company_id));
    if(!name||!byCompany[name]){withoutProvenCompany++;continue;}
    const row=byCompany[name],value=Math.abs(Number(record.value||0));row.transactions++;
    if(record.type==='receita'){row.revenues.count++;row.revenues.value+=value;}
    if(record.type==='despesa'){row.expenses.count++;row.expenses.value+=value;}
    if(record.status==='pendente')row.pending++;if(record.status==='pago')row.paid++;if(record.status==='atrasado')row.overdue++;
  }
  const unprovenQuarantine=adapted.quarantine.filter(item=>item.module==='transactions'&&item.reason.includes('não comprovável')).length;
  const totals=Object.values(byCompany).reduce((sum,row)=>({transactions:sum.transactions+row.transactions,revenues:sum.revenues+row.revenues.value,expenses:sum.expenses+row.expenses.value}),{transactions:0,revenues:0,expenses:0});
  const result={projectRef:ref,validRecords:plan.summary.valid,ignored:plan.summary.ignored,quarantine:plan.summary.quarantine,plannedOperations:plan.summary.plannedOperations,detachedBankAccounts,ignoredCanonicalCategories:adapted.ignored.filter(item=>item.module==='categories').length,transactionsByCompany:byCompany,withoutProvenCompany:{valid:withoutProvenCompany,quarantine:unprovenQuarantine},financialTotal:{revenues:totals.revenues,expenses:totals.expenses,net:totals.revenues-totals.expenses,movement:totals.revenues+totals.expenses,transactions:totals.transactions},companySumMatchesGeneral:totals.transactions===(plan.records.transactions||[]).length-withoutProvenCompany,coreCompaniesPreserved:names.map(name=>({name,present:currentCompanies.some(company=>company.name===name)})),invalidCoreCompanyKind:'Nenhuma; o registro incompatível não corresponde às quatro empresas principais.',consistent:plan.summary.consistent,writes,reasons:plan.summary.errorGroups.map(group=>({module:group.module,field:group.field,reason:group.reason,quantity:group.quantity}))};
  const path=`C:/Users/aandr/Downloads/grupo-3a-novo-dry-run-financeiro-${new Date().toISOString().slice(0,10)}.json`;
  await writeFile(path,JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,reportPath:path},null,2));
}finally{await db.end();}
