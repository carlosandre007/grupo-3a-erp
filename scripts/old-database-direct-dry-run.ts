import pg from 'pg';
import { readFile } from 'node:fs/promises';

const parseEnv=(text:string)=>Object.fromEntries(text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const index=line.indexOf('=');return[line.slice(0,index).trim(),line.slice(index+1).trim()]}));
const env=parseEnv(await readFile('.env.old-db.local','utf8'));
const connectionString=env.OLD_DATABASE_URL;
if(!connectionString)throw new Error('Preencha OLD_DATABASE_URL em .env.old-db.local.');

const db=new pg.Client({connectionString,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15_000});
type Row={id?:unknown;company_id?:unknown;name?:unknown;type?:unknown;date?:unknown;transaction_date?:unknown};
const candidates={
  companies:['companies'],
  categories:['categories'],
  clients:['clients'],
  properties:['properties'],
  vehicles:['vehicles','motorcycles'],
  charges:['charges'],
  fixed_costs:['fixed_costs'],
  bank_accounts:['bank_accounts','banks'],
  transactions:['transactions'],
} as const;
const identifier=(value:string)=>`"${value.replaceAll('"','""')}"`;
const normalized=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const financialType=(value:unknown)=>['in','receita','entrada','credito'].includes(normalized(value))?'receita':['out','despesa','saida','debito'].includes(normalized(value))?'despesa':'outro';
const allRows=async(table:string)=>{
  const rows:Row[]=[],size=1000;
  for(let offset=0;;offset+=size){
    const page=(await db.query(`select * from public.${identifier(table)} order by id asc limit $1 offset $2`,[size,offset])).rows as Row[];
    rows.push(...page);
    if(page.length<size)break;
  }
  const count=Number((await db.query(`select count(*)::integer as count from public.${identifier(table)}`)).rows[0].count);
  if(rows.length!==count)throw new Error(`Contagem divergente no módulo ${table}.`);
  return rows;
};

try{
  await db.connect();
  const session=await db.query("select current_user, current_setting('transaction_read_only') as transaction_read_only");
  if(session.rows[0].transaction_read_only!=='on')throw new Error('Conexão recusada: transaction_read_only não está ativo.');
  const available=new Set<string>((await db.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).rows.map(row=>String(row.table_name)));
  const sourceTables=Object.fromEntries(Object.entries(candidates).map(([module,names])=>{const table=names.find(name=>available.has(name));if(!table)throw new Error(`Tabela não localizada para ${module}.`);return[module,table]}));
  const data:Record<string,Row[]>={};
  for(const[module,table]of Object.entries(sourceTables))data[module]=await allRows(table);
  const companies=new Map(data.companies.map(row=>[String(row.id),String(row.name??'Empresa sem nome')]));
  const totalsByCompany:Record<string,{total:number;revenues:number;expenses:number}>={};
  let revenues=0,expenses=0;const dates:string[]=[];
  for(const row of data.transactions){
    const type=financialType(row.type),date=String(row.date??row.transaction_date??'');if(date)dates.push(date);
    if(type==='receita')revenues++;if(type==='despesa')expenses++;
    const company=companies.get(String(row.company_id))??'Sem empresa',summary=totalsByCompany[company]??={total:0,revenues:0,expenses:0};
    summary.total++;if(type==='receita')summary.revenues++;if(type==='despesa')summary.expenses++;totalsByCompany[company]=summary;
  }
  dates.sort();
  console.log(JSON.stringify({connection:{connected:true,user:session.rows[0].current_user,transactionReadOnly:true},sourceTables,counts:Object.fromEntries(Object.entries(data).map(([module,rows])=>[module,rows.length])),financial:{transactions:data.transactions.length,revenues,expenses,firstDate:dates[0]??null,lastDate:dates.at(-1)??null,totalsByCompany},zeroWrites:{oldDatabase:true,newDatabase:true}},null,2));
}finally{
  await db.end().catch(()=>{});
}
