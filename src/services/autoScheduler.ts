/**
 * autoScheduler.ts
 * ─────────────────────────────────────────────────────────────
 * Her Pazar sabahı 09:00+ portföy analizini otomatik tetikler.
 * Sayfa açık olduğu sürece her 30 dakikada koşulları kontrol eder;
 * aynı gün zaten tetiklendiyse bir daha ASLA çalışmaz.
 */

import { PortfolioSnapshot } from './snapshotService';

// ── localStorage keys ────────────────────────────────────────
/** YYYY-MM-DD formatında son otomatik analiz tarihi */
const KEY_LAST_AUTO  = 'portfolyoai_last_auto_sunday';
/** Önceki öneri sembolleri (diff hesabı için) */
const KEY_PREV_RECS  = 'portfolyoai_prev_recommendations';

// ── Types ─────────────────────────────────────────────────────

export type RecommendationAction = 'BUY' | 'SELL' | 'HOLD' | 'NEW';

export interface RecommendationDiff {
  symbol: string;
  name: string;
  allocation: number;
  action: RecommendationAction;
  /** Önceki portföydeki ağırlık (SELL/HOLD için) */
  prevAllocation?: number;
  /** Ağırlık değişimi (+/−) */
  allocationDelta?: number;
}

export interface PortfolioDiff {
  diffs: RecommendationDiff[];
  hasChanges: boolean;
  /** Yeni eklenen semboller */
  newSymbols: string[];
  /** Çıkarılan semboller */
  removedSymbols: string[];
  /** Ağırlığı değişen semboller */
  changedSymbols: string[];
}

// ── Diff hesaplama ─────────────────────────────────────────────

interface PrevRec { symbol: string; name: string; allocation: number }

function loadPrevRecommendations(): PrevRec[] {
  try {
    const raw = localStorage.getItem(KEY_PREV_RECS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePrevRecommendations(recs: PrevRec[]): void {
  localStorage.setItem(KEY_PREV_RECS, JSON.stringify(recs));
}

/**
 * Yeni öneri listesini öncekiyle karşılaştırır.
 * Hangi hisselerin alınacağı / satılacağı / tutulacağı belirlenir.
 */
export function computePortfolioDiff(
  newSnapshot: PortfolioSnapshot,
  prevRecs: PrevRec[] = loadPrevRecommendations()
): PortfolioDiff {
  const prevMap = new Map(prevRecs.map(r => [r.symbol, r]));
  const newMap  = new Map(newSnapshot.recommendations.map(r => [r.symbol, r]));

  const diffs: RecommendationDiff[] = [];
  const newSymbols: string[]     = [];
  const removedSymbols: string[] = [];
  const changedSymbols: string[] = [];

  for (const [symbol, rec] of newMap) {
    const prev = prevMap.get(symbol);
    if (!prev) {
      diffs.push({ symbol, name: rec.name, allocation: rec.allocation, action: 'NEW' });
      newSymbols.push(symbol);
    } else {
      const delta = rec.allocation - prev.allocation;
      diffs.push({
        symbol,
        name: rec.name,
        allocation: rec.allocation,
        prevAllocation: prev.allocation,
        allocationDelta: delta,
        action: 'HOLD',
      });
      if (Math.abs(delta) >= 3) changedSymbols.push(symbol);
    }
  }

  for (const [symbol, prev] of prevMap) {
    if (!newMap.has(symbol)) {
      diffs.push({
        symbol,
        name: prev.name,
        allocation: 0,
        prevAllocation: prev.allocation,
        allocationDelta: -prev.allocation,
        action: 'SELL',
      });
      removedSymbols.push(symbol);
    }
  }

  diffs.sort((a, b) => {
    const order: Record<RecommendationAction, number> = { NEW: 0, HOLD: 1, BUY: 0, SELL: 2 };
    return order[a.action] - order[b.action];
  });

  const hasChanges = newSymbols.length > 0 || removedSymbols.length > 0 || changedSymbols.length > 0;
  return { diffs, hasChanges, newSymbols, removedSymbols, changedSymbols };
}

/** Snapshot kaydedildikten sonra çağrılır — bir sonraki diff için önceki öneriyi kaydet */
export function updatePrevRecommendations(snapshot: PortfolioSnapshot): void {
  savePrevRecommendations(
    snapshot.recommendations.map(r => ({
      symbol: r.symbol,
      name: r.name,
      allocation: r.allocation,
    }))
  );
}

// ── Zamanlama yardımcıları ──────────────────────────────────────

/** Bugünün tarihini YYYY-MM-DD formatında döndürür */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Otomatik analizin tetiklenip tetiklenmeyeceğini belirler.
 * Koşullar:
 *   1. Bugün Pazar (getDay() === 0)
 *   2. Yerel saat 09:00 veya sonrası
 *   3. localStorage'da bu güne ait kayıt YOK (haftada 1 kez garantisi)
 */
function shouldTrigger(): boolean {
  const now = new Date();

  // 1) Pazar mı?
  if (now.getDay() !== 0) return false;

  // 2) Saat 09:00 veya sonrası mı?
  if (now.getHours() < 9) return false;

  // 3) Bugün zaten çalıştı mı? (en kritik guard)
  const lastRun = localStorage.getItem(KEY_LAST_AUTO);
  if (lastRun === todayStr()) return false;

  return true;
}

/**
 * Analiz başarıyla tamamlandığında çağrılır.
 * localStorage'a bugünün tarihini yazar → aynı gün tekrar tetiklenmez.
 */
export function markAutoAnalyzedToday(): void {
  localStorage.setItem(KEY_LAST_AUTO, todayStr());
}

/** Bu hafta için otomatik analiz zaten yapıldı mı? */
export function wasAutoAnalyzedToday(): boolean {
  return localStorage.getItem(KEY_LAST_AUTO) === todayStr();
}

/** Son otomatik analiz tarihini okunabilir string olarak döndürür */
export function getLastAutoAnalysisLabel(): string | null {
  const raw = localStorage.getItem(KEY_LAST_AUTO);
  if (!raw) return null;
  try {
    const d = new Date(raw);
    return d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch { return raw; }
}

// ── Scheduler ──────────────────────────────────────────────────

export interface AutoAnalysisCallback {
  onTrigger: () => Promise<void>;
}

/**
 * Pazar sabahı 09:00+ otomatik analiz zamanlayıcısını başlatır.
 *
 * Akış:
 *   - Sayfa yüklenince 3sn gecikmeyle ilk kontrol
 *   - Sonra her 30 dakikada bir kontrol
 *   - shouldTrigger() false döndüğü sürece HİÇBİR ŞEY yapmaz
 *   - Tetiklenince markAutoAnalyzedToday() çağrılır → o gün bir daha girmez
 *
 * @returns Cleanup fonksiyonu (useEffect return'ü için)
 */
export function startAutoScheduler(cb: AutoAnalysisCallback): () => void {
  let _running = false; // eş zamanlı çift tetiklenmeyi önle

  const check = async () => {
    if (_running) return;          // önceki çalışma bitmemişse atla
    if (!shouldTrigger()) return;  // koşullar sağlanmıyorsa atla

    _running = true;
    try {
      // Önce tarihi işaretle — hata olsa bile o gün tekrar denemez
      markAutoAnalyzedToday();
      await cb.onTrigger();
    } catch (err) {
      console.warn('[AutoScheduler] onTrigger hata verdi:', err);
    } finally {
      _running = false;
    }
  };

  const initTimer = setTimeout(check, 3000);
  const interval  = setInterval(check, 30 * 60 * 1000);

  return () => {
    clearTimeout(initTimer);
    clearInterval(interval);
  };
}
