export type AssetCategory =
  | 'bist'
  | 'global'
  | 'forex'
  | 'crypto'
  | 'commodity'
  | 'bond'
  | 'tefas'
  | 'us_stock';

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  bist: 'BIST Endeksleri & Hisseler',
  global: 'Global Endeksler',
  forex: 'Dövizler',
  crypto: 'Kripto Paralar',
  commodity: 'Emtialar',
  bond: 'Tahviller',
  tefas: 'TEFAS Fonları',
  us_stock: 'ABD Hisse Senetleri',
};

export interface HistoricalReturns {
  oneMonth: number;
  threeMonth: number;
  sixMonth: number;
  ytd: number;
  oneYear: number;
}

export interface Asset {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'index' | 'forex' | 'crypto' | 'commodity' | 'bond' | 'fund';
  category: AssetCategory;
  price: number;         // yerel para birimi (TL, USD vb.)
  priceUsd?: number;     // USD karşılığı (BIST için TL→USD çevrilmiş)
  weeklyChange: number;
  weeklyChangePct: number;
  volume: string;
  sparkline: number[];
  sector?: string;
  historicalReturns: HistoricalReturns;
}

/**
 * Mock data kaldırıldı. Gerçek veriler için realDataService.ts kullanın.
 * API anahtarı yapılandırılmamışsa bu fonksiyon hata fırlatır.
 */
export async function fetchMarketData(): Promise<Asset[]> {
  throw new Error('NO_API_KEY: Gerçek piyasa verileri için Ayarlar\'dan Yahoo Finance API anahtarı girin.');
}

export function getAssetsByCategory(assets: Asset[], category: AssetCategory): Asset[] {
  return assets.filter(a => a.category === category);
}

export function getAssetsByType(assets: Asset[], type: Asset['type']): Asset[] {
  return assets.filter(a => a.type === type);
}

export function getAllCategories(): AssetCategory[] {
  return Object.keys(CATEGORY_LABELS) as AssetCategory[];
}
