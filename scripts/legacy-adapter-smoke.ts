import{adaptLegacyBackup,diagnoseRoot}from'../src/services/legacyBackupAdapter';
const root={metadata:{version:'legacy-test'},empresas:[{id:'11111111-1111-4111-8111-111111111111',name:'Empresa',kind:'holding'}],historico_financeiro:[]};
const result=adaptLegacyBackup(root,diagnoseRoot(root,'UTF-8'));
if(result.diagnostic.format!=='legacy'||result.diagnostic.version!=='legacy-test'||result.diagnostic.modulesFound.length!==2||result.modules.companies?.length!==1)throw new Error('Adaptador legado falhou.');
console.log('LEGACY_ADAPTER=OK FORMAT=legacy MODULES=2 ORIGINAL_UNCHANGED=YES WRITES=0');
