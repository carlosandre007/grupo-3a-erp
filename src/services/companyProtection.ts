import type{EntityRecord}from'../repositories/contracts';
export const CORE_COMPANY_NAMES=['LOC MOTTUS','3A RASTREAR','IMÓVEIS','HOLDING GRUPO 3A']as const;
const CORE_KINDS=new Set(['loc_mottus','rastrear','imoveis','holding']);
export const isCoreCompany=(company:EntityRecord|undefined|null)=>Boolean(company&&(CORE_KINDS.has(String(company.kind||''))||CORE_COMPANY_NAMES.includes(String(company.name||'')as typeof CORE_COMPANY_NAMES[number])));
export function assertCompanyUpdateAllowed(current:EntityRecord,next:EntityRecord){if(!isCoreCompany(current))return;if(next.id!==current.id||next.name!==current.name||next.kind!==current.kind||next.active===false)throw new Error('Empresa principal permanente: ID, nome, tipo e status ativo não podem ser alterados.');}
export function assertCompanyDeletionAllowed(company:EntityRecord|undefined|null){if(isCoreCompany(company))throw new Error('As quatro empresas principais são permanentes e não podem ser excluídas.');}
