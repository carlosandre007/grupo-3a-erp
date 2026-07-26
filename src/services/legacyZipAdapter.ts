import JSZip from'jszip';
import type{RepositoryModule}from'../repositories';
import{adaptLegacyBackup,BackupDiagnostic,diagnoseRoot}from'./legacyBackupAdapter';

type ZipExtraction={root:Record<string,unknown>;diagnostic:BackupDiagnostic;quarantine:Array<{module:string;index:number;reason:string}>};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\.[^.]+$/,'').replace(/[\s-]+/g,'_');
const decode=(bytes:Uint8Array)=>{let encoding='UTF-8';if(bytes[0]===0xff&&bytes[1]===0xfe)encoding='UTF-16LE';else if(bytes[0]===0xfe&&bytes[1]===0xff)encoding='UTF-16BE';else if(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)encoding='UTF-8 BOM';const label=encoding.startsWith('UTF-16LE')?'utf-16le':encoding.startsWith('UTF-16BE')?'utf-16be':'utf-8';return{encoding,text:new TextDecoder(label,{fatal:true}).decode(bytes).replace(/^\uFEFF/,'')};};
const recordsOf=(value:unknown):unknown[]=>{if(Array.isArray(value))return value;if(value&&typeof value==='object'){const object=value as Record<string,unknown>;for(const key of['records','registros','items','itens','data','dados'])if(Array.isArray(object[key]))return object[key]as unknown[];return[value];}return[];};
const moduleNames=['categorias','clientes','configuracoes','contratos','empresas','financeiro','imoveis','rastreadores','usuarios','veiculos'];

