import { requireSupabase } from '../lib/supabase';

export type MigrationModuleResult={module:string;oldTotal:number;currentTotal:number;new:number;duplicates:number;conflicts:number;invalid:number;processed:number;countMatches:boolean};
export type CompanyFinancial={total:number;revenues:number;expenses:number;revenueValue:number;expenseValue:number};
export type MigrationDryRun={
  operationId:string;mode:'dry-run';policy:'new_only';startedAt:string;finishedAt:string;
  sourceTables:Record<string,string>;comparisons:MigrationModuleResult[];
  summary:{new:number;duplicates:number;conflicts:number;invalid:number;quarantine:number;plannedInserts:number};
  quarantine:{total:number;items:Array<{module:string;id:string;reason:string}>;truncated:boolean};
  financial:{transactions:number;revenues:number;expenses:number;firstDate:string|null;lastDate:string|null;totalsByCompany:Record<string,CompanyFinancial>};
  validation:{expected:{transactions:number;revenues:number;expenses:number;firstDate:string;lastDate:string};matchesExpected:boolean};
  migrationPlan:{prepared:boolean;executable:boolean;requiresOwnerConfirmation:boolean;preserveUuids:boolean;replaceExisting:boolean;automaticHoldingAssignment:boolean;nullBankAccountAllowed:boolean;batchRollbackRequired:boolean;modules:Record<string,number>};
  zeroWrites:{oldDatabase:boolean;newDatabase:boolean};
};
type FunctionErrorBody={error?:string;message?:string;operationId?:string};
const errorMessage=async(error:unknown)=>{
  const context=(error as{context?:Response})?.context;if(!context)return error instanceof Error?error.message:'Falha ao chamar a Edge Function.';
  let body:FunctionErrorBody={};try{body=await context.clone().json()as FunctionErrorBody}catch{/* resposta sem JSON */}
  const detail=body.error||body.message||`HTTP ${context.status}`;return body.operationId?`${detail} Operação: ${body.operationId}.`:detail;
};
export async function invokeMigration<T>(action:'test'|'analyze'):Promise<T>{
  const client=requireSupabase();let{data:{session},error:sessionError}=await client.auth.getSession();
  if(sessionError)throw new Error(`Não foi possível validar a sessão: ${sessionError.message}`);
  if(!session)throw new Error('Sessão expirada. Entre novamente no sistema.');
  if(!session.expires_at||session.expires_at*1000<=Date.now()+60_000){const refreshed=await client.auth.refreshSession();if(refreshed.error||!refreshed.data.session)throw new Error('Sessão expirada. Entre novamente no sistema.');session=refreshed.data.session;}
  const{data,error}=await client.functions.invoke('super-endpoint',{body:{action},headers:{Authorization:`Bearer ${session.access_token}`}});
  if(error)throw new Error(await errorMessage(error));if(data?.error)throw new Error(data.error);return data as T;
}
