import { Asset, AssetCategory, HistoricalReturns } from './marketData';
import { getApiKeys, hasYahooKey } from './apiKeyStore';
import { TechnicalSignal, buildTechnicalSignal } from './technicalEngine';

// ─── Yahoo Finance via RapidAPI ────────────────────────────
const RAPIDAPI_HOST = 'yahoo-finance15.p.rapidapi.com';
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}/api/v1`;
// Pro plan: 5 istek/saniye → 200ms minimum aralık
const API_THROTTLE_MS = 200;

// ─── Çift katmanlı önbellek: in-memory (hız) + localStorage (kalıcılık) ──
// TTL: 15 dakika — sayfa yenilense bile API'ye tekrar istek atılmaz.
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_PREFIX = 'portfolyoai_cache_';

interface CacheEntry {
  data: Asset[];
  ts: number;
}

// Aynı oturumda hızlı erişim için bellek kopyası
const _memCache = new Map<string, CacheEntry>();

/** TTL'si geçmemiş veriyi döndürür; yoksa null */
function fromCache(key: string): Asset[] | null {
  // 1. Bellek (hızlı)
  const mem = _memCache.get(key);
  if (mem) {
    if (Date.now() - mem.ts <= CACHE_TTL_MS) return mem.data;
    _memCache.delete(key);
  }
  // 2. localStorage (sayfa yenileme sonrası)
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null; // süresi dolmuş
    _memCache.set(key, entry); // belleği ısıt
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * TTL kontrolü yapmadan eski veriyi döndürür.
 * 429 rate-limit durumunda stale fallback olarak kullanılır.
 */
function fromStaleCache(key: string): Asset[] | null {
  const mem = _memCache.get(key);
  if (mem) return mem.data;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return (JSON.parse(raw) as CacheEntry).data;
  } catch {
    return null;
  }
}

/** Veriyi hem belleğe hem localStorage'a yazar */
function toCache(key: string, data: Asset[]): void {
  const entry: CacheEntry = { data, ts: Date.now() };
  _memCache.set(key, entry);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    // localStorage dolu olabilir (5MB sınırı) — yalnızca bellek kullan
    console.warn('Cache yazılamadı (localStorage dolu?):', e);
  }
}

/** Belirli bir kategori veya tüm önbelleği temizle */
export function invalidateCache(category?: AssetCategory): void {
  if (category) {
    _memCache.delete(category);
    localStorage.removeItem(CACHE_PREFIX + category);
  } else {
    _memCache.clear();
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
}

// ─── Rate-limit sinyal bayrağı ─────────────────────────────
let _rateLimitHit = false;
export function wasRateLimited(): boolean { return _rateLimitHit; }
export function clearRateLimitFlag(): void { _rateLimitHit = false; }

// ─── USD/TRY Kuru (basit in-memory önbellek, 1 saat TTL) ───
let _usdTryCache: { rate: number; ts: number } | null = null;
const USD_TRY_TTL_MS = 60 * 60 * 1000; // 1 saat

/**
 * Yahoo Finance'dan güncel USD/TRY kurunu çeker.
 * Başarısız olursa makul bir fallback kullanır.
 */
export async function fetchUsdTryRate(): Promise<number> {
  if (_usdTryCache && Date.now() - _usdTryCache.ts < USD_TRY_TTL_MS) {
    return _usdTryCache.rate;
  }
  try {
    const res = await fetch(
      `${RAPIDAPI_BASE}/markets/stock/quotes?ticker=USDTRY%3DX`,
      { headers: yahooHeaders() }
    );
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = await res.json();
    const rate = data?.body?.[0]?.regularMarketPrice ?? 0;
    if (rate > 10) {
      // Makul USD/TRY değeri (>10 TL)
      _usdTryCache = { rate, ts: Date.now() };
      return rate;
    }
  } catch (e) {
    console.warn('USD/TRY kuru alınamadı, fallback kullanılıyor:', e);
  }
  // Fallback: localStorage'da son bilinenı dene, yoksa sabit
  const saved = localStorage.getItem('portfolyoai_usdtry');
  if (saved) {
    const parsed = parseFloat(saved);
    if (parsed > 10) return parsed;
  }
  return 34.0; // son çare sabit değer
}

/** Anlık USD/TRY kurunu döndürür (önbellekten, sync) */
export function getCachedUsdTryRate(): number {
  if (_usdTryCache && _usdTryCache.rate > 10) return _usdTryCache.rate;
  const saved = localStorage.getItem('portfolyoai_usdtry');
  if (saved) { const p = parseFloat(saved); if (p > 10) return p; }
  return 34.0;
}

// ─── Helpers ──────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function yahooHeaders(): HeadersInit {
  const { yahooFinance } = getApiKeys();
  if (!yahooFinance.trim()) throw new Error('API_KEY_MISSING');
  return {
    'x-rapidapi-key': yahooFinance,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };
}

function fmtVolume(raw: number): string {
  if (raw > 1e9) return `${(raw / 1e9).toFixed(1)}B`;
  if (raw > 1e6) return `${(raw / 1e6).toFixed(1)}M`;
  if (raw > 1e3) return `${(raw / 1e3).toFixed(1)}K`;
  if (raw > 0) return `${raw}`;
  return '—';
}

function generateSparkline(base: number, volatility: number, trend: number): number[] {
  const points: number[] = [];
  let current = base * (1 - volatility * 3);
  for (let i = 0; i < 20; i++) {
    current += (Math.random() - 0.45 + trend * 0.02) * volatility * base;
    current = Math.max(current, base * 0.85);
    points.push(parseFloat(current.toFixed(4)));
  }
  points[points.length - 1] = base;
  return points;
}

function handleHttpError(status: number): never {
  if (status === 429) throw new Error('API_RATE_LIMIT');
  if (status === 401 || status === 403) throw new Error('API_KEY_INVALID');
  throw new Error(`HTTP_${status}`);
}

// ─── Sabit sembol haritası (endeks, döviz, kripto, emtia, tahvil, GYO) ───
interface SymbolEntry {
  symbol: string;
  name: string;
  type: Asset['type'];
  yahooSymbol?: string;
}

const FIXED_SYMBOLS: Partial<Record<AssetCategory, SymbolEntry[]>> = {
  bist: [
    // ── Endeksler ────────────────────────────────────────────
    { symbol: 'XU100', name: 'BIST 100', type: 'index', yahooSymbol: 'XU100.IS' },
    { symbol: 'XU030', name: 'BIST 30', type: 'index', yahooSymbol: 'XU030.IS' },
    { symbol: 'XUTEK', name: 'BIST Teknoloji', type: 'index', yahooSymbol: 'XUTEK.IS' },
    { symbol: 'XBANK', name: 'BIST Banka', type: 'index', yahooSymbol: 'XBANK.IS' },
    // ── Son 6 ay en iyi performans gösteren BIST hisseleri (BIST100 bileşenleri) ──
    { symbol: 'THYAO', name: 'Türk Hava Yolları', type: 'stock', yahooSymbol: 'THYAO.IS' },
    { symbol: 'TUPRS', name: 'Tüpraş', type: 'stock', yahooSymbol: 'TUPRS.IS' },
    { symbol: 'GARAN', name: 'Garanti BBVA', type: 'stock', yahooSymbol: 'GARAN.IS' },
    { symbol: 'ASELS', name: 'Aselsan', type: 'stock', yahooSymbol: 'ASELS.IS' },
    { symbol: 'SISE', name: 'Şişe Cam', type: 'stock', yahooSymbol: 'SISE.IS' },
    { symbol: 'EREGL', name: 'Ereğli Demir Çelik', type: 'stock', yahooSymbol: 'EREGL.IS' },
    { symbol: 'BIMAS', name: 'BİM Mağazalar', type: 'stock', yahooSymbol: 'BIMAS.IS' },
    { symbol: 'KCHOL', name: 'Koç Holding', type: 'stock', yahooSymbol: 'KCHOL.IS' },
    { symbol: 'AKBNK', name: 'Akbank', type: 'stock', yahooSymbol: 'AKBNK.IS' },
    { symbol: 'ISCTR', name: 'İş Bankası (C)', type: 'stock', yahooSymbol: 'ISCTR.IS' },
    { symbol: 'SAHOL', name: 'Sabancı Holding', type: 'stock', yahooSymbol: 'SAHOL.IS' },
    { symbol: 'TOASO', name: 'Tofaş Otomobil', type: 'stock', yahooSymbol: 'TOASO.IS' },
    { symbol: 'FROTO', name: 'Ford Otosan', type: 'stock', yahooSymbol: 'FROTO.IS' },
    { symbol: 'PGSUS', name: 'Pegasus Hava Taşımacılığı', type: 'stock', yahooSymbol: 'PGSUS.IS' },
    { symbol: 'TCELL', name: 'Turkcell', type: 'stock', yahooSymbol: 'TCELL.IS' },
    { symbol: 'ENKAI', name: 'Enka İnşaat', type: 'stock', yahooSymbol: 'ENKAI.IS' },
    { symbol: 'KOZAL', name: 'Koza Altın', type: 'stock', yahooSymbol: 'KOZAL.IS' },
    { symbol: 'PETKM', name: 'Petkim', type: 'stock', yahooSymbol: 'PETKM.IS' },
    { symbol: 'KRDMD', name: 'Kardemir (D)', type: 'stock', yahooSymbol: 'KRDMD.IS' },
    { symbol: 'EKGYO', name: 'Emlak Konut GYO', type: 'stock', yahooSymbol: 'EKGYO.IS' },
    { symbol: 'VESTL', name: 'Vestel', type: 'stock', yahooSymbol: 'VESTL.IS' },
    { symbol: 'DOHOL', name: 'Doğan Holding', type: 'stock', yahooSymbol: 'DOHOL.IS' },
    { symbol: 'YKBNK', name: 'Yapı Kredi Bankası', type: 'stock', yahooSymbol: 'YKBNK.IS' },
    { symbol: 'HALKB', name: 'Halkbank', type: 'stock', yahooSymbol: 'HALKB.IS' },
    { symbol: 'VAKBN', name: 'Vakıfbank', type: 'stock', yahooSymbol: 'VAKBN.IS' },
    { symbol: 'ARCLK', name: 'Arçelik', type: 'stock', yahooSymbol: 'ARCLK.IS' },
    { symbol: 'BRISA', name: 'Brisa', type: 'stock', yahooSymbol: 'BRISA.IS' },
    { symbol: 'ULKER', name: 'Ülker Bisküvi', type: 'stock', yahooSymbol: 'ULKER.IS' },
    { symbol: 'TAVHL', name: 'TAV Havalimanları', type: 'stock', yahooSymbol: 'TAVHL.IS' },
    // ── Ek 22 BIST100 hissesi (son 6 ayda güçlü momentum) ──
    { symbol: 'KOZAA', name: 'Koza Anadolu Metal', type: 'stock', yahooSymbol: 'KOZAA.IS' },
    { symbol: 'MGROS', name: 'Migros Ticaret', type: 'stock', yahooSymbol: 'MGROS.IS' },
    { symbol: 'TTKOM', name: 'Türk Telekomunikasyon', type: 'stock', yahooSymbol: 'TTKOM.IS' },
    { symbol: 'SOKM', name: 'Şok Marketler', type: 'stock', yahooSymbol: 'SOKM.IS' },
    { symbol: 'OYAKC', name: 'Oyak Çimento', type: 'stock', yahooSymbol: 'OYAKC.IS' },
    { symbol: 'CIMSA', name: 'Çimsa Çimento', type: 'stock', yahooSymbol: 'CIMSA.IS' },
    { symbol: 'TKFEN', name: 'Tekfen Holding', type: 'stock', yahooSymbol: 'TKFEN.IS' },
    { symbol: 'KONTR', name: 'Kontrolmatik Teknoloji', type: 'stock', yahooSymbol: 'KONTR.IS' },
    { symbol: 'SASA', name: 'Sasa Polyester', type: 'stock', yahooSymbol: 'SASA.IS' },
    { symbol: 'ODAS', name: 'Odaş Elektrik', type: 'stock', yahooSymbol: 'ODAS.IS' },
    { symbol: 'GUBRF', name: 'Gübre Fabrikaları', type: 'stock', yahooSymbol: 'GUBRF.IS' },
    { symbol: 'ISDMR', name: 'İsdemir', type: 'stock', yahooSymbol: 'ISDMR.IS' },
    { symbol: 'GESAN', name: 'Gediz Elektrik San.', type: 'stock', yahooSymbol: 'GESAN.IS' },
    { symbol: 'LOGO', name: 'Logo Yazılım', type: 'stock', yahooSymbol: 'LOGO.IS' },
    { symbol: 'NETAS', name: 'Netaş Telekomünikasyon', type: 'stock', yahooSymbol: 'NETAS.IS' },
    { symbol: 'CCOLA', name: 'Coca-Cola İçecek', type: 'stock', yahooSymbol: 'CCOLA.IS' },
    { symbol: 'AGHOL', name: 'AG Anadolu Grubu Holding', type: 'stock', yahooSymbol: 'AGHOL.IS' },
    { symbol: 'KERVT', name: 'Kerevitaş Gıda', type: 'stock', yahooSymbol: 'KERVT.IS' },
    { symbol: 'MAVI', name: 'Mavi Giyim', type: 'stock', yahooSymbol: 'MAVI.IS' },
    { symbol: 'ALARK', name: 'Alarko Holding', type: 'stock', yahooSymbol: 'ALARK.IS' },
    { symbol: 'ENJSA', name: 'Enerjisa Enerji', type: 'stock', yahooSymbol: 'ENJSA.IS' },
    { symbol: 'ZOREN', name: 'Zorlu Enerji', type: 'stock', yahooSymbol: 'ZOREN.IS' },
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
    { symbol: 'USDJPY', name: 'Dolar/JPY', type: 'forex', yahooSymbol: 'JPY=X' },
    { symbol: 'XAUTRY', name: 'Altın/TL (gr)', type: 'forex', yahooSymbol: 'XAUTRY=X' },
  ],
  crypto: [
    { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', yahooSymbol: 'BTC-USD' },
    { symbol: 'ETH', name: 'Ethereum', type: 'crypto', yahooSymbol: 'ETH-USD' },
    { symbol: 'SOL', name: 'Solana', type: 'crypto', yahooSymbol: 'SOL-USD' },
    { symbol: 'AVAX', name: 'Avalanche', type: 'crypto', yahooSymbol: 'AVAX-USD' },
    { symbol: 'BNB', name: 'BNB', type: 'crypto', yahooSymbol: 'BNB-USD' },
    { symbol: 'XRP', name: 'Ripple', type: 'crypto', yahooSymbol: 'XRP-USD' },
  ],
  commodity: [
    { symbol: 'XAUUSD', name: 'Altın (Ons)', type: 'commodity', yahooSymbol: 'GC=F' },
    { symbol: 'XAGUSD', name: 'Gümüş (Ons)', type: 'commodity', yahooSymbol: 'SI=F' },
    { symbol: 'CL', name: 'Ham Petrol (WTI)', type: 'commodity', yahooSymbol: 'CL=F' },
    { symbol: 'NG', name: 'Doğal Gaz', type: 'commodity', yahooSymbol: 'NG=F' },
    { symbol: 'HG', name: 'Bakır', type: 'commodity', yahooSymbol: 'HG=F' },
  ],
  bond: [
    { symbol: 'US10Y', name: 'ABD 10Y Treasury', type: 'bond', yahooSymbol: '^TNX' },
    { symbol: 'US30Y', name: 'ABD 30Y Treasury', type: 'bond', yahooSymbol: '^TYX' },
    { symbol: 'US05Y', name: 'ABD 5Y Treasury', type: 'bond', yahooSymbol: '^FVX' },
    // TR ve DE tahvilleri: TCMB EVDS backend gerektirdiği için şimdilik atlandı
  ],
  us_stock: [
    // ── Mega-cap teknoloji ────────────────────────────────────
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', yahooSymbol: 'AAPL' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock', yahooSymbol: 'MSFT' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', yahooSymbol: 'NVDA' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', yahooSymbol: 'GOOGL' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', yahooSymbol: 'AMZN' },
    { symbol: 'META', name: 'Meta Platforms', type: 'stock', yahooSymbol: 'META' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', yahooSymbol: 'TSLA' },
    { symbol: 'ORCL', name: 'Oracle Corp.', type: 'stock', yahooSymbol: 'ORCL' },
    { symbol: 'ADBE', name: 'Adobe Inc.', type: 'stock', yahooSymbol: 'ADBE' },
    { symbol: 'AMD', name: 'Advanced Micro Devices', type: 'stock', yahooSymbol: 'AMD' },
    { symbol: 'AVGO', name: 'Broadcom Inc.', type: 'stock', yahooSymbol: 'AVGO' },
    { symbol: 'INTC', name: 'Intel Corp.', type: 'stock', yahooSymbol: 'INTC' },
    { symbol: 'CRM', name: 'Salesforce Inc.', type: 'stock', yahooSymbol: 'CRM' },
    { symbol: 'NFLX', name: 'Netflix Inc.', type: 'stock', yahooSymbol: 'NFLX' },
    { symbol: 'PLTR', name: 'Palantir Technologies', type: 'stock', yahooSymbol: 'PLTR' },
    // ── Finans ────────────────────────────────────────────────
    { symbol: 'JPM', name: 'JPMorgan Chase', type: 'stock', yahooSymbol: 'JPM' },
    { symbol: 'BAC', name: 'Bank of America', type: 'stock', yahooSymbol: 'BAC' },
    { symbol: 'GS', name: 'Goldman Sachs', type: 'stock', yahooSymbol: 'GS' },
    { symbol: 'V', name: 'Visa Inc.', type: 'stock', yahooSymbol: 'V' },
    { symbol: 'MA', name: 'Mastercard Inc.', type: 'stock', yahooSymbol: 'MA' },
    { symbol: 'BRK-B', name: 'Berkshire Hathaway B', type: 'stock', yahooSymbol: 'BRK-B' },
    { symbol: 'MS', name: 'Morgan Stanley', type: 'stock', yahooSymbol: 'MS' },
    { symbol: 'BX', name: 'Blackstone Inc.', type: 'stock', yahooSymbol: 'BX' },
    // ── Sağlık & Biyoteknoloji ───────────────────────────────
    { symbol: 'JNJ', name: 'Johnson & Johnson', type: 'stock', yahooSymbol: 'JNJ' },
    { symbol: 'LLY', name: 'Eli Lilly', type: 'stock', yahooSymbol: 'LLY' },
    { symbol: 'UNH', name: 'UnitedHealth Group', type: 'stock', yahooSymbol: 'UNH' },
    { symbol: 'AMGN', name: 'Amgen Inc.', type: 'stock', yahooSymbol: 'AMGN' },
    // ── Savunma & Sanayi ─────────────────────────────────────
    { symbol: 'RTX', name: 'RTX Corp (Raytheon)', type: 'stock', yahooSymbol: 'RTX' },
    { symbol: 'LMT', name: 'Lockheed Martin', type: 'stock', yahooSymbol: 'LMT' },
    { symbol: 'NOC', name: 'Northrop Grumman', type: 'stock', yahooSymbol: 'NOC' },
    { symbol: 'CAT', name: 'Caterpillar Inc.', type: 'stock', yahooSymbol: 'CAT' },
    { symbol: 'DE', name: 'Deere & Company', type: 'stock', yahooSymbol: 'DE' },
    // ── Enerji ───────────────────────────────────────────────
    { symbol: 'XOM', name: 'ExxonMobil', type: 'stock', yahooSymbol: 'XOM' },
    { symbol: 'CVX', name: 'Chevron Corp.', type: 'stock', yahooSymbol: 'CVX' },
    { symbol: 'COP', name: 'ConocoPhillips', type: 'stock', yahooSymbol: 'COP' },
    // ── Tüketici ─────────────────────────────────────────────
    { symbol: 'COST', name: 'Costco Wholesale', type: 'stock', yahooSymbol: 'COST' },
    { symbol: 'WMT', name: 'Walmart Inc.', type: 'stock', yahooSymbol: 'WMT' },
    { symbol: 'MCD', name: "McDonald's Corp.", type: 'stock', yahooSymbol: 'MCD' },
    { symbol: 'NKE', name: 'Nike Inc.', type: 'stock', yahooSymbol: 'NKE' },
    { symbol: 'SBUX', name: 'Starbucks Corp.', type: 'stock', yahooSymbol: 'SBUX' },
    // ── Gayrimenkul & Altyapı ────────────────────────────────
    { symbol: 'AMT', name: 'American Tower REIT', type: 'stock', yahooSymbol: 'AMT' },
    { symbol: 'NEE', name: 'NextEra Energy', type: 'stock', yahooSymbol: 'NEE' },
    // ── ETF'ler ───────────────────────────────────────────────
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf', yahooSymbol: 'SPY' },
    { symbol: 'QQQ', name: 'Invesco QQQ (Nasdaq)', type: 'etf', yahooSymbol: 'QQQ' },
    { symbol: 'GLD', name: 'SPDR Gold Shares', type: 'etf', yahooSymbol: 'GLD' },
    { symbol: 'IWM', name: 'iShares Russell 2000', type: 'etf', yahooSymbol: 'IWM' },
    { symbol: 'XLK', name: 'Technology Select SPDR', type: 'etf', yahooSymbol: 'XLK' },
    { symbol: 'XLF', name: 'Financial Select SPDR', type: 'etf', yahooSymbol: 'XLF' },
    { symbol: 'ARKK', name: 'ARK Innovation ETF', type: 'etf', yahooSymbol: 'ARKK' },
  ],
};

// ─── Yahoo Finance Quote (tek sembol) ─────────────────────
async function fetchYahooQuote(yahooSymbol: string): Promise<{
  price: number;
  change: number;
  changePct: number;
  volume: string;
}> {
  const url = `${RAPIDAPI_BASE}/markets/stock/quotes?ticker=${encodeURIComponent(yahooSymbol)}&type=EQUITY`;
  const res = await fetch(url, { headers: yahooHeaders() });
  if (!res.ok) handleHttpError(res.status);
  const json = await res.json();
  const body = json?.body?.[0] ?? json?.body ?? {};
  return {
    price: parseFloat(body.regularMarketPrice ?? body.previousClose ?? '0'),
    change: parseFloat(body.regularMarketChange ?? '0'),
    changePct: parseFloat(body.regularMarketChangePercent ?? '0'),
    volume: fmtVolume(parseInt(body.regularMarketVolume ?? '0', 10)),
  };
}

// ─── Yahoo Finance Historical (aylık kapanışlar) ──────────
async function fetchYahooHistorical(yahooSymbol: string): Promise<HistoricalReturns> {
  const url = `${RAPIDAPI_BASE}/markets/stock/history?symbol=${encodeURIComponent(yahooSymbol)}&interval=1mo&diffandsplits=false`;
  const res = await fetch(url, { headers: yahooHeaders() });
  if (!res.ok) handleHttpError(res.status);
  const json = await res.json();
  const items = json?.body ?? {};
  const timestamps = Object.keys(items).sort();

  const calcReturn = (monthsAgo: number): number => {
    if (timestamps.length < monthsAgo + 1) return 0;
    const current = parseFloat(items[timestamps[timestamps.length - 1]]?.close ?? '0');
    const past = parseFloat(items[timestamps[Math.max(0, timestamps.length - 1 - monthsAgo)]]?.close ?? '1');
    return parseFloat(((current - past) / past * 100).toFixed(2));
  };

  return {
    oneMonth: calcReturn(1),
    threeMonth: calcReturn(3),
    sixMonth: calcReturn(6),
    ytd: calcReturn(Math.min(timestamps.length - 1, 12)),
    oneYear: calcReturn(12),
  };
}

// ─── Yahoo Finance Screener (en aktif hisseler) ───────────
// region='TR' → BIST'in en aktif 50 hissesi
// region='US' → ABD'nin en aktif 50 hissesi (S&P 500 bileşenleri dahil)
async function fetchScreener(region: string, category: AssetCategory, count = 50): Promise<Asset[]> {
  const url = `${RAPIDAPI_BASE}/markets/screener?list=most_actives&region=${region}&count=${count}`;
  const res = await fetch(url, { headers: yahooHeaders() });
  if (!res.ok) handleHttpError(res.status);
  const json = await res.json();

  // API versiyonuna göre yanıt yapısı farklı olabilir
  const quotes: unknown[] = (
    (json?.body as Record<string, unknown>)?.quotes as unknown[] ??
    json?.body as unknown[] ??
    json?.result as unknown[] ??
    []
  );

  return (quotes as Record<string, unknown>[])
    .filter(q => {
      if (!q?.symbol || parseFloat(String(q.regularMarketPrice ?? '0')) <= 0) return false;
      const raw = String(q.symbol);
      // BIST: sadece .IS uzantılı; US: .IS uzantısı olmamalı
      if (category === 'bist') return raw.endsWith('.IS');
      if (category === 'us_stock') return !raw.endsWith('.IS');
      return true;
    })
    .map((q): Asset => {
      const rawSymbol = String(q.symbol ?? '');
      const symbol = rawSymbol.replace('.IS', '');
      const price = parseFloat(String(q.regularMarketPrice ?? '0'));
      const change = parseFloat(String(q.regularMarketChange ?? '0'));
      const changePct = parseFloat(String(q.regularMarketChangePercent ?? '0'));
      return {
        symbol,
        name: String(q.longName ?? q.shortName ?? symbol),
        type: 'stock',
        category,
        price,
        weeklyChange: change,
        weeklyChangePct: changePct,
        volume: fmtVolume(parseInt(String(q.regularMarketVolume ?? '0'), 10)),
        sparkline: generateSparkline(price, Math.abs(changePct) / 100 + 0.005, change > 0 ? 1 : -1),
        // Screener sonuçlarında historical 0 — detay sayfasında lazy fetch yapılabilir
        historicalReturns: { oneMonth: 0, threeMonth: 0, sixMonth: 0, ytd: 0, oneYear: 0 },
        sector: q.sector ? String(q.sector) : undefined,
      };
    });
}

// ─── Sabit semboller için tek tek quote + historical çek ──
async function fetchFixedSymbols(category: AssetCategory, usdTryRate = 34.0): Promise<Asset[]> {
  const symbols = FIXED_SYMBOLS[category] ?? [];
  const results: Asset[] = [];
  const isBist = category === 'bist';

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    if (!sym.yahooSymbol) continue;
    if (i > 0) await sleep(API_THROTTLE_MS);

    try {
      const quote = await fetchYahooQuote(sym.yahooSymbol);
      await sleep(API_THROTTLE_MS);
      const historical = await fetchYahooHistorical(sym.yahooSymbol);

      // BIST hisseleri TL cinsinden — USD'ye çevir
      const priceUsd = isBist && usdTryRate > 0
        ? parseFloat((quote.price / usdTryRate).toFixed(4))
        : quote.price;

      results.push({
        symbol: sym.symbol,
        name: sym.name,
        type: sym.type,
        category,
        price: quote.price,          // yerel para birimi (gösterim)
        priceUsd,                    // USD karşılığı (karşılaştırma)
        weeklyChange: quote.change,
        weeklyChangePct: quote.changePct,
        volume: quote.volume,
        sparkline: generateSparkline(
          quote.price,
          Math.abs(quote.changePct) / 100 + 0.005,
          quote.change > 0 ? 1 : -1,
        ),
        historicalReturns: historical,
      });
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'API_RATE_LIMIT' ||
          err.message === 'API_KEY_INVALID' ||
          err.message === 'API_KEY_MISSING')
      ) {
        throw err;
      }
      console.warn(`Skipped ${sym.symbol}:`, err);
    }
  }

  return results;
}

// ─── TEFAS Fon Listesi (20 fon) ───────────────────────────
// Kaynak: tefas.gov.tr — Vite proxy (/proxy/tefas) üzerinden erişilir.
// Production dağıtımında bu endpoint için bir reverse proxy veya
// serverless fonksiyon gereklidir (CORS kısıtlaması nedeniyle).
// fontip: 'YAT' = Yatırım Fonu, 'EMK' = Emeklilik Fonu, 'BYF' = Borsa Yatırım Fonu (ETF)
const TEFAS_FUNDS: { code: string; name: string; type: string }[] = [
  // ── Hisse senedi ağırlıklı fonlar ───────────────────────
  { code: 'TI2', name: 'İş Port. BIST 30 Endeks Fonu', type: 'YAT' },
  { code: 'IHB', name: 'İş Port. Hisse Senedi Fonu', type: 'YAT' },
  { code: 'AFA', name: 'Ak Port. Hisse Senedi Fonu', type: 'YAT' },
  { code: 'GAE', name: 'Garanti BBVA Port. Agresif Hisse', type: 'YAT' },
  { code: 'GCK', name: 'Garanti BBVA Port. Çoğunluk Hisse', type: 'YAT' },
  { code: 'KYA', name: 'Kare Port. Hisse Senedi Fonu', type: 'YAT' },
  { code: 'KBC', name: 'Kare Port. BIST-50 Endeks Fonu', type: 'YAT' },
  { code: 'TRK', name: 'TSKB Port. Hisse Senedi Fonu', type: 'YAT' },
  { code: 'DPS', name: 'Deniz Port. Sürdürülebilir Hisse', type: 'YAT' },
  { code: 'FBK', name: 'Fiba Port. Banka Hisse Fonu', type: 'YAT' },
  { code: 'OST', name: 'Osmanlı Port. Sürdürülebilir Hisse', type: 'YAT' },
  { code: 'TTE', name: 'Tacirler Port. Teknoloji Hisse', type: 'YAT' },
  { code: 'YAH', name: 'Yapı Kredi Port. Hisse Fonu', type: 'YAT' },
  { code: 'AFT', name: 'Ak Port. Temettü Hisse Fonu', type: 'YAT' },
  { code: 'GEC', name: 'Gedik Port. Hisse Fonu', type: 'YAT' },
  { code: 'ZKH', name: 'Ziraat Port. Hisse Fonu', type: 'YAT' },
  { code: 'ZKS', name: 'Ziraat Port. BIST100 Endeks Fonu', type: 'YAT' },
  { code: 'VEF', name: 'Vakıf Port. Hisse Fonu', type: 'YAT' },
  { code: 'HBH', name: 'Halk Port. Hisse Fonu', type: 'YAT' },
  { code: 'DZH', name: 'Deniz Port. Hisse Fonu', type: 'YAT' },
  // ── Altın / emtia fonları ────────────────────────────────
  { code: 'ALT', name: 'Ak Port. Altın Fonu', type: 'YAT' },
  { code: 'GMO', name: 'Gedik Port. Altın Fonu', type: 'YAT' },
  { code: 'YGA', name: 'Yapı Kredi Port. Altın Fonu', type: 'YAT' },
  { code: 'AEM', name: 'Ata Port. Emtia Yab. BYF Fonu', type: 'YAT' },
  { code: 'GAF', name: 'Garanti BBVA Port. Altın Fonu', type: 'YAT' },
  { code: 'ZAF', name: 'Ziraat Port. Altın Fonu', type: 'YAT' },
  { code: 'IAL', name: 'İş Port. Altın Fonu', type: 'YAT' },
  { code: 'HAL', name: 'Halk Port. Altın Fonu', type: 'YAT' },
  // ── Para piyasası / kısa vadeli fonlar ───────────────────
  { code: 'IPB', name: 'İş Port. Para Piyasası Fonu', type: 'YAT' },
  { code: 'GPS', name: 'Garanti BBVA Port. Para Piyasası', type: 'YAT' },
  { code: 'ZKP', name: 'Ziraat Port. Para Piyasası Fonu', type: 'YAT' },
  { code: 'AFP', name: 'Ak Port. Para Piyasası Fonu', type: 'YAT' },
  { code: 'YPP', name: 'Yapı Kredi Port. Para Piyasası', type: 'YAT' },
  // ── Sabit getiri / tahvil fonları ────────────────────────
  { code: 'ZKT', name: 'Ziraat Port. Tahvil Fonu', type: 'YAT' },
  { code: 'AFB', name: 'Ak Port. Tahvil Fonu', type: 'YAT' },
  { code: 'ITB', name: 'İş Port. Tahvil ve Bono Fonu', type: 'YAT' },
  { code: 'GKB', name: 'Garanti BBVA Port. Tahvil Fonu', type: 'YAT' },
  { code: 'YKT', name: 'Yapı Kredi Port. Tahvil Fonu', type: 'YAT' },
  // ── Dengeli / Karma Fonlar ────────────────────────────────
  { code: 'IEK', name: 'İş Port. Esnek Fonu', type: 'YAT' },
  { code: 'GEK', name: 'Gedik Port. Esnek Fonu', type: 'YAT' },
  { code: 'AEK', name: 'Ak Port. Esnek Fonu', type: 'YAT' },
  { code: 'ZEF', name: 'Ziraat Port. Esnek Fonu', type: 'YAT' },
  { code: 'KEF', name: 'Kare Port. Esnek Fonu', type: 'YAT' },
  // ── Gayrimenkul fonları ───────────────────────────────────
  { code: 'NGY', name: 'Nurol Port. Gayrimenkul Fonu', type: 'YAT' },
  // ── Yabancı BYF / Global varlık fonları ──────────────────
  { code: 'AK2', name: 'Ak Port. Teknoloji Yab. BYF Fonu', type: 'YAT' },
  { code: 'YAY', name: 'Yapı Kredi Port. Yab. BYF Fonu', type: 'YAT' },
  { code: 'ISY', name: 'İş Port. Yab. BYF Fonu', type: 'YAT' },
  { code: 'GYB', name: 'Garanti BBVA Port. Yab. BYF Fonu', type: 'YAT' },
  { code: 'TGF', name: 'Tacirler Port. Global Hisse Fonu', type: 'YAT' },
  { code: 'GHS', name: 'Gedik Port. Yapay Zeka BYF Fonu', type: 'YAT' },
];

export async function fetchTefasData(): Promise<Asset[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 21); // 3 haftalık veri → daha güvenilir sparkline

  // TEFAS API DD.MM.YYYY formatında tarih bekler
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  const results: Asset[] = [];

  for (let i = 0; i < TEFAS_FUNDS.length; i++) {
    const fund = TEFAS_FUNDS[i];
    if (i > 0) await sleep(350); // TEFAS rate-limit hassas

    try {
      // Doğru endpoint: /api/DB/BindHistoryInfo
      // Vite proxy: /proxy/tefas/BindHistoryInfo → https://www.tefas.gov.tr/api/DB/BindHistoryInfo
      const res = await fetch('/proxy/tefas/BindHistoryInfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: new URLSearchParams({
          fontip: fund.type,       // 'YAT' | 'EMK' | 'BYF'
          fonkod: fund.code,       // Fon kodu (ör: TI2)
          bastarih: fmt(startDate),
          bittarih: fmt(endDate),
          sfontur: '',
          fongrup: '',
          fonturkod: '',
          fonunvantip: '',
        }).toString(),
      });
      if (!res.ok) throw new Error(`TEFAS_HTTP_${res.status}`);

      const json = await res.json();
      // Yanıt formatı: { data: [...] } veya direkt dizi
      const rows: Record<string, unknown>[] =
        (json?.data as Record<string, unknown>[]) ??
        (Array.isArray(json) ? (json as Record<string, unknown>[]) : []);

      if (rows.length === 0) continue;

      // En güncel satır sonda
      const latest = rows[rows.length - 1];
      const prev = rows.length > 1 ? rows[rows.length - 2] : rows[0];

      // TEFAS alanları: FIYAT (bazı endpointlerde küçük harf ya da İngilizce)
      const price = parseFloat(String(
        latest.FIYAT ?? latest.fiyat ?? latest.price ?? latest.NAV ?? '0'
      ));
      if (!price || price === 0) continue;

      const prevPrice = parseFloat(String(
        prev.FIYAT ?? prev.fiyat ?? prev.price ?? prev.NAV ?? String(price)
      ));
      const change = parseFloat((price - prevPrice).toFixed(4));
      const changePct = prevPrice > 0
        ? parseFloat(((change / prevPrice) * 100).toFixed(2))
        : 0;
      const portfoyBuyuklugu = parseInt(String(
        latest.PORTFOYBUYUKLUGU ?? latest.portfoyBuyuklugu ?? latest.PORTFOYDEGERI ?? '0'
      ), 10);

      const sparkline = rows
        .slice(-20)
        .map(r => parseFloat(String(r.FIYAT ?? r.fiyat ?? r.price ?? r.NAV ?? '0')))
        .filter(p => p > 0);

      results.push({
        symbol: fund.code,
        name: fund.name,
        type: 'fund',
        category: 'tefas',
        price,
        weeklyChange: change,
        weeklyChangePct: changePct,
        volume: fmtVolume(portfoyBuyuklugu),
        sparkline: sparkline.length >= 5
          ? sparkline
          : generateSparkline(price, 0.01, changePct > 0 ? 1 : -1),
        historicalReturns: { oneMonth: 0, threeMonth: 0, sixMonth: 0, ytd: 0, oneYear: 0 },
      });
    } catch (err) {
      console.warn(`TEFAS skipped ${fund.code}:`, err);
    }
  }

  if (results.length === 0) {
    throw new Error(
      'TEFAS_UNAVAILABLE: TEFAS API yanıt vermedi. ' +
      'Geliştirme ortamında Vite proxy aktif olmalı (npm run dev). ' +
      'Production için /api/DB/BindHistoryInfo\'ya yönlendiren bir reverse proxy gereklidir.',
    );
  }

  return results;
}

// ─── Ana kategori veri çekici (önbellekli / lazy load) ────
export async function fetchRealCategoryData(
  category: AssetCategory,
  usdTryRate = 34.0
): Promise<Asset[]> {
  // Geçerli önbellek varsa API'ye hiç gitme
  const cached = fromCache(category);
  if (cached) return cached;

  let data: Asset[];

  try {
    switch (category) {
      case 'tefas':
        data = await fetchTefasData();
        break;

      case 'bist':
        data = await fetchFixedSymbols('bist', usdTryRate);
        break;

      case 'us_stock':
        data = await fetchFixedSymbols('us_stock', usdTryRate);
        break;

      default:
        data = await fetchFixedSymbols(category, usdTryRate);
    }
  } catch (err) {
    // ── 429 Rate-limit: stale önbellekten sun ─────────────
    if (err instanceof Error && err.message === 'API_RATE_LIMIT') {
      const stale = fromStaleCache(category);
      if (stale) {
        _rateLimitHit = true;
        return stale;
      }
    }
    throw err;
  }

  if (data.length > 0) toCache(category, data);
  return data;
}

// ─── Tüm kategorileri sırayla çek ─────────────────────────
export async function fetchAllRealData(): Promise<Asset[]> {
  // Önce USD/TRY kurunu al — BIST hisseleri USD bazında karşılaştırılacak
  let usdTryRate = 34.0;
  try {
    usdTryRate = await fetchUsdTryRate();
    localStorage.setItem('portfolyoai_usdtry', usdTryRate.toString());
  } catch {
    console.warn('USD/TRY kuru alınamadı, varsayılan kullanılıyor:', usdTryRate);
  }

  const categories: AssetCategory[] = [
    'bist',
    'global',
    'forex',
    'crypto',
    'commodity',
    'bond',
    'tefas',
    'us_stock',
  ];
  const allAssets: Asset[] = [];

  for (const cat of categories) {
    try {
      const assets = await fetchRealCategoryData(cat, usdTryRate);
      allAssets.push(...assets);
    } catch (err) {
      if (err instanceof Error) {
        // Geçersiz/eksik anahtar → hemen durdur
        if (err.message === 'API_KEY_INVALID' || err.message === 'API_KEY_MISSING') throw err;
        // Stale cache'siz 429 → bu kategoriyi atla, bayrağı set et, devam et
        if (err.message === 'API_RATE_LIMIT') {
          _rateLimitHit = true;
          console.warn(`Rate-limit: ${cat} kategorisi stale veri olmadan atlandı.`);
          continue;
        }
      }
      console.warn(`Kategori ${cat} başarısız:`, err);
    }
  }

  return allAssets;
}

// ─── Teknik analiz için günlük kapanış fiyatları ──────────
export async function fetchDailyPrices(yahooSymbol: string, days = 30): Promise<number[]> {
  try {
    const url = `${RAPIDAPI_BASE}/markets/stock/history?symbol=${encodeURIComponent(yahooSymbol)}&interval=1d&diffandsplits=false`;
    const res = await fetch(url, { headers: yahooHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.body ?? {};
    const timestamps = Object.keys(items).sort();
    return timestamps
      .slice(-days)
      .map(ts => parseFloat(String((items as Record<string, Record<string, unknown>>)[ts]?.close ?? (items as Record<string, Record<string, unknown>>)[ts]?.adjclose ?? '0')))
      .filter(p => p > 0);
  } catch {
    return [];
  }
}

// ─── RSI / SMA teknik sinyaller ───────────────────────────
export async function fetchTechnicalSignals(assets: Asset[]): Promise<TechnicalSignal[]> {
  if (!hasYahooKey()) return [];

  // yahooSymbol haritası: FIXED_SYMBOLS + screener varlıkları için çıkarım
  const yahooLookup = new Map<string, string>();
  for (const entries of Object.values(FIXED_SYMBOLS)) {
    for (const entry of entries) {
      if (entry.yahooSymbol) yahooLookup.set(entry.symbol, entry.yahooSymbol);
    }
  }
  // Screener'dan gelen BIST hisseleri: symbol + '.IS'
  for (const asset of assets) {
    if (!yahooLookup.has(asset.symbol)) {
      if (asset.category === 'bist') {
        yahooLookup.set(asset.symbol, `${asset.symbol}.IS`);
      } else if (asset.category === 'us_stock') {
        yahooLookup.set(asset.symbol, asset.symbol);
      }
    }
  }

  const candidates = [...assets]
    .filter(a => yahooLookup.has(a.symbol))
    .sort((a, b) => Math.abs(b.weeklyChangePct) - Math.abs(a.weeklyChangePct))
    .slice(0, 8);

  const signals: TechnicalSignal[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const asset = candidates[i];
    const yahooSymbol = yahooLookup.get(asset.symbol)!;
    if (i > 0) await sleep(API_THROTTLE_MS);
    const prices = await fetchDailyPrices(yahooSymbol, 30);
    if (prices.length >= 2) {
      signals.push(buildTechnicalSignal(asset.symbol, prices));
    }
  }

  return signals;
}
