export type AssetCategory =
  | 'bist'
  | 'global'
  | 'forex'
  | 'crypto'
  | 'commodity'
  | 'bond'
  | 'tefas'
  | 'us_stock'
  | 'tr_realestate';

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  bist: 'BIST Endeksleri',
  global: 'Global Endeksler',
  forex: 'Dövizler',
  crypto: 'Kripto Paralar',
  commodity: 'Emtialar',
  bond: 'Tahviller',
  tefas: 'TEFAS Fonları',
  us_stock: 'ABD Hisse Senetleri',
  tr_realestate: 'Türkiye Gayrimenkul Piyasası',
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
  type: 'stock' | 'etf' | 'index' | 'forex' | 'crypto' | 'commodity' | 'bond' | 'fund' | 'realestate';
  category: AssetCategory;
  price: number;
  weeklyChange: number;
  weeklyChangePct: number;
  volume: string;
  sparkline: number[];
  sector?: string;
  historicalReturns: HistoricalReturns;
}

function generateSparkline(base: number, volatility: number, trend: number): number[] {
  const points: number[] = [];
  let current = base * (1 - volatility * 3);
  for (let i = 0; i < 20; i++) {
    current += (Math.random() - 0.45 + trend * 0.02) * volatility * base;
    current = Math.max(current, base * 0.85);
    points.push(parseFloat(current.toFixed(2)));
  }
  points[points.length - 1] = base;
  return points;
}

function genReturns(bias: number, vol: number): HistoricalReturns {
  const r = (b: number, v: number) => parseFloat(((Math.random() - 0.4) * v + b).toFixed(2));
  return {
    oneMonth: r(bias * 0.3, vol),
    threeMonth: r(bias * 0.8, vol * 1.5),
    sixMonth: r(bias * 1.5, vol * 2),
    ytd: r(bias * 2, vol * 2.5),
    oneYear: r(bias * 3, vol * 3),
  };
}

