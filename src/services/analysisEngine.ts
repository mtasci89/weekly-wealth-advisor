import { Asset } from './marketData';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface PortfolioRecommendation {
  symbol: string;
  name: string;
  allocation: number; // percentage
  rationale: string;
}

export interface AnalysisResult {
  summary: string;
  recommendations: PortfolioRecommendation[];
  riskNote: string;
  timestamp: string;
}

/**
 * Rule-based analysis engine.
 * Strictly uses only provided data — no hallucination.
 * Later: replace with Claude API call.
 */
export function generateAnalysis(
  assets: Asset[],
  targetReturn: number,
  riskLevel: RiskLevel
): AnalysisResult {
  const timestamp = new Date().toLocaleString('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  // Sort by weekly performance
  const sorted = [...assets].sort((a, b) => b.weeklyChangePct - a.weeklyChangePct);
  const gainers = sorted.filter(a => a.weeklyChangePct > 0);
  const losers = sorted.filter(a => a.weeklyChangePct < 0);

  // ETFs for stability
  const etfs = assets.filter(a => a.type === 'etf');
  const stocks = assets.filter(a => a.type === 'stock');

  let recommendations: PortfolioRecommendation[] = [];

  if (riskLevel === 'low') {
    // Heavy ETF allocation, pick top stable gainers
    const topEtfs = etfs.sort((a, b) => b.weeklyChangePct - a.weeklyChangePct).slice(0, 2);
    const safeStocks = gainers.filter(a => a.type === 'stock' && a.weeklyChangePct < 3).slice(0, 2);
    const picks = [...topEtfs, ...safeStocks];
    const per = Math.floor(100 / Math.max(picks.length, 1));
    recommendations = picks.map((a, i) => ({
      symbol: a.symbol,
      name: a.name,
      allocation: i === 0 ? per + (100 - per * picks.length) : per,
      rationale: a.type === 'etf'
        ? `Düşük volatiliteli ETF. Haftalık değişim: %${a.weeklyChangePct.toFixed(2)}.`
        : `Istikrarlı büyüme trendi. Haftalık: %${a.weeklyChangePct.toFixed(2)}.`,
    }));
  } else if (riskLevel === 'medium') {
    const topGainers = gainers.filter(a => a.type === 'stock').slice(0, 3);
    const bestEtf = etfs.sort((a, b) => b.weeklyChangePct - a.weeklyChangePct)[0];
    const picks = bestEtf ? [...topGainers, bestEtf] : topGainers;
    const per = Math.floor(100 / Math.max(picks.length, 1));
    recommendations = picks.map((a, i) => ({
      symbol: a.symbol,
      name: a.name,
      allocation: i === 0 ? per + (100 - per * picks.length) : per,
      rationale: a.type === 'etf'
        ? `Portföy dengeleme amaçlı. Haftalık: %${a.weeklyChangePct.toFixed(2)}.`
        : `Güçlü haftalık momentum: %${a.weeklyChangePct.toFixed(2)}. Hacim: ${a.volume}.`,
    }));
  } else {
    // High risk — top movers, no ETFs
    const topMovers = gainers.filter(a => a.type === 'stock').slice(0, 4);
    const per = Math.floor(100 / Math.max(topMovers.length, 1));
    recommendations = topMovers.map((a, i) => ({
      symbol: a.symbol,
      name: a.name,
      allocation: i === 0 ? per + (100 - per * topMovers.length) : per,
      rationale: `Yüksek momentum: %${a.weeklyChangePct.toFixed(2)}. Agresif pozisyon.`,
    }));
  }

  const avgReturn = recommendations.reduce((sum, r) => {
    const asset = assets.find(a => a.symbol === r.symbol);
    return sum + (asset ? asset.weeklyChangePct * r.allocation / 100 : 0);
  }, 0);

  const riskLabels: Record<RiskLevel, string> = {
    low: 'Düşük',
    medium: 'Orta',
    high: 'Yüksek',
  };

  const summary = `## Haftalık Portföy Stratejisi

**Hedef Getiri:** %${targetReturn} | **Risk Profili:** ${riskLabels[riskLevel]}

Bu hafta piyasa genelinde ${gainers.length > losers.length ? 'pozitif' : 'karışık'} bir seyir gözlemlenmektedir. ${gainers.length} enstrüman yükselirken, ${losers.length} enstrüman düşüş göstermiştir.

En güçlü performans **${sorted[0].symbol}** (+%${sorted[0].weeklyChangePct.toFixed(2)}) tarafında görülürken, en zayıf performans **${sorted[sorted.length - 1].symbol}** (%${sorted[sorted.length - 1].weeklyChangePct.toFixed(2)}) olmuştur.

Önerilen portföy ağırlıklı ortalama beklenen haftalık getirisi **%${avgReturn.toFixed(2)}** seviyesindedir.${avgReturn < targetReturn ? ` Bu, hedeflenen %${targetReturn} getirisinin altında kalmaktadır — piyasa koşulları göz önünde bulundurulmalıdır.` : ''}`;

  const riskNote = riskLevel === 'high'
    ? '⚠️ Yüksek riskli portföy. Yüksek volatilite beklenmektedir. Sadece kaybetmeyi göze alabileceğiniz tutarları yatırın.'
    : riskLevel === 'medium'
    ? 'ℹ️ Dengeli portföy. Orta düzey volatilite ile istikrarlı büyüme hedeflenmektedir.'
    : '✅ Düşük riskli, korumacı portföy. Sermaye koruması ön plandadır.';

  return { summary, recommendations, riskNote, timestamp };
}
