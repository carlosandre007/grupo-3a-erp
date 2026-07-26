import{adaptLegacyJson,MasterContext}from'../src/services/legacyJsonFormatAdapter';
import{adaptLegacyBackup,diagnoseRoot}from'../src/services/legacyBackupAdapter';
import{extractLegacyZip}from'../src/services/legacyZipAdapter';
import{readFile}from'node:fs/promises';
import type{EntityRecord}from'../src/repositories/contracts';

const z=await readFile('C:/Users/aandr/Downloads/backup_master_grupo3a_2026-07-23.zip');
const buf=z.buffer.slice(z.byteOffset,z.byteOffset+z.byteLength)as ArrayBuffer;
const ex=await extractLegacyZip(buf);
const ad=adaptLegacyBackup(ex.root,diagnoseRoot(ex.root,ex.diagnostic.encoding));
const ctx:MasterContext={
  companies:(ad.modules.companies??[])as EntityRecord[],
  categories:(ad.modules.categories??[])as EntityRecord[],
  clients:(ad.modules.clients??[])as EntityRecord[],
  assets:(ad.modules.assets??[])as EntityRecord[],
  properties:(ad.modules.properties??[])as EntityRecord[],
  vehicles:(ad.modules.vehicles??[])as EntityRecord[]
};

const json=JSON.parse(await readFile('C:/Users/aandr/Downloads/backup-grupo-3a-2026-07-23-14-13.json','utf8'));
const adapted=adaptLegacyJson(json,ctx);
const charges=(adapted.modules.charges||[]) as EntityRecord[];
const withAsset=charges.filter(c=>c.asset_id).length;
const withClient=charges.filter(c=>c.client_id).length;
const withCompany=charges.filter(c=>c.company_id).length;
const withCategory=charges.filter(c=>c.category_id).length;
console.log({total:charges.length,withAsset,withClient,withCompany,withCategory});

// Check a specific charge
const gilson=charges.find(c=>c.description==='GILSON');
if(gilson)console.log('GILSON charge:',JSON.stringify(gilson,null,2));

// Check if any vehicle is M018 in ctx
const v018=ctx.vehicles.find(v=>v.code==='M018');
console.log('Vehicle M018 in ctx.vehicles:',v018?'YES':'NO');
const a018=ctx.assets.find(a=>a.code==='M018');
console.log('Asset M018 in ctx.assets:',a018?'YES, id='+a018.id:'NO');
