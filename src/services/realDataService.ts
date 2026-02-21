import { Asset, AssetCategory, HistoricalReturns } from './marketData';
import { getApiKeys } from './apiKeyStore';

// ─── Yahoo Finance via RapidAPI ────────────────────────────
const RAPIDAPI_HOST = 'yahoo-finance15.p.rapidapi.com';
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}/api/v1`;

function yahooHeaders(): HeadersInit {
  const { yahooFinance } = getApiKeys();
  return {
    'x-rapidapi-key': yahooFinance,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };
}

// BIST symbols need ".IS" suffix for Yahoo Finance
function toBistSymbol(symbol: string): string {
  return `${symbol}.IS`;
}

// ─── Symbol Maps by Category ──────────────────────────────
const SYMBOL_MAP: Record<AssetCategory, { symbol: string; name: string; type: Asset['type']; yahooSymbol?: string }[]> = {
  bist: [
    { symbol: 'XU100', name: 'BIST 100', type: 'index', yahooSymbol: 'XU100.IS' },
    { symbol: 'XU030', name: 'BIST 30', type: 'index', yahooSymbol: 'XU030.IS' },
    { symbol: 'XUTEK', name: 'BIST Teknoloji', type: 'index', yahooSymbol: 'XUTEK.IS' },
    { symbol: 'XBANK', name: 'BIST Banka', type: 'index', yahooSymbol: 'XBANK.IS' },
  ],
  global: [
    { symbol: 'SPX', name: 'S&P 500', type: 'index', yahooSymbol: '^GSPC' },
    { symbol: 'NDX', name: 'Nasdaq 100', type: 'index', yahooSymbol: '^NDX' },
    { symbol: 'DAX', name: 'DAX 40', type: 'index', yahooSymbol: '^GDAXI' },
    { symbol: 'FTSE', name: 'FTSE 100', type: 'index', yahooSymbol: '^FTSE' },
    { symbol: 'N225', name: 'Nikkei 225', type: 'index', yahooSymbol: '^N225' },
  ],
  forex: [
    { symbol: 'USDTRY', name: 'Dolar/TL', type: 'forex', yahooSymbol: 'USDTRY=X' },
    { symbol: 'EURTRY', name: 'Euro/TL', type: 'forex', yahooSymbol: 'EURTRY=X' },
    { symbol: 'GBPTRY', name: 'Sterlin/TL', type: 'forex', yahooSymbol: 'GBPTRY=X' },
    { symbol: 'EURUSD', name: 'Euro/Dolar', type: 'forex', yahooSymbol: 'EURUSD=X' },
  ],
  crypto: [
    { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', yahooSymbol: 'BTC-USD' },
    { symbol: 'ETH', name: 'Ethereum', type: 'crypto', yahooSymbol: 'ETH-USD' },
    { symbol: 'SOL', name: 'Solana', type: 'crypto', yahooSymbol: 'SOL-USD' },
    { symbol: 'AVAX', name: 'Avalanche', type: 'crypto', yahooSymbol: 'AVAX-USD' },
  ],
  commodity: [
    { symbol: 'XAUUSD', name: 'Altın (Ons)', type: 'commodity', yahooSymbol: 'GC=F' },
    { symbol: 'XAGUSD', name: 'Gümüş (Ons)', type: 'commodity', yahooSymbol: 'SI=F' },
    { symbol: 'CL', name: 'Ham Petrol (WTI)', type: 'commodity', yahooSymbol: 'CL=F' },
    { symbol: 'NG', name: 'Doğal Gaz', type: 'commodity', yahooSymbol: 'NG=F' },
  ],
  bond: [
    { symbol: 'TRGB10Y', name: 'TR 10Y Tahvil', type: 'bond' },
    { symbol: 'TRGB2Y', name: 'TR 2Y Tahvil', type: 'bond' },
    { symbol: 'US10Y', name: 'ABD 10Y Treasury', type: 'bond', yahooSymbol: '^TNX' },
    { symbol: 'DE10Y', name: 'Almanya 10Y Bund', type: 'bond' },
  ],
  tefas: [
    { symbol: 'TI2', name: 'İş Portföy BIST 30', type: 'fund' },
    { symbol: 'YAY', name: 'Yapı Kredi Emeklilik', type: 'fund' },
    { symbol: 'GAE', name: 'Garanti BBVA Agresif', type: 'fund' },
    { symbol: 'AK2', name: 'Ak Portföy Teknoloji', type: 'fund' },
  ],
  us_stock: [
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', yahooSymbol: 'AAPL' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock', yahooSymbol: 'MSFT' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', yahooSymbol: 'NVDA' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', yahooSymbol: 'GOOGL' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', yahooSymbol: 'AMZN' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', yahooSymbol: 'TSLA' },
    { symbol: 'META', name: 'Meta Platforms', type: 'stock', yahooSymbol: 'META' },
  ],
  tr_realestate: [
    { symbol: 'EKGYO', name: 'Emlak Konut GYO', type: 'realestate' },
    { symbol: 'ISGYO', name: 'İş GYO', type: 'realestate' },
    { symbol: 'TRGYO', name: 'Torunlar GYO', type: 'realestate' },
    { symbol: 'HLGYO', name: 'Halk GYO', type: 'realestate' },
  ],
};

// ─── Static Real Estate Data (TCMB-style, monthly updated) ─
const STATIC_REALESTATE: Asset[] = [
  {
    symbol: 'EKGYO', name: 'Emlak Konut GYO', type: 'realestate', category: 'tr_realestate',
    price: 12.45, weeklyChange: 0.35, weeklyChangePct: 2.89, volume: '520M',
    sparkline: [11.8, 11.9, 12.0, 12.1, 11.95, 12.05, 12.15, 12.2, 12.1, 12.25, 12.3, 12.18, 12.28, 12.35, 12.3, 12.38, 12.4, 12.42, 12.38, 12.45],
    historicalReturns: { oneMonth: 2.89, threeMonth: 8.42, sixMonth: 15.30, ytd: 22.50, oneYear: 38.20 },
  },
  {
    symbol: 'ISGYO', name: 'İş GYO', type: 'realestate', category: 'tr_realestate',
    price: 8.92, weeklyChange: -0.18, weeklyChangePct: -1.98, volume: '180M',
    sparkline: [9.2, 9.15, 9.1, 9.05, 9.12, 9.0, 8.95, 9.02, 8.98, 8.92, 8.88, 8.95, 8.9, 8.85, 8.92, 8.88, 8.9, 8.95, 8.9, 8.92],
    historicalReturns: { oneMonth: -1.98, threeMonth: 3.25, sixMonth: 10.80, ytd: 18.40, oneYear: 28.50 },
  },
  {
    symbol: 'TRGYO', name: 'Torunlar GYO', type: 'realestate', category: 'tr_realestate',
    price: 5.68, weeklyChange: 0.12, weeklyChangePct: 2.16, volume: '95M',
    sparkline: [5.4, 5.42, 5.45, 5.5, 5.48, 5.52, 5.55, 5.5, 5.53, 5.58, 5.6, 5.55, 5.58, 5.62, 5.6, 5.63, 5.65, 5.64, 5.66, 5.68],
    historicalReturns: { oneMonth: 2.16, threeMonth: 6.80, sixMonth: 12.50, ytd: 20.30, oneYear: 35.80 },
  },
  {
    symbol: 'HLGYO', name: 'Halk GYO', type: 'realestate', category: 'tr_realestate',
    price: 18.30, weeklyChange: 0.85, weeklyChangePct: 4.86, volume: '310M',
    sparkline: [17.0, 17.1, 17.2, 17.35, 17.3, 17.45, 17.5, 17.6, 17.55, 17.7, 17.8, 17.75, 17.85, 17.9, 18.0, 17.95, 18.05, 18.15, 18.2, 18.30],
    historicalReturns: { oneMonth: 4.86, threeMonth: 12.30, sixMonth: 21.50, ytd: 32.80, oneYear: 52.40 },
  },
];

// ─── TEFAS Data Fetcher (placeholder URL — update later) ──
const TEFAS_API_URL = 'https://api.example.com/tefas'; // TODO: Gerçek TEFAS API URL'si ile değiştirin

export async function fetchTefasData(): Promise<Asset[]> {
  try {
    const response = await fetch(TEFAS_API_URL);
    if (!response.ok) throw new Error(`TEFAS API error: ${response.status}`);
    const data = await response.json();
    // Transform TEFAS response to Asset format
    // TODO: Gerçek API yanıtına göre dönüşüm mantığını güncelleyin
    return data;
  } catch {
    throw new Error('TEFAS verileri alınamadı. Placeholder URL aktif — gerçek endpoint ile güncelleyin.');
  }
}

// ─── Yahoo Finance Quote Fetcher ──────────────────────────
async function fetchYahooQuote(yahooSymbol: string): Promise<{
  price: number;
  change: number;
  changePct: number;
  volume: string;
}> {
  const url = `${RAPIDAPI_BASE}/markets/stock/quotes?ticker=${encodeURIComponent(yahooSymbol)}&type=EQUITY`;
  const res = await fetch(url, { headers: yahooHeaders() });
  if (!res.ok) {
    if (res.status === 429) throw new Error('API_RATE_LIMIT');
    if (res.status === 403) throw new Error('API_KEY_INVALID');
    throw new Error(`Yahoo API error: ${res.status}`);
  }
  const json = await res.json();
  const body = json?.body?.[0] || json?.body || {};
  const price = parseFloat(body.regularMarketPrice || body.previousClose || '0');
  const change = parseFloat(body.regularMarketChange || '0');
  const changePct = parseFloat(body.regularMarketChangePercent || '0');
  const rawVol = parseInt(body.regularMarketVolume || '0', 10);
  const volume = rawVol > 1e9 ? `${(rawVol / 1e9).toFixed(1)}B` : rawVol > 1e6 ? `${(rawVol / 1e6).toFixed(1)}M` : `${rawVol}`;

  return { price, change, changePct, volume };
}

// ─── Yahoo Finance Historical Data ───────────────────────
async function fetchYahooHistorical(yahooSymbol: string): Promise<HistoricalReturns> {
  const url = `${RAPIDAPI_BASE}/markets/stock/history?symbol=${encodeURIComponent(yahooSymbol)}&interval=1mo&diffandsplits=false`;
  const res = await fetch(url, { headers: yahooHeaders() });
  if (!res.ok) throw new Error(`Yahoo historical error: ${res.status}`);
  const json = await res.json();
  const items = json?.body || {};
  const timestamps = Object.keys(items).sort();

  const calcReturn = (monthsAgo: number): number => {
    if (timestamps.length < monthsAgo + 1) return 0;
    const current = parseFloat(items[timestamps[timestamps.length - 1]]?.close || '0');
    const past = parseFloat(items[timestamps[Math.max(0, timestamps.length - 1 - monthsAgo)]]?.close || '1');
    return parseFloat(((current - past) / past * 100).toFixed(2));
  };

  return {
    oneMonth: calcReturn(1),
    threeMonth: calcReturn(3),
    sixMonth: calcReturn(6),
    ytd: calcReturn(Math.min(timestamps.length - 1, 12)), // approx
    oneYear: calcReturn(12),
  };
}

// ─── Generate sparkline from price ────────────────────────
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

// ─── Main: Fetch real data for a category ─────────────────
export async function fetchRealCategoryData(category: AssetCategory): Promise<Asset[]> {
  // Static real estate — no API needed
  if (category === 'tr_realestate') {
    return STATIC_REALESTATE;
  }

  // TEFAS — separate endpoint
  if (category === 'tefas') {
    return fetchTefasData();
  }

  const symbols = SYMBOL_MAP[category];
  if (!symbols) return [];

  const results: Asset[] = [];

  for (const sym of symbols) {
    if (!sym.yahooSymbol) continue; // Skip symbols without Yahoo mapping

    try {
      const [quote, historical] = await Promise.all([
        fetchYahooQuote(sym.yahooSymbol),
        fetchYahooHistorical(sym.yahooSymbol),
      ]);

      results.push({
        symbol: sym.symbol,
        name: sym.name,
        type: sym.type,
        category,
        price: quote.price,
        weeklyChange: quote.change,
        weeklyChangePct: quote.changePct,
        volume: quote.volume,
        sparkline: generateSparkline(quote.price, Math.abs(quote.changePct) / 100 + 0.005, quote.change > 0 ? 1 : -1),
        historicalReturns: historical,
      });
    } catch (err) {
      // Re-throw rate limit / invalid key errors to trigger fallback
      if (err instanceof Error && (err.message === 'API_RATE_LIMIT' || err.message === 'API_KEY_INVALID')) {
        throw err;
      }
      // Skip individual symbol errors silently
      console.warn(`Skipped ${sym.symbol}: ${err}`);
    }
  }

  return results;
}

// ─── Fetch all categories with real data ──────────────────
export async function fetchAllRealData(): Promise<Asset[]> {
  const categories: AssetCategory[] = ['bist', 'global', 'forex', 'crypto', 'commodity', 'bond', 'tefas', 'us_stock', 'tr_realestate'];
  const allAssets: Asset[] = [];

  for (const cat of categories) {
    try {
      const assets = await fetchRealCategoryData(cat);
      allAssets.push(...assets);
    } catch (err) {
      // Propagate critical errors
      if (err instanceof Error && (err.message === 'API_RATE_LIMIT' || err.message === 'API_KEY_INVALID')) {
        throw err;
      }
    }
  }

  return allAssets;
}
