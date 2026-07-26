import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';
import JSZip from 'jszip';
import { repository, RepositoryModule } from '../repositories';
import { ImportReport, inspectImport } from './jsonImporter';
import { adaptLegacyBackup, BackupDiagnostic, diagnoseRoot } from './legacyBackupAdapter';
import { adaptLegacyZip } from './legacyZipAdapter';

export const BACKUP_FORMAT='GRUPO_3A_ERP_BACKUP_MASTER',BACKUP_VERSION='1.0.0';
export const backupModules:RepositoryModule[]=['companies','categories','clients','assets','properties','vehicles','bank_accounts','bank_movements','recurring_series','fixed_costs','charges','transactions','investments','alerts','receipts','company_metrics'];
export type MasterBackup={format:string;version:string;exportedAt:string;mode:'new_only';modules:Partial<Record<RepositoryModule,unknown[]>>;integrity:{algorithm:'SHA-256';hash:string}};
export type BackupAnalysis={backup:MasterBackup|null;convertedModules:Partial<Record<RepositoryModule,unknown[]>>;report:ImportReport;diagnostic:BackupDiagnostic;adapterQuarantine:Array<{module:string;index:number;reason:string}>;adapterIgnored?:Array<{module:string;index:number;reason:string}>};
const encode=(value:string)=>new TextEncoder().encode(value);
const hex=(bytes:Uint8Array)=>Array.from(bytes).map(byte=>byte.toString(16).padStart(2,'0')).join('');
export const sha256=async(value:string|ArrayBuffer)=>{
  const bytes=typeof value==='string'?encode(value):new Uint8Array(value);
  const webDigest=globalThis.crypto?.subtle?.digest;
  if(webDigest){
    try{return hex(new Uint8Array(await webDigest.call(globalThis.crypto.subtle,'SHA-256',bytes)));}
    catch{/* Contextos HTTP e WebViews podem expor SubtleCrypto sem permitir digest. */}
  }
  return hex(nobleSha256(bytes));
};
const payloadOf=(backup:Omit<MasterBackup,'integrity'>)=>JSON.stringify(backup);
export async function createMasterBackup(selectedModules:RepositoryModule[]=backupModules):Promise<MasterBackup>{const modules:MasterBackup['modules']={};for(const module of selectedModules)modules[module]=await repository.list(module);const payload={format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt:new Date().toISOString(),mode:'new_only' as const,modules};return{...payload,integrity:{algorithm:'SHA-256',hash:await sha256(payloadOf(payload))}};}

type FinancialRow={date?:unknown;transaction_date?:unknown;type?:unknown;[key:string]:unknown};
export type MasterBackupZip={buffer:ArrayBuffer;sha256:string;total:number;revenues:number;expenses:number;lastDate:string};
const expectedFinancial={total:1290,revenues:700,expenses:590,lastDate:'2026-07-23'};
const normalizedType=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const isRevenue=(row:FinancialRow)=>['in','receita','entrada','credito'].includes(normalizedType(row.type));
const isExpense=(row:FinancialRow)=>['out','despesa','saida','debito'].includes(normalizedType(row.type));
const rowDate=(row:FinancialRow)=>String(row.transaction_date??row.date??'');
const fetchAll=async(module:RepositoryModule)=>{
  if(!repository.listPage)return repository.list(module);
  const records:unknown[]=[],batchSize=1000;
  for(let offset=0;;offset+=batchSize){
    const page=await repository.listPage(module,offset,batchSize,module==='transactions'?'transaction_date':'id',true);
    records.push(...page.records);
    if(records.length>=page.total||page.records.length<batchSize)break;
  }
  return records;
};
const financialSummary=(rows:FinancialRow[])=>{
  const dates=rows.map(rowDate).filter(Boolean).sort();
  return{total:rows.length,revenues:rows.filter(isRevenue).length,expenses:rows.filter(isExpense).length,lastDate:dates.at(-1)??''};
};
const assertExpectedFinancial=(summary:ReturnType<typeof financialSummary>)=>{
  if(summary.total!==expectedFinancial.total||summary.revenues!==expectedFinancial.revenues||summary.expenses!==expectedFinancial.expenses||summary.lastDate!==expectedFinancial.lastDate)
    throw new Error(`Download bloqueado: financeiro.json diverge do esperado (total=${summary.total}, receitas=${summary.revenues}, despesas=${summary.expenses}, última data=${summary.lastDate||'ausente'}).`);
};
const assertCurrentFinancial=(summary:ReturnType<typeof financialSummary>)=>{
  if(summary.revenues+summary.expenses!==summary.total)throw new Error(`Download bloqueado: ${summary.total-summary.revenues-summary.expenses} transação(ões) possui(em) tipo inválido.`);
  if(summary.total>0&&!/^\d{4}-\d{2}-\d{2}$/.test(summary.lastDate))throw new Error('Download bloqueado: última data financeira inválida.');
};
export async function createMasterBackupZip(selectedModules:RepositoryModule[]=backupModules):Promise<MasterBackupZip>{
  const modules:MasterBackup['modules']={};
  for(const module of selectedModules)modules[module]=await fetchAll(module);
  const transactions=(modules.transactions??[]) as FinancialRow[],summary=financialSummary(transactions);
  assertCurrentFinancial(summary);
  const exportedAt=new Date().toISOString();
  const metadata={format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt,mode:'new_only',exportedCounts:{financial_history:summary.total,revenues:summary.revenues,expenses:summary.expenses},validation:{exportedTotal:summary.total,revenues:summary.revenues,expenses:summary.expenses,lastDate:summary.lastDate}};
  const zip=new JSZip(),database=zip.folder('database')!;
  zip.file('metadata.json',JSON.stringify(metadata,null,2));
  database.file('financeiro.json',JSON.stringify(transactions,null,2));
  for(const[module,records]of Object.entries(modules))database.file(`${module}.json`,JSON.stringify(records,null,2));
  const buffer=await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE',compressionOptions:{level:9}});

  const finalZip=await JSZip.loadAsync(buffer,{checkCRC32:true});
  const financeFile=finalZip.file('database/financeiro.json'),metadataFile=finalZip.file('metadata.json');
  if(!financeFile||!metadataFile)throw new Error('Download bloqueado: arquivos obrigatórios ausentes no ZIP final.');
  const finalRows=JSON.parse(await financeFile.async('text')) as FinancialRow[];
  const finalMetadata=JSON.parse(await metadataFile.async('text')) as typeof metadata;
  const finalSummary=financialSummary(finalRows);
  assertCurrentFinancial(finalSummary);
  const counts=finalMetadata.exportedCounts,validation=finalMetadata.validation;
  if(counts.financial_history!==finalSummary.total||counts.revenues!==finalSummary.revenues||counts.expenses!==finalSummary.expenses||validation.exportedTotal!==finalSummary.total||validation.revenues!==finalSummary.revenues||validation.expenses!==finalSummary.expenses||validation.lastDate!==finalSummary.lastDate)
    throw new Error('Download bloqueado: financeiro.json e metadata.json divergem.');
  return{buffer,sha256:await sha256(buffer),...finalSummary};
}
export async function validateMasterBackup(input:unknown):Promise<{backup:MasterBackup;report:ImportReport;integrityValid:boolean}>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Estrutura JSON inválida.');const backup=input as MasterBackup;if(backup.format!==BACKUP_FORMAT)throw new Error('Formato de Backup Master inválido.');if(backup.version!==BACKUP_VERSION)throw new Error(`Versão incompatível. Esperada: ${BACKUP_VERSION}.`);if(backup.mode!=='new_only'||!backup.modules||typeof backup.modules!=='object')throw new Error('Política ou módulos inválidos.');if(backupModules.some(module=>!Array.isArray(backup.modules[module])))throw new Error('Backup incompleto: existem módulos obrigatórios ausentes.');const{integrity,...payload}=backup;const integrityValid=integrity?.algorithm==='SHA-256'&&integrity.hash===await sha256(payloadOf(payload));if(!integrityValid)throw new Error('Hash de integridade interno inválido.');return{backup,report:await inspectImport(repository,backup.modules,true),integrityValid};}
export const importValidMasterRecords=(backup:MasterBackup)=>inspectImport(repository,backup.modules,false);

