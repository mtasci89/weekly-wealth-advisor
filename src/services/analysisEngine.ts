import { Asset } from './marketData';
import { getApiKeys, hasClaudeKey } from './apiKeyStore';
import { TechnicalSignal, formatSignalsForPrompt } from './technicalEngine';
import { MacroContext } from './webSearchService';

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
  whyNow?: string;        // "Neden şimdi?" — piyasa konjonktürü
  risks?: string;         // "Riskler neler?" — downside senaryolar
  opportunities?: string; // "Fırsatlar nerede?" — upside katalizörler
  isAiGenerated?: boolean; // Claude mı yoksa rule-based mi
}

// ─── Claude API Integration ────────────────────────────────

function buildMarketSnapshot(assets: Asset[]): string {
  const sorted = [...assets].sort((a, b) => b.weeklyChangePct - a.weeklyChangePct);
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();

  const categorySummary = assets.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = { count: 0, avgChange: 0, sum: 0 };
    acc[a.category].count++;
    acc[a.category].sum += a.weeklyChangePct;
    acc[a.category].avgChange = parseFloat((acc[a.category].sum / acc[a.category].count).toFixed(2));
    return acc;
  }, {} as Record<string, { count: number; avgChange: number; sum: number }>);

  const catLines = Object.entries(categorySummary)
    .map(([cat, data]) => `  - ${cat.toUpperCase()}: Ort. Haftalık %${data.avgChange > 0 ? '+' : ''}${data.avgChange} (${data.count} enstrüman)`)
    .join('\n');

  const topLines = top5
    .map(a => `  - ${a.symbol} (${a.name}): %${a.weeklyChangePct > 0 ? '+' : ''}${a.weeklyChangePct.toFixed(2)}, Fiyat: ${a.price.toFixed(2)}`)
    .join('\n');

  const bottomLines = bottom5
    .map(a => `  - ${a.symbol} (${a.name}): %${a.weeklyChangePct.toFixed(2)}, Fiyat: ${a.price.toFixed(2)}`)
    .join('\n');

  return `KATEGORI BAZLI HAFTALIK PERFORMANS:\n${catLines}\n\nEN GÜÇLÜ 5 ENSTRÜMAN:\n${topLines}\n\nEN ZAYIF 5 ENSTRÜMAN:\n${bottomLines}`;
}

