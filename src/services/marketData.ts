export interface Asset {
  symbol: string;
  name: string;
  type: 'stock' | 'etf';
  price: number;
  weeklyChange: number;
  weeklyChangePct: number;
  volume: string;
  sparkline: number[];
  sector?: string;
}

function generateSparkline(base: number, volatility: number, trend: number): number[] {
  const points: number[] = [];
  let current = base * (1 - volatility * 3);
  for (let i = 0; i < 20; i++) {
    current += (Math.random() - 0.45 + trend * 0.02) * volatility * base;
    current = Math.max(current, base * 0.85);
    points.push(parseFloat(current.toFixed(2)));
  }
  // Ensure last point is near current price
  points[points.length - 1] = base;
  return points;
}

const MOCK_ASSETS: Asset[] = [
  {
    symbol: 'AAPL', name: 'Apple Inc.', type: 'stock',
    price: 198.45, weeklyChange: 4.32, weeklyChangePct: 2.22,
    volume: '58.2M', sector: 'Technology',
    sparkline: generateSparkline(198.45, 0.015, 1),
  },
  {
    symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock',
    price: 442.18, weeklyChange: -3.56, weeklyChangePct: -0.80,
    volume: '22.1M', sector: 'Technology',
    sparkline: generateSparkline(442.18, 0.012, -0.5),
  },
  {
    symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock',
    price: 135.72, weeklyChange: 8.94, weeklyChangePct: 7.05,
    volume: '312.5M', sector: 'Technology',
    sparkline: generateSparkline(135.72, 0.035, 2),
  },
  {
    symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock',
    price: 178.35, weeklyChange: 2.15, weeklyChangePct: 1.22,
    volume: '25.7M', sector: 'Technology',
    sparkline: generateSparkline(178.35, 0.013, 0.8),
  },
  {
    symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock',
    price: 205.74, weeklyChange: -1.23, weeklyChangePct: -0.59,
    volume: '45.3M', sector: 'Consumer',
    sparkline: generateSparkline(205.74, 0.014, -0.3),
  },
  {
    symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock',
    price: 248.92, weeklyChange: 12.45, weeklyChangePct: 5.27,
    volume: '98.4M', sector: 'Automotive',
    sparkline: generateSparkline(248.92, 0.04, 1.5),
  },
  {
    symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf',
    price: 545.30, weeklyChange: 3.20, weeklyChangePct: 0.59,
    volume: '72.1M',
    sparkline: generateSparkline(545.30, 0.008, 0.5),
  },
  {
    symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf',
    price: 485.60, weeklyChange: 5.80, weeklyChangePct: 1.21,
    volume: '41.8M',
    sparkline: generateSparkline(485.60, 0.01, 0.7),
  },
  {
    symbol: 'VTI', name: 'Vanguard Total Stock', type: 'etf',
    price: 272.15, weeklyChange: 1.45, weeklyChangePct: 0.54,
    volume: '3.2M',
    sparkline: generateSparkline(272.15, 0.007, 0.4),
  },
  {
    symbol: 'META', name: 'Meta Platforms', type: 'stock',
    price: 595.20, weeklyChange: -8.30, weeklyChangePct: -1.37,
    volume: '15.6M', sector: 'Technology',
    sparkline: generateSparkline(595.20, 0.018, -0.8),
  },
];

// Simulate API delay
export async function fetchMarketData(): Promise<Asset[]> {
  await new Promise(resolve => setTimeout(resolve, 800));
  // Add slight randomness each call
  return MOCK_ASSETS.map(asset => ({
    ...asset,
    sparkline: generateSparkline(asset.price, Math.abs(asset.weeklyChangePct) / 100 + 0.005, asset.weeklyChange > 0 ? 1 : -1),
  }));
}

export function getAssetsByType(assets: Asset[], type: 'stock' | 'etf'): Asset[] {
  return assets.filter(a => a.type === type);
}
