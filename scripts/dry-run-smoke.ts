import { inspectImport } from '../src/services/jsonImporter';
import type { DataRepository, EntityRecord, RepositoryModule } from '../src/repositories/contracts';
const existing={id:'11111111-1111-4111-8111-111111111111',name:'Registro existente',kind:'holding'};
let writes=0;
const repository={kind:'localStorage',async list(module:RepositoryModule){return(module==='companies'?[existing]:[])as EntityRecord[]},async find(){return null},async create(_module:RepositoryModule,record:EntityRecord){writes++;return record},async update(_module:RepositoryModule,record:EntityRecord){writes++;return record},async remove(){writes++},async runAtomically(_modules:RepositoryModule[],operation:()=>Promise<unknown>){return operation()}} as DataRepository;
const report=await inspectImport(repository,{companies:[existing,{id:'22222222-2222-4222-8222-222222222222',name:'Novo',kind:'holding'},{id:'11111111-1111-4111-8111-111111111111',name:'Conflito',kind:'holding'},{id:'inválido'}]},true);
if(report.valid.companies!==1||report.duplicates.companies!==1||report.conflicts.length!==1||report.invalid.length!==1||writes!==0)throw new Error('Dry-run falhou.');
console.log('DRY_RUN=OK WRITES=0 VALID=1 DUPLICATE=1 CONFLICT=1 INVALID=1');