function buildClaudePrompt(
  assets: Asset[],
  targetReturn: number,
  riskLevel: RiskLevel,
  technicalSignals: TechnicalSignal[] = [],
  macroContext?: MacroContext
): string {
  const riskLabels: Record<RiskLevel, string> = {
    low: 'Düşük (Sermaye Koruma)',
    medium: 'Orta (Dengeli Büyüme)',
    high: 'Yüksek (Agresif Büyüme)',
  };
  const snapshot = buildMarketSnapshot(assets);
  const now = new Date().toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' });
  const availableSymbols = assets.map(a => `${a.symbol} (${a.name}, ${a.type})`).join(', ');
  const technicalSection = technicalSignals.length > 0
    ? `\n${formatSignalsForPrompt(technicalSignals)}\n`
    : '';
  const macroSection = macroContext?.success && macroContext.text
    ? `\n${macroContext.text}\n`
    : '';

  // Aylık %X hedefin haftalık karşılığı (bileşik)
  const weeklyEquiv = (((1 + targetReturn / 100) ** (1 / 4.33) - 1) * 100).toFixed(2);

  return `Sen deneyimli bir Türk portföy yöneticisi ve Senior Portfolio Manager olarak görev yapıyorsun. Güncel piyasa verilerine, teknik analiz sinyallerine, makroekonomik gelişmelere ve kullanıcı tercihlerine göre profesyonel bir aylık portföy önerisi yap.

ANALİZ TARİHİ: ${now}

KULLANICI TERCİHLERİ:
- Hedef Aylık Getiri: %${targetReturn} (USD bazlı) — haftalık eşdeğer: ~%${weeklyEquiv}
- Risk Toleransı: ${riskLabels[riskLevel]}

ÖNEMLİ: Tüm getirileri USD bazında değerlendir. BIST hisseleri için hem TL getiri hem kur etkisini göz önünde bulundur.

${snapshot}
${technicalSection}${macroSection}
MEVCUT ENSTRÜMANLARdan seçim yap (sadece bu liste):
${availableSymbols}

GÖREVIN:
1. Piyasa konjonktürünü VE teknik analiz sinyallerini birlikte değerlendirerek %100'lük ideal varlık dağılımı öner (5-6 enstrüman)
2. Her önerilen enstrüman için şunları yaz:
   - Bu ay neden değer kazanmasını bekliyorsun? (somut katalizör, momentum veya makro gerekçe)
   - USD bazında tahmini aylık getiri beklentisi (örn: "+%2-4 USD bazında")
   - Teknik durumu kısaca (örn: "RSI 55, yükselen kanal")
3. "Neden şimdi?", "Riskler neler?", "Fırsatlar nerede?" sorularını yanıtla

YANIT FORMATI (SADECE GEÇERLİ JSON, başka metin yok):
{
  "summary": "Genel piyasa durumu ve bu ay için strateji odağı (2-3 cümle, Türkçe — 'Aylık portföy stratejisi' gibi başlık KULLANMA, direkt içeriğe geç)",
  "recommendations": [
    {
      "symbol": "GERÇEK_SYMBOL",
      "name": "Enstrüman Adı",
      "allocation": 30,
      "rationale": "Bu ay neden artmasını bekliyoruz ve USD bazında tahmini getiri: örn. Fed faiz kararı öncesi güçlü momentum, USD bazında +%3-5 beklentisi. RSI 58, haftalık kırılım var."
    }
  ],
  "riskNote": "Risk profili özeti (1 cümle)",
  "whyNow": "Bu ay neden harekete geçmek mantıklı? (1-2 cümle, somut veri ile)",
  "risks": "Başlıca downside riskler neler? (1-2 cümle, spesifik)",
  "opportunities": "En cazip fırsatlar nerede? (1-2 cümle, spesifik enstrüman/sektör)"
}

KURALLAR:
- Toplam allocation tam olarak %100 olmalı
- Sadece yukarıdaki mevcut enstrüman listesinden seç
- Aynı sembolü önerilerde birden fazla kez KULLANMA (her sembol en fazla bir kez)
- 5-6 enstrüman seç, TÜM kategorilerden dengeli bir karışım oluştur
- Risk profiline uygun ağırlık dağılımı:
  * Düşük risk: TEFAS %25-35 | Tahvil/Emtia %30-40 | Hisse %20-30 | Kripto max %5
  * Orta risk: BIST+US Hisse %35-45 | TEFAS %15-25 | Emtia %10-15 | Kripto %10-15 | Tahvil %5-15
  * Yüksek risk: Hisse %40-50 | Kripto %20-30 | Emtia %10-15 | TEFAS max %10
- Tüm metinler Türkçe
- RSI > 70 olan varlıkların ağırlığını düşür; RSI < 30 olanlarda temkinli davran
- Yanıt SADECE JSON olsun, markdown veya açıklama ekleme`;
}

