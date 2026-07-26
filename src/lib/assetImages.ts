import type { SyntheticEvent } from 'react';

export const assetPlaceholder = (type?: string): string => {
  const value = (type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (value.includes('carro')) return '/assets/placeholders/carro.png';
  if (value.includes('moto')) return '/assets/placeholders/moto.png';
  if (value.includes('kitnet')) return '/assets/placeholders/kitnet.png';
  if (value.includes('loja') || value.includes('comercial')) return '/assets/placeholders/loja.png';
  if (value.includes('casa')) return '/assets/placeholders/casa.png';
  if (value.includes('imovel') || value.includes('industrial') || value.includes('outro')) return '/assets/placeholders/imovel.png';
  return '/assets/placeholders/patrimonio.png';
};

export const assetImage = (photo: string | undefined, type?: string) => photo?.trim() || assetPlaceholder(type);

export const useAssetFallback = (event: SyntheticEvent<HTMLImageElement>, type?: string) => {
  const image = event.currentTarget;
  image.onerror = null;
  image.src = assetPlaceholder(type);
};
