import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const sourceClientPath='C:/Users/aandr/OneDrive/Área de Trabalho/SITES/GITHUB/grupo-3A-v27.12.2025-main/lib/supabase.ts';
const outputDirectory='C:/Users/aandr/Downloads',previousBackup=process.argv[2]||`${outputDirectory}/backup_master_grupo3a_2026-07-23.zip`;
const source=await readFile(sourceClientPath,'utf8');
const url=source.match(/https:\/\/[a-z0-9]+\.supabase\.co/i)?.[0];
const publishableKey=source.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
if(!url||!publishableKey)throw new Error('Configuração de leitura do sistema antigo não localizada.');

const supabase=createClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
type Row={id?:string;date?:string;type?:string;company_id?:string;[key:string]:unknown};
const normalizedType=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const isRevenue=(row:Row)=>['in','receita','entrada','credito'].includes(normalizedType(row.type));
const isExpense=(row:Row)=>['out','despesa','saida','debito'].includes(normalizedType(row.type));

async function fetchAll(table:string):Promise<{rows:Row[];databaseTotal:number}>{
  const countResult=await supabase.from(table).select('*',{count:'exact',head:true});
  if(countResult.error)throw new Error(`${table}: ${countResult.error.message}`);
  const databaseTotal=countResult.count??0,rows:Row[]=[],batchSize=1000;
  for(let offset=0;;offset+=batchSize){
    let query=supabase.from(table).select('*');
    if(table==='transactions')query=query.order('date',{ascending:true}).order('id',{ascending:true});
    else query=query.order('id',{ascending:true});
    const{data,error}=await query.range(offset,offset+batchSize-1);
    if(error)throw new Error(`${table}: ${error.message}`);
    const batch=(data??[]) as Row[];
    if(!batch.length)break;
    rows.push(...batch);
  }
  const unique=new Map<string,Row>();
  for(const row of rows){const id=String(row.id),existing=unique.get(id);if(existing&&JSON.stringify(existing)!==JSON.stringify(row))throw new Error(`${table}: UUID repetido com conteúdo diferente.`);unique.set(id,row);}
  const deduplicated=[...unique.values()];
  if(deduplicated.length!==databaseTotal)throw new Error(`${table}: banco=${databaseTotal}, exportado=${deduplicated.length}.`);
  return{rows:deduplicated,databaseTotal};
}

const transactionExport=await fetchAll('transactions'),transactions=transactionExport.rows;
const dates=transactions.map(row=>String(row.date??'')).filter(Boolean).sort();
const companyCounts=Object.fromEntries([...new Set(transactions.map(row=>String(row.company_id??'sem_empresa')))].sort().map(id=>[id,transactions.filter(row=>String(row.company_id??'sem_empresa')===id).length]));
const revenues=transactions.filter(isRevenue).length;
const expenses=transactions.filter(isExpense).length;
const timestamp=new Date().toISOString(),zip=await JSZip.loadAsync(await readFile(previousBackup)),database=zip.folder('database')!;
const previousMetadata=JSON.parse(await zip.file('metadata.json')!.async('text')) as Record<string,unknown>;
const exportedCounts={...previousMetadata.exportedCounts as Record<string,number>,financial_history:transactions.length,cash_flow:transactions.length,accounts_payable:transactions.length};
const validation={databaseTotal:transactionExport.databaseTotal,exportedTotal:transactions.length,firstDate:dates[0]??null,lastDate:dates.at(-1)??null,companyCounts,revenues,expenses};
const canonicalHash=createHash('sha256').update(JSON.stringify(transactions)).digest('hex');
const metadata={...previousMetadata,backupMasterVersion:'2.1.0',timestamp,exportedCounts,validation,integrity:{algorithm:'SHA-256',canonicalDataHash:canonicalHash},readOnlyExport:true,pagination:{batchSize:1000,order:['date','id']}};
if(metadata.exportedCounts.financial_history!==transactions.length||transactionExport.databaseTotal!==transactions.length)throw new Error('Download bloqueado: contagens do banco, metadata e financeiro.json são diferentes.');
zip.file('metadata.json',JSON.stringify(metadata,null,2));
zip.file('schema.sql',`-- Exportação somente leitura do GRUPO 3A ERP\n-- ${timestamp}\n`);
database.file('financeiro.json',JSON.stringify(transactions,null,2));
database.file('configuracoes.json',JSON.stringify(metadata,null,2));
zip.remove('checksum.sha256');
zip.file('integrity.json',JSON.stringify({algorithm:'SHA-256',canonicalDataHash:canonicalHash,databaseTotal:transactionExport.databaseTotal,exportedTotal:transactions.length},null,2));
const content=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}}),zipHash=createHash('sha256').update(content).digest('hex');
const generatedZip=await JSZip.loadAsync(content,{checkCRC32:true}),generatedFinanceFile=generatedZip.file('database/financeiro.json'),generatedMetadataFile=generatedZip.file('metadata.json');
if(!generatedFinanceFile||!generatedMetadataFile)throw new Error('Download bloqueado: arquivos obrigatórios ausentes no ZIP final.');
const generatedTransactions=JSON.parse(await generatedFinanceFile.async('text')) as Row[],generatedMetadata=JSON.parse(await generatedMetadataFile.async('text')) as typeof metadata;
const generatedDates=generatedTransactions.map(row=>String(row.date??'')).filter(Boolean).sort(),generatedRevenues=generatedTransactions.filter(isRevenue).length,generatedExpenses=generatedTransactions.filter(isExpense).length;
const expected={total:1290,revenues:700,expenses:590,lastDate:'2026-07-23'};
const finalValid=generatedTransactions.length===expected.total&&generatedRevenues===expected.revenues&&generatedExpenses===expected.expenses&&generatedDates.at(-1)===expected.lastDate&&generatedMetadata.exportedCounts.financial_history===generatedTransactions.length&&generatedMetadata.validation.exportedTotal===generatedTransactions.length&&generatedMetadata.validation.revenues===generatedRevenues&&generatedMetadata.validation.expenses===generatedExpenses&&generatedMetadata.validation.lastDate===generatedDates.at(-1);
if(!finalValid)throw new Error(`Download bloqueado: validação do ZIP final falhou (total=${generatedTransactions.length}, receitas=${generatedRevenues}, despesas=${generatedExpenses}, última data=${generatedDates.at(-1)??'ausente'}).`);
const date=timestamp.slice(0,10),output=`${outputDirectory}/backup_master_grupo3a_completo_${date}.zip`,hashOutput=`${output}.sha256`;
await writeFile(output,content);await writeFile(hashOutput,`${zipHash}  ${output.split('/').at(-1)}\n`);
console.log(JSON.stringify({cause:'Consulta única sujeita ao limite padrão de 1.000 linhas.',...validation,validatedFromFinalZip:{total:generatedTransactions.length,revenues:generatedRevenues,expenses:generatedExpenses,lastDate:generatedDates.at(-1),metadataMatches:true},zipHash,output,hashOutput,zeroDatabaseWrites:true},null,2));
