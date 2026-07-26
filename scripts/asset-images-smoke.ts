import { access } from 'node:fs/promises';
import { assetImage, assetPlaceholder } from '../src/lib/assetImages';
const cases:Record<string,string>={carro:'carro.png',moto:'moto.png',Casa:'casa.png',Kitnet:'kitnet.png',Loja:'loja.png',Outro:'imovel.png',desconhecido:'patrimonio.png'};
for(const[type,file]of Object.entries(cases)){const path=assetPlaceholder(type);if(!path.endsWith(file))throw new Error(`Fallback incorreto para ${type}`);await access(`public${path}`);}
if(assetImage('foto-real.webp','moto')!=='foto-real.webp')throw new Error('Foto real não foi priorizada.');
if(!assetImage('', 'moto').endsWith('moto.png'))throw new Error('Foto ausente sem fallback.');
console.log('ASSET_IMAGES=OK TYPES=7 REAL_PHOTO=PRIORITIZED MISSING=FALLBACK');
