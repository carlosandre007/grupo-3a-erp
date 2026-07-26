import { readFile } from 'node:fs/promises';
import { extractLegacyZip } from '../src/services/legacyZipAdapter';

const path = process.argv[2];
if (!path) throw new Error('Caminho ausente.');
const bytes = await readFile(path);
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
const result = await extractLegacyZip(buffer);
for (const module of ['empresas', 'clientes', 'imoveis', 'veiculos', 'financeiro', 'contratos']) {
  const records = (result.root[module] || []) as unknown[];
  const objects = records.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[];
  const keys = [...new Set(objects.flatMap(Object.keys))].sort();
  const types = Object.fromEntries(keys.map(key => [key, [...new Set(objects.map(item => Array.isArray(item[key]) ? 'array' : item[key] === null ? 'null' : typeof item[key]))].sort()]));
  console.log(JSON.stringify({ module, total: records.length, keys, types }));
  if(module==='financeiro')for(const key of ['type','status'])console.log(JSON.stringify({module,key,values:[...new Set(objects.map(item=>String(item[key])))].sort()}));
  if(['empresas','imoveis','veiculos'].includes(module))for(const key of module==='empresas'?['slug']:['type','tipo','status'])if(keys.includes(key))console.log(JSON.stringify({module,key,values:[...new Set(objects.map(item=>String(item[key])))].sort()}));
}
const clients=((result.root.clientes||[])as Record<string,unknown>[]).map(item=>String(item.id)),properties=(result.root.imoveis||[])as Record<string,unknown>[],vehicles=(result.root.veiculos||[])as Record<string,unknown>[];
const linked=new Set([...properties.map(item=>String(item.tenant_id||'')),...vehicles.map(item=>String(item.client_id||''))].filter(Boolean));
console.log(JSON.stringify({module:'clientes',linkedToAsset:clients.filter(id=>linked.has(id)).length,unlinked:clients.filter(id=>!linked.has(id)).length}));
