import type { SyntheticEvent } from 'react';

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

export const assetPlaceholder = (type?: string): string => {
  const value = (type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (value.includes('carro')) return assetPath('assets/placeholders/carro.png');
  if (value.includes('moto')) return assetPath('assets/placeholders/moto.png');
  if (value.includes('kitnet')) return assetPath('assets/placeholders/kitnet.png');
  if (value.includes('loja') || value.includes('comercial')) return assetPath('assets/placeholders/loja.png');
  if (value.includes('casa')) return assetPath('assets/placeholders/casa.png');
  if (value.includes('imovel') || value.includes('industrial') || value.includes('outro')) return assetPath('assets/placeholders/imovel.png');
  return assetPath('assets/placeholders/patrimonio.png');
};

export const assetImage = (photo: string | undefined, type?: string) => photo?.trim() || assetPlaceholder(type);

export const useAssetFallback = (event: SyntheticEvent<HTMLImageElement>, type?: string) => {
  const image = event.currentTarget;
  image.onerror = null;
  image.src = assetPlaceholder(type);
};
