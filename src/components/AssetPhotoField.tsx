import React from 'react';
import { assetImage, useAssetFallback } from '../lib/assetImages';

export default function AssetPhotoField({ value, type, onChange }: { value: string; type?: string; onChange: (value: string) => void }) {
  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  };
  return <div className="space-y-2">
    <div className="relative h-32 overflow-hidden rounded-lg bg-gray-100"><img src={assetImage(value, type)} onError={event => useAssetFallback(event, type)} alt={`Pré-visualização ${type || 'do bem'}`} className="h-full w-full object-cover"/><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"/></div>
    <input type="text" placeholder="URL da foto real (opcional)" value={value.startsWith('data:') ? '' : value} onChange={event => onChange(event.target.value)} className="input"/>
    <div className="flex gap-2"><label className="cursor-pointer rounded border px-3 py-2 text-[10px] font-bold">ENVIAR FOTO<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/></label>{value&&<button type="button" onClick={() => onChange('')} className="rounded border px-3 py-2 text-[10px] font-bold text-red-700">REMOVER FOTO</button>}</div>
  </div>;
}
