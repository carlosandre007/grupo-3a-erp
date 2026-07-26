// @ts-nocheck -- Supabase Edge Functions are checked by Deno during deployment.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
type Row=Record<string,unknown>&{id?:unknown};
type ModuleName='companies'|'categories'|'clients'|'properties'|'vehicles'|'charges'|'fixed_costs'|'bank_accounts'|'transactions';
type Client=ReturnType<typeof createClient>;
const candidates:Record<ModuleName,readonly string[]>={
  companies:['companies','empresas'],
  categories:['categories','categorias'],
  clients:['clients','clientes'],
  properties:['properties','imoveis'],
  vehicles:['vehicles','veiculos','motorcycles'],
  charges:['charges','cobrancas'],
  fixed_costs:['fixed_costs','custos_fixos'],
  bank_accounts:['bank_accounts','banks','bancos'],
  transactions:['transactions','financeiro'],
};
const modules=Object.keys(candidates) as ModuleName[];
const expectedFinancial={transactions:1290,revenues:700,expenses:590,firstDate:'2025-12-26',lastDate:'2026-07-23'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalized=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const financialType=(value:unknown)=>['in','receita','entrada','credito','credit'].includes(normalized(value))?'receita':['out','despesa','saida','debito','debit'].includes(normalized(value))?'despesa':String(value??'');
const financialStatus=(value:unknown)=>['pago','recebido','paid','confirmed'].includes(normalized(value))?'pago':['pendente','pending','aberto'].includes(normalized(value))?'pendente':['atrasado','overdue','vencido'].includes(normalized(value))?'atrasado':['cancelado','cancelled','canceled'].includes(normalized(value))?'cancelado':String(value??'');
const companyKind=(row:Row)=>{const word=normalized(row.kind??row.slug??row.type??row.name);if(word.includes('mottus'))return'loc_mottus';if(word.includes('rastrear'))return'rastrear';if(word.includes('imove'))return'imoveis';if(word.includes('holding')||word.includes('grupo 3a'))return'holding';return String(row.kind??'')};
const first=(row:Row,...keys:string[])=>keys.map(key=>row[key]).find(value=>value!==undefined);
const compact=(row:Row)=>Object.fromEntries(Object.entries(row).filter(([,value])=>value!==undefined).sort(([a],[b])=>a.localeCompare(b)));
const canonical=(module:ModuleName,row:Row):Row=>{
  const id=String(row.id??'');
  if(module==='companies')return compact({id,name:first(row,'name','nome'),kind:companyKind(row),active:first(row,'active','ativo')??true});
  if(module==='categories')return compact({id,company_id:first(row,'company_id','companyId','empresa_id','empresaId'),name:first(row,'name','nome'),type:financialType(first(row,'type','tipo'))});
  if(module==='clients')return compact({id,company_id:first(row,'company_id','companyId','empresa_id','empresaId'),name:first(row,'name','nome'),document:first(row,'document','cpf','cnpj'),email:row.email,phone:first(row,'phone','telefone')});
  if(module==='properties')return compact({id,address:first(row,'address','endereco'),area:row.area,bedrooms:first(row,'bedrooms','quartos'),bathrooms:first(row,'bathrooms','banheiros'),rent_value:first(row,'rent_value','value','valor'),tenant_client_id:first(row,'tenant_client_id','tenant_id','client_id')});
  if(module==='vehicles')return compact({id,plate:first(row,'plate','placa'),model:first(row,'model','modelo','name'),rental_value:first(row,'rental_value','value','valor'),tenant_client_id:first(row,'tenant_client_id','client_id')});
  if(module==='charges')return compact({id,company_id:first(row,'company_id','companyId','empresa_id'),category_id:first(row,'category_id','categoryId','categoria_id'),client_id:first(row,'client_id','clientId','cliente_id'),asset_id:first(row,'asset_id','assetId','bem_id'),due_date:first(row,'due_date','dueDate','date','data','vencimento'),description:first(row,'description','descricao'),value:Number(first(row,'value','valor')??0),status:financialStatus(row.status),bank_account_id:first(row,'bank_account_id','bankAccountId','id_conta')??null});
  if(module==='fixed_costs')return compact({id,company_id:first(row,'company_id','companyId','empresa_id'),category_id:first(row,'category_id','categoryId','categoria_id'),description:first(row,'description','descricao'),value:Number(first(row,'value','valor')??0),frequency:first(row,'frequency','frequencia'),bank_account_id:first(row,'bank_account_id','bankAccountId','id_conta')??null});
  if(module==='bank_accounts')return compact({id,company_id:first(row,'company_id','companyId','empresa_id'),bank_name:first(row,'bank_name','bankName','bank','banco'),account_name:first(row,'account_name','accountName','name','nome'),account_type:first(row,'account_type','accountType','type','tipo'),initial_balance:Number(first(row,'initial_balance','initialBalance','balance','saldo')??0),initial_balance_date:first(row,'initial_balance_date','initialBalanceDate','date','data'),active:first(row,'active','ativo')??true});
  return compact({id,company_id:first(row,'company_id','companyId','empresa_id'),category_id:first(row,'category_id','categoryId','categoria_id'),client_id:first(row,'client_id','clientId','cliente_id'),asset_id:first(row,'asset_id','assetId','bem_id'),bank_account_id:first(row,'bank_account_id','bankAccountId','id_conta')??null,type:financialType(first(row,'type','tipo')),status:financialStatus(row.status),description:first(row,'description','descricao'),value:Number(first(row,'value','valor')??0),transaction_date:first(row,'transaction_date','transactionDate','date','data')});
};
const stable=(row:Row)=>JSON.stringify(compact(row));
const safeCause=(error:unknown)=>{
  const code=String((error as{code?:unknown})?.code??'UNKNOWN');
  const raw=error instanceof Error?error.message:String((error as{message?:unknown})?.message??'Falha desconhecida');
  const message=raw.replace(/https?:\/\/\S+/gi,'[URL]').replace(/(?:sb_secret_|sbp_|eyJ)[A-Za-z0-9_.-]+/g,'[CREDENTIAL]').replace(/postgres(?:ql)?:\/\/\S+/gi,'[CONNECTION]').slice(0,300);
  return{code,message};
};
const required:Record<ModuleName,string[]>={
  companies:['id','name','kind'],categories:['id','company_id','name','type'],clients:['id','company_id','name'],properties:['id','address'],vehicles:['id','plate','model'],charges:['id','company_id','category_id','client_id','asset_id','due_date','description','value','status'],fixed_costs:['id','company_id','category_id','description','value'],bank_accounts:['id','company_id','bank_name','account_name'],transactions:['id','company_id','category_id','type','status','description','value','transaction_date'],
};
async function allRows(client:Client,table:string){
  const rows:Row[]=[],pageSize=1000;let expected:number|null=null;
  for(let offset=0;;offset+=pageSize){
    const{data,error,count}=await client.from(table).select('*',{count:'exact'}).order('id',{ascending:true}).range(offset,offset+pageSize-1);
    if(error)throw error;if(expected===null)expected=count??0;
    const page=(data??[])as Row[];rows.push(...page);if(page.length<pageSize)break;
  }
  if(rows.length!==expected)throw new Error(`Contagem divergente no módulo ${table}.`);
  return rows;
}
async function allOldRows(client:Client,module:ModuleName,table:string,operationId:string){
  const rows:Row[]=[],issues:Array<{module:ModuleName;id:string;reason:string;batch:{offset:number;limit:number};diagnostic:{code:string;cause:string}}>=[],pageSize=1000;let expected:number|null=null;
  for(let offset=0;expected===null||offset<expected;offset+=pageSize){
    let page:Row[]|null=null,lastError:unknown=null;
    for(let attempt=1;attempt<=3;attempt++){
      const result=await client.from(table).select('*',{count:'exact'}).order('id',{ascending:true}).range(offset,offset+pageSize-1);
      if(!result.error){if(expected===null)expected=result.count??0;page=(result.data??[])as Row[];break;}
      lastError=result.error;const cause=safeCause(lastError);
      console.error(JSON.stringify({operationId,status:'batch_retry',module,table,offset,limit:pageSize,attempt,code:cause.code,cause:cause.message,zeroWrites:true}));
    }
    if(page){rows.push(...page);if(page.length<pageSize&&expected===null)expected=offset+page.length;continue;}
    const cause=safeCause(lastError);
    issues.push({module,id:`batch:${offset}-${offset+pageSize-1}`,reason:'Lote do banco antigo enviado à quarentena após três falhas de leitura.',batch:{offset,limit:pageSize},diagnostic:{code:cause.code,cause:cause.message}});
    console.error(JSON.stringify({operationId,status:'batch_quarantined',module,table,offset,limit:pageSize,code:cause.code,cause:cause.message,zeroWrites:true}));
    if(expected===null)break;
  }
  return{rows,expected:expected??rows.length,issues,countMatches:issues.length===0&&rows.length===(expected??rows.length)};
}
async function resolveTables(client:Client){
  const resolved={}as Record<ModuleName,string>;
  for(const module of modules){
    for(const candidate of candidates[module]){
      const{error}=await client.from(candidate).select('id',{count:'exact',head:true});
      if(!error){resolved[module]=candidate;break;}
      if(!['42P01','PGRST205','PGRST204'].includes(error.code))throw error;
    }
    if(!resolved[module])throw new Error(`Tabela antiga não localizada para o módulo ${module}.`);
  }
  return resolved;
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
  const operationId=crypto.randomUUID(),startedAt=new Date().toISOString();let stage='authentication';
  if(request.method!=='POST')return json({error:'Método não permitido.',operationId},405);
  try{
    const authorization=request.headers.get('Authorization');if(!authorization)return json({error:'Sessão obrigatória.',operationId},401);
    const currentUrl=Deno.env.get('SUPABASE_URL'),currentKey=Deno.env.get('SUPABASE_ANON_KEY');
    if(!currentUrl||!currentKey)throw new Error('Configuração do projeto atual indisponível.');
    const current=createClient(currentUrl,currentKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const{data:{user},error:userError}=await current.auth.getUser();if(userError||!user)return json({error:'Sessão inválida ou expirada.',operationId},401);
    const{data:profile,error:profileError}=await current.from('profiles').select('role,active').eq('id',user.id).single();
    if(profileError||profile?.role!=='owner'||!profile.active)return json({error:'Somente owner ativo pode executar o dry-run.',operationId},403);
    const body=await request.json().catch(()=>({action:'test'}))as{action?:'test'|'analyze'};
    const oldUrl=Deno.env.get('OLD_SUPABASE_URL'),oldKey=Deno.env.get('OLD_SUPABASE_SERVICE_ROLE_KEY');
    if(!oldUrl||!oldKey)throw new Error('Secrets do Supabase antigo não configurados.');
    const old=createClient(oldUrl,oldKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    stage='source_table_detection';const sourceTables=await resolveTables(old);
    if(body.action==='test')return json({operationId,mode:'connection-test',connection:{connected:true,serverSide:true},sourceTables,zeroWrites:{oldDatabase:true,newDatabase:true}});

    const oldData={}as Record<ModuleName,Row[]>,newData={}as Record<ModuleName,Row[]>,oldTotals={}as Record<ModuleName,number>,readIssues=[]as Awaited<ReturnType<typeof allOldRows>>['issues'],readMatches={}as Record<ModuleName,boolean>;
    for(const module of modules){stage=`select:${module}`;const[legacy,currentRows]=await Promise.all([allOldRows(old,module,sourceTables[module],operationId),allRows(current,module)]);oldData[module]=legacy.rows;oldTotals[module]=legacy.expected;readMatches[module]=legacy.countMatches;readIssues.push(...legacy.issues);newData[module]=currentRows;}
    const companyIds=new Set(oldData.companies.map(row=>String(row.id))),categoryIds=new Set(oldData.categories.map(row=>String(row.id))),clientIds=new Set(oldData.clients.map(row=>String(row.id))),assetIds=new Set([...oldData.properties,...oldData.vehicles].map(row=>String(row.id))),bankIds=new Set(oldData.bank_accounts.map(row=>String(row.id)));
    const comparisons=[],quarantine=[...readIssues]as Array<{module:ModuleName;id:string;reason:string;batch?:{offset:number;limit:number};diagnostic?:{code:string;cause:string}}>,migrationRecords={}as Record<ModuleName,Row[]>;let newTotal=0,duplicates=0,conflicts=0,invalid=0;
    for(const module of modules){
      const existing=new Map(newData[module].map(row=>{const value=canonical(module,row);return[String(value.id),value]})),records:Row[]=[];let moduleNew=0,moduleDuplicates=0,moduleConflicts=0,moduleInvalid=0;
      for(const raw of oldData[module]){
        const row=canonical(module,raw),id=String(row.id??'');let reason='';
        if(!uuid.test(id))reason='UUID ausente ou inválido.';
        else{const missing=required[module].filter(field=>row[field]===undefined||row[field]===null||row[field]==='');if(missing.length)reason=`Campos obrigatórios ausentes: ${missing.join(', ')}.`;}
        if(!reason&&module==='transactions'){
          if(!companyIds.has(String(row.company_id)))reason='Empresa não comprovável; nenhuma atribuição automática à HOLDING foi feita.';
          else if(!categoryIds.has(String(row.category_id)))reason='Categoria inexistente no banco antigo.';
          else if(row.client_id&&!clientIds.has(String(row.client_id)))reason='Cliente referenciado não existe.';
          else if(row.asset_id&&!assetIds.has(String(row.asset_id)))reason='Bem referenciado não existe.';
          if(row.bank_account_id&&!bankIds.has(String(row.bank_account_id)))row.bank_account_id=null;
        }
        if(reason){moduleInvalid++;quarantine.push({module,id,reason});continue;}
        const present=existing.get(id);
        if(!present){moduleNew++;records.push(row);}else if(stable(present)===stable(row))moduleDuplicates++;else{moduleConflicts++;quarantine.push({module,id,reason:'UUID existente com conteúdo divergente; substituição bloqueada.'});}
      }
      migrationRecords[module]=records;newTotal+=moduleNew;duplicates+=moduleDuplicates;conflicts+=moduleConflicts;invalid+=moduleInvalid;
      comparisons.push({module,oldTotal:oldTotals[module],currentTotal:newData[module].length,new:moduleNew,duplicates:moduleDuplicates,conflicts:moduleConflicts,invalid:moduleInvalid,processed:oldData[module].length,countMatches:readMatches[module]});
    }
    const companies=new Map(oldData.companies.map(row=>[String(row.id),String(first(row,'name','nome')??'Empresa sem nome')])),totalsByCompany:Record<string,{total:number;revenues:number;expenses:number;revenueValue:number;expenseValue:number}>={};let revenues=0,expenses=0;const dates:string[]=[];
    for(const raw of oldData.transactions){const row=canonical('transactions',raw),date=String(row.transaction_date??'');if(date)dates.push(date);const type=String(row.type),value=Math.abs(Number(row.value)||0),company=companies.get(String(row.company_id))??'Sem empresa comprovada',summary=totalsByCompany[company]??={total:0,revenues:0,expenses:0,revenueValue:0,expenseValue:0};summary.total++;if(type==='receita'){revenues++;summary.revenues++;summary.revenueValue+=value}else if(type==='despesa'){expenses++;summary.expenses++;summary.expenseValue+=value}totalsByCompany[company]=summary;}
    dates.sort();const firstDate=dates[0]??null,lastDate=dates.at(-1)??null,financial={transactions:oldData.transactions.length,revenues,expenses,firstDate,lastDate,totalsByCompany};
    const report={operationId,mode:'dry-run',policy:'new_only',startedAt,finishedAt:new Date().toISOString(),sourceTables,comparisons,summary:{new:newTotal,duplicates,conflicts,invalid,quarantine:quarantine.length,plannedInserts:newTotal},quarantine:{total:quarantine.length,items:quarantine.slice(0,500),truncated:quarantine.length>500},financial,validation:{expected:expectedFinancial,matchesExpected:financial.transactions===expectedFinancial.transactions&&revenues===expectedFinancial.revenues&&expenses===expectedFinancial.expenses&&firstDate===expectedFinancial.firstDate&&lastDate===expectedFinancial.lastDate},migrationPlan:{prepared:true,executable:false,requiresOwnerConfirmation:true,preserveUuids:true,replaceExisting:false,automaticHoldingAssignment:false,nullBankAccountAllowed:true,batchRollbackRequired:true,modules:Object.fromEntries(modules.map(module=>[module,migrationRecords[module].length]))},zeroWrites:{oldDatabase:true,newDatabase:true}};
    console.log(JSON.stringify({operationId,status:'completed',mode:'dry-run',summary:report.summary,financial:{transactions:financial.transactions,revenues,expenses,firstDate,lastDate},zeroWrites:true}));
    return json(report);
  }catch(error){
    const code=String((error as{code?:unknown})?.code??''),known=error instanceof Error&&/^(Secrets |Contagem divergente|Configuração |Tabela antiga )/.test(error.message)?error.message:null;
    const internal=safeCause(error),message=known??(code==='401'||code==='PGRST301'?'Credencial server-side do Supabase antigo rejeitada.':code==='42501'?`Permissão de SELECT negada na etapa ${stage}.`:code==='42P01'||code==='PGRST205'?`Tabela não localizada na etapa ${stage}.`:`Falha de leitura na etapa ${stage}.`);
    console.error(JSON.stringify({operationId,status:'failed',stage,code:internal.code,cause:internal.message,error:message,zeroWrites:true}));
    return json({operationId,error:message,diagnostic:{stage,code:code||null},zeroWrites:{oldDatabase:true,newDatabase:true}},400);
  }
});