export async function generateClaudeAnalysis(
  assets: Asset[],
  targetReturn: number,
  riskLevel: RiskLevel,
  technicalSignals: TechnicalSignal[] = [],
  macroContext?: MacroContext
): Promise<AnalysisResult> {
  const timestamp = new Date().toLocaleString('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  if (!hasClaudeKey()) {
    return generateAnalysis(assets, targetReturn, riskLevel);
  }

  const prompt = buildClaudePrompt(assets, targetReturn, riskLevel, technicalSignals, macroContext);

  // Vercel serverless proxy (production) veya Vite proxy (dev) üzerinden
  const ANALYSIS_URL = '/api/claude';

  try {
    const response = await fetch(ANALYSIS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKeys().claude,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('CLAUDE_KEY_INVALID');
      if (response.status === 429) throw new Error('CLAUDE_RATE_LIMIT');
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText: string = data?.content?.[0]?.text || '';

    // Extract JSON from response (strip any accidental markdown fences)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('CLAUDE_INVALID_JSON');

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.summary || !Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
      throw new Error('CLAUDE_INCOMPLETE_RESPONSE');
    }

    // Ensure allocations sum to 100 (normalize if needed)
    const totalAlloc = parsed.recommendations.reduce((s: number, r: PortfolioRecommendation) => s + (r.allocation || 0), 0);
    if (Math.abs(totalAlloc - 100) > 5) {
      const factor = 100 / totalAlloc;
      parsed.recommendations = parsed.recommendations.map((r: PortfolioRecommendation, i: number, arr: PortfolioRecommendation[]) => ({
        ...r,
        allocation: i === arr.length - 1
          ? 100 - arr.slice(0, -1).reduce((s: number, x: PortfolioRecommendation) => s + Math.round(x.allocation * factor), 0)
          : Math.round(r.allocation * factor),
      }));
    }

    return {
      summary: parsed.summary,
      recommendations: parsed.recommendations,
      riskNote: parsed.riskNote || '',
      timestamp,
      whyNow: parsed.whyNow,
      risks: parsed.risks,
      opportunities: parsed.opportunities,
      isAiGenerated: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    // Re-throw known errors so caller can show toasts
    if (msg === 'CLAUDE_KEY_INVALID' || msg === 'CLAUDE_RATE_LIMIT') throw err;
    // For all other errors (parse, network, incomplete), fall back silently
    console.warn('Claude analysis failed, falling back to rule-based:', msg);
    return generateAnalysis(assets, targetReturn, riskLevel);
  }
}

// ─── Rule-based analysis engine (fallback) ─────────────────
/**
 * Strictly uses only provided data — no hallucination.
 * Used when Claude API key is not set or API call fails.
 * Produces a balanced 6-category portfolio covering BIST, US, TEFAS, crypto,
 * commodity and bond/forex assets with risk-level-appropriate weights.
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
  const losers  = sorted.filter(a => a.weeklyChangePct < 0);

  // ── Category pools (sorted by weekly change, best first) ──
  const byChange = (a: Asset, b: Asset) => b.weeklyChangePct - a.weeklyChangePct;

  const bistPool      = [...assets].filter(a => a.category === 'bist'     && a.type === 'stock').sort(byChange);
  const usPool        = [...assets].filter(a => a.category === 'us_stock' && a.type === 'stock').sort(byChange);
  const etfPool       = [...assets].filter(a => a.type === 'etf').sort(byChange);
  const tefasPool     = [...assets].filter(a => a.category === 'tefas').sort(byChange);
  const cryptoPool    = [...assets].filter(a => a.category === 'crypto').sort(byChange);
  const commodityPool = [...assets].filter(a => a.category === 'commodity').sort(byChange);
  const bondPool      = [...assets].filter(a => a.category === 'bond' || a.category === 'forex').sort(byChange);

  /** Pick up to maxCount unique assets from a pool, tracking globally used symbols */
  const pick = (pool: Asset[], maxCount: number, seen: Set<string>): Asset[] => {
    const result: Asset[] = [];
    for (const a of pool) {
      if (result.length >= maxCount) break;
      if (!seen.has(a.symbol)) {
        seen.add(a.symbol);
        result.push(a);
      }
    }
    return result;
  };

  const usedSymbols = new Set<string>();

  // ── Risk-level allocation blueprints ──
  // Each slot: [pool, count, targetPct]
  type Slot = { pool: Asset[]; count: number; pct: number; label: string };
  let slots: Slot[];

  if (riskLevel === 'low') {
    // Conservative: heavy TEFAS + bonds/commodities, light equity
    slots = [
      { pool: tefasPool,     count: 2, pct: 30, label: 'tefas'     },
      { pool: bondPool,      count: 1, pct: 20, label: 'bond'      },
      { pool: commodityPool, count: 1, pct: 20, label: 'commodity' },
      { pool: bistPool,      count: 1, pct: 15, label: 'bist'      },
      { pool: etfPool,       count: 1, pct: 10, label: 'etf'       },
      { pool: cryptoPool,    count: 1, pct:  5, label: 'crypto'    },
    ];
  } else if (riskLevel === 'medium') {
    // Balanced: broad diversification across all 6 categories
    slots = [
      { pool: bistPool,      count: 2, pct: 25, label: 'bist'      },
      { pool: usPool,        count: 1, pct: 20, label: 'us'        },
      { pool: tefasPool,     count: 1, pct: 20, label: 'tefas'     },
      { pool: cryptoPool,    count: 1, pct: 15, label: 'crypto'    },
      { pool: commodityPool, count: 1, pct: 10, label: 'commodity' },
      { pool: bondPool,      count: 1, pct: 10, label: 'bond'      },
    ];
  } else {
    // Aggressive: max equity/crypto, minimal safe havens
    slots = [
      { pool: bistPool,      count: 2, pct: 30, label: 'bist'      },
      { pool: usPool,        count: 2, pct: 25, label: 'us'        },
      { pool: cryptoPool,    count: 2, pct: 25, label: 'crypto'    },
      { pool: commodityPool, count: 1, pct: 10, label: 'commodity' },
      { pool: tefasPool,     count: 1, pct:  5, label: 'tefas'     },
      { pool: bondPool,      count: 1, pct:  5, label: 'bond'      },
    ];
  }

  // Rationale text by category
  const rationaleFor = (a: Asset, label: string): string => {
    switch (label) {
      case 'tefas':     return `İstikrarlı Türk yatırım fonu. Haftalık: %${a.weeklyChangePct.toFixed(2)}.`;
      case 'bond':      return `Güvenli liman / sabit gelir enstrümanı. Haftalık: %${a.weeklyChangePct.toFixed(2)}.`;
      case 'commodity': return `Emtia pozisyonu — enflasyon koruması. Haftalık: %${a.weeklyChangePct.toFixed(2)}.`;
      case 'bist':      return `BIST hissesi, güçlü haftalık momentum: %${a.weeklyChangePct.toFixed(2)}.`;
      case 'etf':       return `Geniş endeks ETF'i, çeşitlendirilmiş maruz kalım. Haftalık: %${a.weeklyChangePct.toFixed(2)}.`;
      case 'crypto':    return `Kripto varlık, yüksek potansiyel. Haftalık: %${a.weeklyChangePct.toFixed(2)}.`;
      default:          return `US hissesi, güçlü haftalık getiri: %${a.weeklyChangePct.toFixed(2)}.`;
    }
  };

  // ── Build picks from slots ──
  interface WeightedPick { asset: Asset; pct: number; label: string }
  const weightedPicks: WeightedPick[] = [];

  for (const slot of slots) {
    const chosen = pick(slot.pool, slot.count, usedSymbols);
    if (chosen.length === 0) continue;
    // Distribute slot pct equally among chosen assets in this slot
    const perAsset = slot.pct / chosen.length;
    chosen.forEach(a => weightedPicks.push({ asset: a, pct: perAsset, label: slot.label }));
  }

  // ── Fallback: if picks < 3, fill from any gainers ──
  if (weightedPicks.length < 3) {
    const extras = pick(gainers, 6 - weightedPicks.length, usedSymbols);
    extras.forEach(a => weightedPicks.push({ asset: a, pct: 0, label: 'us' }));
  }

  // ── Normalise allocations to exactly 100% (integer rounding) ──
  const totalRaw = weightedPicks.reduce((s, p) => s + p.pct, 0);
  const normalised = weightedPicks.map((p, i, arr) => {
    const rounded = i < arr.length - 1
      ? Math.round((p.pct / totalRaw) * 100)
      : 0; // last item fills remainder
    return { ...p, allocation: rounded };
  });
  // Fill last item with remainder
  const allocated = normalised.reduce((s, p, i) => i < normalised.length - 1 ? s + p.allocation : s, 0);
  if (normalised.length > 0) {
    normalised[normalised.length - 1].allocation = Math.max(1, 100 - allocated);
  }

  const recommendations: PortfolioRecommendation[] = normalised.map(p => ({
    symbol: p.asset.symbol,
    name: p.asset.name,
    allocation: p.allocation,
    rationale: rationaleFor(p.asset, p.label),
  }));

  const avgReturn = recommendations.reduce((sum, r) => {
    const asset = assets.find(a => a.symbol === r.symbol);
    return sum + (asset ? asset.weeklyChangePct * r.allocation / 100 : 0);
  }, 0);

  const riskLabels: Record<RiskLevel, string> = {
    low: 'Düşük',
    medium: 'Orta',
    high: 'Yüksek',
  };

  const summary = `Bu hafta piyasa genelinde ${gainers.length > losers.length ? 'pozitif' : 'karışık'} bir seyir gözlemlenmektedir. ${gainers.length} enstrüman yükselirken, ${losers.length} enstrüman düşüş göstermiştir. **${sorted[0].symbol}** (+%${sorted[0].weeklyChangePct.toFixed(2)}) en güçlü, **${sorted[sorted.length - 1].symbol}** (%${sorted[sorted.length - 1].weeklyChangePct.toFixed(2)}) ise en zayıf performansı sergiledi. Önerilen **${riskLabels[riskLevel]}** risk profilli portföyün ağırlıklı haftalık getiri beklentisi **%${avgReturn.toFixed(2)}** (USD bazlı aylık hedef: %${targetReturn}).${avgReturn < targetReturn / 4.33 ? ' Mevcut piyasa koşulları hedefin altında kalabilir — risk toleransınızı gözden geçirin.' : ''}`;

  const riskNote = riskLevel === 'high'
    ? '⚠️ Yüksek riskli portföy. Yüksek volatilite beklenmektedir. Sadece kaybetmeyi göze alabileceğiniz tutarları yatırın.'
    : riskLevel === 'medium'
    ? 'ℹ️ Dengeli portföy. Orta düzey volatilite ile istikrarlı büyüme hedeflenmektedir.'
    : '✅ Düşük riskli, korumacı portföy. Sermaye koruması ön plandadır.';

  return { summary, recommendations, riskNote, timestamp, isAiGenerated: false };
}