export async function extractLegacyZip(buffer:ArrayBuffer):Promise<ZipExtraction>{
 let archive:JSZip;try{archive=await JSZip.loadAsync(buffer,{checkCRC32:true});}catch{throw new Error('ZIP inválido ou corrompido.');}
 const entries=Object.values(archive.files).filter(entry=>!entry.dir),mapped=entries.map(entry=>{const parts=entry.name.replace(/\\/g,'/').split('/').filter(Boolean),databaseIndex=parts.findIndex(part=>normalize(part)==='database');return{entry,parts,databaseIndex,relative:databaseIndex>=0?parts.slice(databaseIndex+1):[]};}),located=mapped.filter(item=>item.relative.length);
 if(!located.length)throw new Error('Módulo incompatível: pasta database não encontrada no ZIP.');
 const metadataEntry=located.find(item=>['metadados','metadata'].includes(normalize(item.relative.join('/'))))??mapped.find(item=>item.parts.length===1&&['metadados','metadata'].includes(normalize(item.parts[0])));
 if(!metadataEntry)throw new Error('Campo obrigatório ausente: metadados.json ou metadata.json.');
 const metadataBytes=await metadataEntry.entry.async('uint8array');let metadata:unknown;let detectedEncoding='UTF-8';try{const decoded=decode(metadataBytes);detectedEncoding=decoded.encoding;metadata=JSON.parse(decoded.text);}catch{throw new Error('JSON inválido em database/metadados.json.');}
 const collected:Record<string,unknown[]>={},quarantine:ZipExtraction['quarantine']=[];
 for(const item of located){if(item===metadataEntry)continue;const module=normalize(item.relative[0]);if(!moduleNames.includes(module))continue;const bytes=await item.entry.async('uint8array');try{const decoded=decode(bytes),parsed=JSON.parse(decoded.text);collected[module]??=[];collected[module].push(...recordsOf(parsed));}catch{quarantine.push({module,index:collected[module]?.length||0,reason:`JSON inválido ou codificação incompatível em ${item.relative.join('/')}.`});}}
 const root:Record<string,unknown>={metadata,...collected};
 const companies=(collected.empresas||[]).filter(record=>record&&typeof record==='object')as Record<string,unknown>[],companyBySlug=new Map(companies.map(company=>[String(company.slug),String(company.id)])),propertyCompany=companyBySlug.get('imoveis'),vehicleCompany=companyBySlug.get('loc-mottus');
 const clientCompanies=new Map<string,Set<string>>();const linkClient=(id:unknown,companyId?:string)=>{if(typeof id!=='string'||!id||!companyId)return;const set=clientCompanies.get(id)||new Set<string>();set.add(companyId);clientCompanies.set(id,set);};
 (collected.imoveis||[]).forEach(record=>{if(record&&typeof record==='object')linkClient((record as Record<string,unknown>).tenant_id,propertyCompany)});(collected.veiculos||[]).forEach(record=>{if(record&&typeof record==='object')linkClient((record as Record<string,unknown>).client_id,vehicleCompany)});
 root.clientes=(collected.clientes||[]).map(record=>{if(!record||typeof record!=='object')return record;const item=record as Record<string,unknown>,companiesForClient=clientCompanies.get(String(item.id));return companiesForClient?.size===1?{...item,company_id:[...companiesForClient][0]}:item;});
 const assets:Record<string,unknown>[]=[];
 root.imoveis=(collected.imoveis||[]).map(record=>{if(!record||typeof record!=='object')return record;const item=record as Record<string,unknown>,type=String(item.tipo)==='loja'?'loja':'outro',status=String(item.status)==='rented'?'alugado':String(item.status)==='available'?'disponivel':'manutencao';if(propertyCompany)assets.push({id:item.id,company_id:propertyCompany,code:item.code,asset_type:type,name:item.description||item.code,status,acquisition_date:item.data_aquisicao,purchase_value:item.valor_patrimonial,current_value:item.valor_atual,created_at:item.created_at});return item;});
 root.veiculos=(collected.veiculos||[]).map(record=>{if(!record||typeof record!=='object')return record;const item=record as Record<string,unknown>,status=String(item.status)==='rented'?'locado':String(item.status)==='available'?'disponivel':'manutencao';if(vehicleCompany)assets.push({id:item.id,company_id:vehicleCompany,code:item.code,asset_type:item.type,name:item.model,status,acquisition_date:item.data_aquisicao,purchase_value:item.purchase_value,current_value:item.valor_atual,created_at:item.created_at});return item;});
 if(assets.length)root.assets=assets;
 const contracts=collected.contratos||[],charges:unknown[]=[],series:unknown[]=[];
 contracts.forEach((record,index)=>{if(!record||typeof record!=='object'||Array.isArray(record)){quarantine.push({module:'contratos',index,reason:'Contrato incompatível.'});return;}const object=record as Record<string,unknown>,nested=object.cobrancas??object.charges;if(Array.isArray(nested))charges.push(...nested);if('dueDate'in object||'due_date'in object)charges.push(object);else if('frequency'in object||'frequencia'in object)series.push(object);else quarantine.push({module:'contratos',index,reason:'Contrato sem estrutura compatível de cobrança ou recorrência.'});});
 if(charges.length)root.cobrancas=charges;if(series.length)root.series_recorrentes=series;
 (collected.usuarios||[]).forEach((_record,index)=>quarantine.push({module:'usuarios',index,reason:'Usuário enviado à quarentena; credenciais e senhas nunca são importadas.'}));
 (collected.configuracoes||[]).forEach((_record,index)=>quarantine.push({module:'configuracoes',index,reason:'Configuração analisada sem tabela de destino compatível.'}));
 const base=diagnoseRoot(root,detectedEncoding),adapted=adaptLegacyBackup(root,base),moduleCounts=Object.fromEntries(moduleNames.filter(module=>collected[module]).map(module=>[module,collected[module].length]));
 const firstDatabase=located[0],databaseRoot=`${firstDatabase.parts.slice(0,firstDatabase.databaseIndex+1).join('/')}/`;
 return{root,quarantine:[...quarantine,...adapted.quarantine],diagnostic:{...adapted.diagnostic,format:'legacy-zip',modulesFound:Object.keys(moduleCounts),moduleCounts,metadataPath:metadataEntry.entry.name,databaseRoot,metadataKeys:metadata&&typeof metadata==='object'&&!Array.isArray(metadata)?Object.keys(metadata as Record<string,unknown>).sort():[]}};
}

export async function adaptLegacyZip(buffer:ArrayBuffer){const extracted=await extractLegacyZip(buffer),adapted=adaptLegacyBackup(extracted.root,diagnoseRoot(extracted.root,extracted.diagnostic.encoding));return{modules:adapted.modules,diagnostic:extracted.diagnostic,quarantine:extracted.quarantine,ignored:adapted.ignored};}