const MOCK_ASSETS: Asset[] = [
  // BIST Endeksleri
  { symbol: 'XU100', name: 'BIST 100', type: 'index', category: 'bist', price: 9842.50, weeklyChange: 125.30, weeklyChangePct: 1.29, volume: '42.1B', sparkline: generateSparkline(9842, 0.012, 1), historicalReturns: genReturns(2, 5) },
  { symbol: 'XU030', name: 'BIST 30', type: 'index', category: 'bist', price: 10215.80, weeklyChange: -89.40, weeklyChangePct: -0.87, volume: '28.5B', sparkline: generateSparkline(10215, 0.013, -0.5), historicalReturns: genReturns(1.8, 5.5) },
  { symbol: 'XUTEK', name: 'BIST Teknoloji', type: 'index', category: 'bist', price: 4520.30, weeklyChange: 210.50, weeklyChangePct: 4.89, volume: '3.2B', sparkline: generateSparkline(4520, 0.02, 2), historicalReturns: genReturns(4, 8) },
  { symbol: 'XBANK', name: 'BIST Banka', type: 'index', category: 'bist', price: 14325.60, weeklyChange: 312.10, weeklyChangePct: 2.23, volume: '18.7B', sparkline: generateSparkline(14325, 0.015, 1.5), historicalReturns: genReturns(3, 6) },

  // Global Endeksler
  { symbol: 'SPX', name: 'S&P 500', type: 'index', category: 'global', price: 5892.45, weeklyChange: 42.30, weeklyChangePct: 0.72, volume: '4.2B', sparkline: generateSparkline(5892, 0.008, 0.5), historicalReturns: genReturns(1.5, 3) },
  { symbol: 'NDX', name: 'Nasdaq 100', type: 'index', category: 'global', price: 21034.80, weeklyChange: 185.60, weeklyChangePct: 0.89, volume: '3.8B', sparkline: generateSparkline(21034, 0.01, 0.7), historicalReturns: genReturns(2, 4) },
  { symbol: 'DAX', name: 'DAX 40', type: 'index', category: 'global', price: 19842.30, weeklyChange: -124.50, weeklyChangePct: -0.62, volume: '1.2B', sparkline: generateSparkline(19842, 0.009, -0.3), historicalReturns: genReturns(1.2, 3.5) },
  { symbol: 'FTSE', name: 'FTSE 100', type: 'index', category: 'global', price: 8342.15, weeklyChange: 28.90, weeklyChangePct: 0.35, volume: '0.9B', sparkline: generateSparkline(8342, 0.007, 0.3), historicalReturns: genReturns(0.8, 2.5) },
  { symbol: 'N225', name: 'Nikkei 225', type: 'index', category: 'global', price: 39450.20, weeklyChange: -312.40, weeklyChangePct: -0.79, volume: '2.1B', sparkline: generateSparkline(39450, 0.011, -0.5), historicalReturns: genReturns(1.5, 4) },

  // Dövizler
  { symbol: 'USDTRY', name: 'Dolar/TL', type: 'forex', category: 'forex', price: 38.42, weeklyChange: 0.18, weeklyChangePct: 0.47, volume: '12.5B', sparkline: generateSparkline(38.42, 0.005, 0.3), historicalReturns: genReturns(1, 2) },
  { symbol: 'EURTRY', name: 'Euro/TL', type: 'forex', category: 'forex', price: 41.85, weeklyChange: 0.32, weeklyChangePct: 0.77, volume: '5.8B', sparkline: generateSparkline(41.85, 0.006, 0.5), historicalReturns: genReturns(1.2, 2.5) },
  { symbol: 'GBPTRY', name: 'Sterlin/TL', type: 'forex', category: 'forex', price: 48.92, weeklyChange: -0.15, weeklyChangePct: -0.31, volume: '2.1B', sparkline: generateSparkline(48.92, 0.005, -0.2), historicalReturns: genReturns(0.8, 2) },
  { symbol: 'EURUSD', name: 'Euro/Dolar', type: 'forex', category: 'forex', price: 1.0892, weeklyChange: 0.0045, weeklyChangePct: 0.41, volume: '180B', sparkline: generateSparkline(1.0892, 0.004, 0.3), historicalReturns: genReturns(0.3, 1.5) },

  // Kripto Paralar
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', category: 'crypto', price: 104520.00, weeklyChange: 3250.00, weeklyChangePct: 3.21, volume: '42.5B', sparkline: generateSparkline(104520, 0.03, 1.5), historicalReturns: genReturns(8, 15) },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto', category: 'crypto', price: 3842.50, weeklyChange: -124.30, weeklyChangePct: -3.13, volume: '18.2B', sparkline: generateSparkline(3842, 0.035, -1), historicalReturns: genReturns(6, 18) },
  { symbol: 'SOL', name: 'Solana', type: 'crypto', category: 'crypto', price: 215.80, weeklyChange: 18.50, weeklyChangePct: 9.38, volume: '5.6B', sparkline: generateSparkline(215.8, 0.045, 2), historicalReturns: genReturns(12, 25) },
  { symbol: 'AVAX', name: 'Avalanche', type: 'crypto', category: 'crypto', price: 42.35, weeklyChange: -2.10, weeklyChangePct: -4.72, volume: '1.2B', sparkline: generateSparkline(42.35, 0.04, -1.5), historicalReturns: genReturns(5, 20) },

  // Emtialar
  { symbol: 'XAUUSD', name: 'Altın (Ons)', type: 'commodity', category: 'commodity', price: 2685.40, weeklyChange: 32.50, weeklyChangePct: 1.23, volume: '185B', sparkline: generateSparkline(2685, 0.01, 0.8), historicalReturns: genReturns(2, 4) },
  { symbol: 'XAGUSD', name: 'Gümüş (Ons)', type: 'commodity', category: 'commodity', price: 31.25, weeklyChange: 0.85, weeklyChangePct: 2.80, volume: '42B', sparkline: generateSparkline(31.25, 0.015, 1.2), historicalReturns: genReturns(3, 6) },
  { symbol: 'CL', name: 'Ham Petrol (WTI)', type: 'commodity', category: 'commodity', price: 72.45, weeklyChange: -1.85, weeklyChangePct: -2.49, volume: '320B', sparkline: generateSparkline(72.45, 0.02, -1), historicalReturns: genReturns(-1, 8) },
  { symbol: 'NG', name: 'Doğal Gaz', type: 'commodity', category: 'commodity', price: 3.42, weeklyChange: 0.18, weeklyChangePct: 5.56, volume: '85B', sparkline: generateSparkline(3.42, 0.035, 2), historicalReturns: genReturns(2, 12) },

  // Tahviller
  { symbol: 'TRGB10Y', name: 'TR 10Y Tahvil', type: 'bond', category: 'bond', price: 28.45, weeklyChange: -0.15, weeklyChangePct: -0.52, volume: '8.2B', sparkline: generateSparkline(28.45, 0.005, -0.3), historicalReturns: genReturns(0.5, 1.5) },
  { symbol: 'TRGB2Y', name: 'TR 2Y Tahvil', type: 'bond', category: 'bond', price: 42.80, weeklyChange: 0.08, weeklyChangePct: 0.19, volume: '5.1B', sparkline: generateSparkline(42.8, 0.003, 0.1), historicalReturns: genReturns(0.8, 1) },
  { symbol: 'US10Y', name: 'ABD 10Y Treasury', type: 'bond', category: 'bond', price: 4.28, weeklyChange: -0.05, weeklyChangePct: -1.15, volume: '620B', sparkline: generateSparkline(4.28, 0.008, -0.5), historicalReturns: genReturns(0.3, 1.2) },
  { symbol: 'DE10Y', name: 'Almanya 10Y Bund', type: 'bond', category: 'bond', price: 2.35, weeklyChange: 0.03, weeklyChangePct: 1.29, volume: '180B', sparkline: generateSparkline(2.35, 0.006, 0.5), historicalReturns: genReturns(0.2, 0.8) },

  // TEFAS Fonları
  { symbol: 'TI2', name: 'İş Portföy BIST 30', type: 'fund', category: 'tefas', price: 4.2850, weeklyChange: 0.0520, weeklyChangePct: 1.23, volume: '125M', sparkline: generateSparkline(4.285, 0.01, 0.8), historicalReturns: genReturns(2, 4) },
  { symbol: 'YAY', name: 'Yapı Kredi Emeklilik', type: 'fund', category: 'tefas', price: 1.8920, weeklyChange: -0.0180, weeklyChangePct: -0.94, volume: '85M', sparkline: generateSparkline(1.892, 0.008, -0.5), historicalReturns: genReturns(1.5, 3) },
  { symbol: 'GAE', name: 'Garanti BBVA Agresif', type: 'fund', category: 'tefas', price: 3.5420, weeklyChange: 0.0890, weeklyChangePct: 2.58, volume: '210M', sparkline: generateSparkline(3.542, 0.015, 1.5), historicalReturns: genReturns(3, 5) },
  { symbol: 'AK2', name: 'Ak Portföy Teknoloji', type: 'fund', category: 'tefas', price: 5.1280, weeklyChange: 0.2150, weeklyChangePct: 4.38, volume: '95M', sparkline: generateSparkline(5.128, 0.02, 2), historicalReturns: genReturns(4, 7) },

  // ABD Hisse Senetleri
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', category: 'us_stock', price: 198.45, weeklyChange: 4.32, weeklyChangePct: 2.22, volume: '58.2M', sector: 'Technology', sparkline: generateSparkline(198.45, 0.015, 1), historicalReturns: genReturns(2, 5) },
  { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock', category: 'us_stock', price: 442.18, weeklyChange: -3.56, weeklyChangePct: -0.80, volume: '22.1M', sector: 'Technology', sparkline: generateSparkline(442.18, 0.012, -0.5), historicalReturns: genReturns(1.5, 4) },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', category: 'us_stock', price: 135.72, weeklyChange: 8.94, weeklyChangePct: 7.05, volume: '312.5M', sector: 'Technology', sparkline: generateSparkline(135.72, 0.035, 2), historicalReturns: genReturns(8, 12) },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', category: 'us_stock', price: 178.35, weeklyChange: 2.15, weeklyChangePct: 1.22, volume: '25.7M', sector: 'Technology', sparkline: generateSparkline(178.35, 0.013, 0.8), historicalReturns: genReturns(1.8, 4.5) },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', category: 'us_stock', price: 205.74, weeklyChange: -1.23, weeklyChangePct: -0.59, volume: '45.3M', sector: 'Consumer', sparkline: generateSparkline(205.74, 0.014, -0.3), historicalReturns: genReturns(1.2, 5) },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', category: 'us_stock', price: 248.92, weeklyChange: 12.45, weeklyChangePct: 5.27, volume: '98.4M', sector: 'Automotive', sparkline: generateSparkline(248.92, 0.04, 1.5), historicalReturns: genReturns(5, 15) },
  { symbol: 'META', name: 'Meta Platforms', type: 'stock', category: 'us_stock', price: 595.20, weeklyChange: -8.30, weeklyChangePct: -1.37, volume: '15.6M', sector: 'Technology', sparkline: generateSparkline(595.20, 0.018, -0.8), historicalReturns: genReturns(2, 6) },

  // Türkiye Gayrimenkul Piyasası
  { symbol: 'EKGYO', name: 'Emlak Konut GYO', type: 'realestate', category: 'tr_realestate', price: 12.45, weeklyChange: 0.35, weeklyChangePct: 2.89, volume: '520M', sparkline: generateSparkline(12.45, 0.02, 1.2), historicalReturns: genReturns(3, 6) },
  { symbol: 'ISGYO', name: 'İş GYO', type: 'realestate', category: 'tr_realestate', price: 8.92, weeklyChange: -0.18, weeklyChangePct: -1.98, volume: '180M', sparkline: generateSparkline(8.92, 0.018, -0.8), historicalReturns: genReturns(2, 5) },
  { symbol: 'TRGYO', name: 'Torunlar GYO', type: 'realestate', category: 'tr_realestate', price: 5.68, weeklyChange: 0.12, weeklyChangePct: 2.16, volume: '95M', sparkline: generateSparkline(5.68, 0.015, 1), historicalReturns: genReturns(2.5, 5.5) },
  { symbol: 'HLGYO', name: 'Halk GYO', type: 'realestate', category: 'tr_realestate', price: 18.30, weeklyChange: 0.85, weeklyChangePct: 4.86, volume: '310M', sparkline: generateSparkline(18.3, 0.022, 1.8), historicalReturns: genReturns(4, 7) },
];

export async function fetchMarketData(): Promise<Asset[]> {
  await new Promise(resolve => setTimeout(resolve, 800));
  return MOCK_ASSETS.map(asset => ({
    ...asset,
    sparkline: generateSparkline(asset.price, Math.abs(asset.weeklyChangePct) / 100 + 0.005, asset.weeklyChange > 0 ? 1 : -1),
  }));
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
