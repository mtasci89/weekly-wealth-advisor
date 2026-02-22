// ─── Portfolio Snapshot & Performance Tracking ────────────
import { Asset } from './marketData';
import { AnalysisResult } from './analysisEngine';

const SNAPSHOT_KEY = 'portfolyoai_snapshots';
const MAX_SNAPSHOTS = 10;

export interface SnapshotRecommendation {
  symbol: string;
  name: string;
  allocation: number;
  priceAtRecommendation: number;
}

export interface PortfolioSnapshot {
  id: string;
  timestamp: string;          // ISO string for date math
  formattedDate: string;      // tr-TR display string
  recommendations: SnapshotRecommendation[];
  targetReturn: number;
  riskLevel: string;
  dataSource: 'live' | 'mock';
}

export interface PerformanceMetric {
  symbol: string;
  name: string;
  allocation: number;
  priceAtRecommendation: number;
  currentPrice: number;
  changePct: number;            // (current - entry) / entry * 100
  weightedContribution: number; // changePct * allocation / 100
}

export interface PerformanceResult {
  snapshot: PortfolioSnapshot;
  metrics: PerformanceMetric[];
  totalPnL: number;
  daysSince: number;
  hasCurrentPrices: boolean;
}

// ─── Storage helpers ───────────────────────────────────────

function loadRaw(): PortfolioSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PortfolioSnapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshot(snapshot: PortfolioSnapshot): void {
  const all = loadRaw();
  all.push(snapshot);
  // FIFO: keep only last MAX_SNAPSHOTS
  const trimmed = all.slice(-MAX_SNAPSHOTS);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(trimmed));
}

export function loadLastSnapshot(): PortfolioSnapshot | null {
  const all = loadRaw();
  return all.length > 0 ? all[all.length - 1] : null;
}

export function loadAllSnapshots(): PortfolioSnapshot[] {
  return loadRaw();
}

// ─── Build snapshot from a completed analysis ──────────────

export function buildSnapshotFromAnalysis(
  analysis: AnalysisResult,
  assets: Asset[],
  targetReturn: number,
  riskLevel: string,
  dataSource: 'live' | 'mock'
): PortfolioSnapshot {
  const assetMap = new Map(assets.map(a => [a.symbol, a]));

  const recommendations: SnapshotRecommendation[] = analysis.recommendations
    .map(rec => {
      const asset = assetMap.get(rec.symbol);
      return {
        symbol: rec.symbol,
        name: rec.name,
        allocation: rec.allocation,
        priceAtRecommendation: asset?.price ?? 0,
      };
    })
    .filter(r => r.priceAtRecommendation > 0); // skip if price unknown

  return {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    formattedDate: new Date().toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' }),
    recommendations,
    targetReturn,
    riskLevel,
    dataSource,
  };
}

// ─── Calculate P&L against current market prices ──────────

export function calculatePerformance(
  snapshot: PortfolioSnapshot,
  currentAssets: Asset[]
): PerformanceResult {
  const assetMap = new Map(currentAssets.map(a => [a.symbol, a]));

  const metrics: PerformanceMetric[] = [];
  let hasCurrentPrices = false;

  for (const rec of snapshot.recommendations) {
    const current = assetMap.get(rec.symbol);
    if (!current || rec.priceAtRecommendation === 0) continue;

    hasCurrentPrices = true;
    const changePct = parseFloat(
      (((current.price - rec.priceAtRecommendation) / rec.priceAtRecommendation) * 100).toFixed(2)
    );
    const weightedContribution = parseFloat((changePct * rec.allocation / 100).toFixed(3));

    metrics.push({
      symbol: rec.symbol,
      name: rec.name,
      allocation: rec.allocation,
      priceAtRecommendation: rec.priceAtRecommendation,
      currentPrice: current.price,
      changePct,
      weightedContribution,
    });
  }

  const totalPnL = parseFloat(
    metrics.reduce((sum, m) => sum + m.weightedContribution, 0).toFixed(2)
  );

  const snapshotDate = new Date(snapshot.timestamp);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - snapshotDate.getTime()) / (1000 * 60 * 60 * 24));

  return { snapshot, metrics, totalPnL, daysSince, hasCurrentPrices };
}