const decodeBytes=(buffer:ArrayBuffer)=>{const bytes=new Uint8Array(buffer);if(!bytes.length)throw new Error('Arquivo vazio.');let encoding='UTF-8';if(bytes[0]===0xff&&bytes[1]===0xfe)encoding='UTF-16LE';else if(bytes[0]===0xfe&&bytes[1]===0xff)encoding='UTF-16BE';else if(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)encoding='UTF-8 BOM';try{return{encoding,text:new TextDecoder(encoding.startsWith('UTF-16LE')?'utf-16le':encoding.startsWith('UTF-16BE')?'utf-16be':'utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'')}}catch{throw new Error('Codificação não reconhecida ou arquivo de texto corrompido.');}};
export async function analyzeBackupBytes(buffer:ArrayBuffer):Promise<BackupAnalysis>{
  const{encoding,text}=decodeBytes(buffer);if(!text.trim())throw new Error('Arquivo vazio.');if(/^(U2FsdGVkX1|-----BEGIN PGP MESSAGE-----|[A-Za-z0-9+/]{120,}={0,2})\s*$/.test(text.trim()))throw new Error('Backup criptografado: descriptografe-o na origem antes do dry-run.');
  let root:unknown;try{root=JSON.parse(text);}catch{throw new Error('JSON inválido: não foi possível interpretar o arquivo.');}
  const base=diagnoseRoot(root,encoding);if(base.serialized)throw new Error('Conteúdo serializado: a raiz contém uma string JSON, não os módulos do backup.');if(base.encrypted)throw new Error('Backup criptografado: o conteúdo não pode ser analisado em memória.');
  if(base.rootType==='object'&&(root as Record<string,unknown>).format===BACKUP_FORMAT){const validated=await validateMasterBackup(root);return{backup:validated.backup,convertedModules:validated.backup.modules,report:validated.report,diagnostic:{...base,modulesFound:Object.keys(validated.backup.modules),format:'master'},adapterQuarantine:[]};}
  const adapted=adaptLegacyBackup(root,base);return{backup:null,convertedModules:adapted.modules,report:await inspectImport(repository,adapted.modules,true),diagnostic:adapted.diagnostic,adapterQuarantine:adapted.quarantine,adapterIgnored:adapted.ignored};
}
export async function analyzeBackupZip(buffer:ArrayBuffer):Promise<BackupAnalysis>{const adapted=await adaptLegacyZip(buffer);return{backup:null,convertedModules:adapted.modules,report:await inspectImport(repository,adapted.modules,true),diagnostic:adapted.diagnostic,adapterQuarantine:adapted.quarantine,adapterIgnored:adapted.ignored};}
