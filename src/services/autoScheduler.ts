/**
 * autoScheduler.ts
 * ─────────────────────────────────────────────────────────────
 * Her Pazar sabahı 09:00+ portföy analizini otomatik tetikler.
 * Sayfa açık olduğu sürece her 30 dakikada koşulları kontrol eder.
 *
 * KOTA KORUMA KATMANLARI (en az bir tanesi geçerliyse tetiklenmez):
 *   1. Bugün Pazar değilse → pass
 *   2. Saat 09:00'dan önceyse → pass
 *   3. Bu hafta (ISO hafta numarası) zaten çalıştıysa → pass  ← ANA GUARD
 *   4. Bu gün (YYYY-MM-DD) zaten çalıştıysa → pass             ← İKİNCİL GUARD
 *   5. _running bayrağı → eş zamanlı çift tetiklenme engeli
 *
 * ⚠️  DEVRE DIŞI — Index.tsx'te startAutoScheduler çağrısı comment'lendi.
 *     Yeniden aktifleştirme talimatı Index.tsx'teki comment'te.
 */

import { PortfolioSnapshot } from './snapshotService';

// ── localStorage keys ────────────────────────────────────────
/** YYYY-MM-DD formatında son otomatik analiz günü */
const KEY_LAST_AUTO       = 'portfolyoai_last_auto_sunday';
/** "YYYY-Www" formatında son otomatik analiz ISO haftası */
const KEY_LAST_AUTO_WEEK  = 'portfolyoai_last_auto_week';
/** ISO timestamp — tam tarih/saat damgası (bilgi amaçlı) */
const KEY_LAST_AUTO_TS    = 'portfolyoai_last_auto_timestamp';
/** Önceki öneri sembolleri (diff hesabı için) */
const KEY_PREV_RECS       = 'portfolyoai_prev_recommendations';

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
 * ISO 8601 hafta numarasını "YYYY-Www" formatında döndürür.
 * Örnek: 2026-W08  (2026'nın 8. haftası)
 *
 * Algoritma: Perşembe bazlı ISO hafta — JS'in getDay() Pazar=0 olduğuna dikkat.
 */
function isoWeekStr(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Perşembe: ISO haftasının ortası. İlgili haftanın Perşembesine snap et.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo    = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Otomatik analizin tetiklenip tetiklenmeyeceğini belirler.
 * 5 katmanlı kota koruması:
 *   1. Bugün Pazar (getDay() === 0)
 *   2. Yerel saat 09:00 veya sonrası
 *   3. Bu ISO haftasında zaten çalıştı mı?  ← ANA haftalık guard
 *   4. Bu gün (YYYY-MM-DD) zaten çalıştı mı?  ← ikincil günlük guard
 *   (5. _running bayrağı — startAutoScheduler içinde yönetilir)
 */
function shouldTrigger(): boolean {
  const now = new Date();

  // 1) Pazar mı?
  if (now.getDay() !== 0) return false;

  // 2) Saat 09:00 veya sonrası mı?
  if (now.getHours() < 9) return false;

  // 3) Bu ISO haftasında zaten çalıştı mı? (en güçlü guard)
  const lastWeek = localStorage.getItem(KEY_LAST_AUTO_WEEK);
  if (lastWeek === isoWeekStr(now)) return false;

  // 4) Bu gün (YYYY-MM-DD) zaten çalıştı mı? (ikincil guard)
  const lastDay = localStorage.getItem(KEY_LAST_AUTO);
  if (lastDay === todayStr()) return false;

  return true;
}

/**
 * Analiz tetiklenmeden ÖNCE çağrılır (hata olsa bile tekrar tetiklenmez).
 * Hem günlük hem haftalık hem tam timestamp kaydeder.
 */
export function markAutoAnalyzedToday(): void {
  const now = new Date();
  localStorage.setItem(KEY_LAST_AUTO,      todayStr());
  localStorage.setItem(KEY_LAST_AUTO_WEEK, isoWeekStr(now));
  localStorage.setItem(KEY_LAST_AUTO_TS,   now.toISOString());
}

/** Bu hafta için otomatik analiz zaten yapıldı mı? */
export function wasAutoAnalyzedToday(): boolean {
  // Hem günlük hem haftalık kontrol et
  return (
    localStorage.getItem(KEY_LAST_AUTO)      === todayStr() ||
    localStorage.getItem(KEY_LAST_AUTO_WEEK) === isoWeekStr()
  );
}

/** Son otomatik analiz tarihini okunabilir string olarak döndürür */
export function getLastAutoAnalysisLabel(): string | null {
  // Önce tam timestamp, yoksa gün bazlı tarihe bak
  const ts  = localStorage.getItem(KEY_LAST_AUTO_TS);
  const day = localStorage.getItem(KEY_LAST_AUTO);
  const raw = ts || day;
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
