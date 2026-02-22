import ReactMarkdown from 'react-markdown';
import { AnalysisResult } from '@/services/analysisEngine';
import { PerformanceResult } from '@/services/snapshotService';
import { PortfolioDiff, RecommendationAction } from '@/services/autoScheduler';
import {
  Bot, Clock, PieChart, Sparkles, AlertTriangle, Target, Zap,
  TrendingUp, TrendingDown, History, ArrowUpCircle, ArrowDownCircle,
  MinusCircle, PlusCircle, ArrowRightLeft,
} from 'lucide-react';

interface StrategyPanelProps {
  analysis: AnalysisResult | null;
  performance: PerformanceResult | null;
  portfolioDiff?: PortfolioDiff | null;
}

// ─── Action Badge ───────────────────────────────────────────
const ACTION_CONFIG: Record<RecommendationAction, {
  label: string;
  className: string;
  Icon: React.FC<{ className?: string }>;
}> = {
  NEW: {
    label: 'YENİ AL',
    className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    Icon: ({ className }) => <PlusCircle className={className} />,
  },
  BUY: {
    label: 'AL',
    className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    Icon: ({ className }) => <ArrowUpCircle className={className} />,
  },
  SELL: {
    label: 'SAT',
    className: 'bg-red-500/15 border-red-500/30 text-red-400',
    Icon: ({ className }) => <ArrowDownCircle className={className} />,
  },
  HOLD: {
    label: 'TUT',
    className: 'bg-secondary/80 border-border text-muted-foreground',
    Icon: ({ className }) => <MinusCircle className={className} />,
  },
};

function ActionBadge({ action, delta }: { action: RecommendationAction; delta?: number }) {
  const cfg = ACTION_CONFIG[action];
  const showDelta = action === 'HOLD' && delta !== undefined && Math.abs(delta) >= 1;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold tracking-wide ${cfg.className}`}>
      <cfg.Icon className="w-2.5 h-2.5" />
      {cfg.label}
      {showDelta && (
        <span className={delta > 0 ? 'text-emerald-400' : 'text-red-400'}>
          {delta > 0 ? '+' : ''}{delta.toFixed(0)}pp
        </span>
      )}
    </span>
  );
}

// ─── Portfolio Diff Summary ─────────────────────────────────
function PortfolioDiffSummary({ diff }: { diff: PortfolioDiff | null | undefined }) {
  // Veri yoksa veya henüz hesaplanmadıysa hiçbir şey render etme
  if (!diff) return null;

  if (!diff.hasChanges) {
    return (
      <div className="p-3 rounded-lg bg-secondary/30 border border-border flex items-center gap-2">
        <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Geçen haftaya göre portföyde <span className="font-semibold text-foreground/70">büyük değişiklik yok</span> — önerilen dağılım korunabilir.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide">
        <ArrowRightLeft className="w-3.5 h-3.5" />
        Bu Haftaki Değişiklikler
      </div>

      <div className="flex flex-wrap gap-1.5">
        {/* Yeni alınacaklar */}
        {(diff.newSymbols?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {(diff.diffs ?? [])
              .filter(d => d.action === 'NEW')
              .map(d => (
                <span key={d.symbol} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                  <PlusCircle className="w-2.5 h-2.5" />
                  {d.symbol}
                  <span className="text-emerald-400/70">%{d.allocation}</span>
                </span>
              ))}
          </div>
        )}

        {/* Satılacaklar */}
        {(diff.removedSymbols?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {(diff.diffs ?? [])
              .filter(d => d.action === 'SELL')
              .map(d => (
                <span key={d.symbol} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-red-500/10 border border-red-500/25 text-red-400">
                  <ArrowDownCircle className="w-2.5 h-2.5" />
                  {d.symbol}
                  <span className="text-red-400/70">%{d.prevAllocation} → sat</span>
                </span>
              ))}
          </div>
        )}

        {/* Ağırlığı önemli ölçüde değişenler */}
        {(diff.changedSymbols?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {(diff.diffs ?? [])
              .filter(d => d.action === 'HOLD' && (diff.changedSymbols ?? []).includes(d.symbol))
              .map(d => (
                <span key={d.symbol} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-semibold border ${
                  (d.allocationDelta ?? 0) > 0
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                }`}>
                  {(d.allocationDelta ?? 0) > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {d.symbol}
                  <span className="opacity-70">%{d.prevAllocation}→%{d.allocation}</span>
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Özet satır */}
      <p className="text-[11px] text-muted-foreground">
        {(diff.newSymbols?.length ?? 0) > 0 && `${diff.newSymbols.length} yeni varlık ekle`}
        {(diff.newSymbols?.length ?? 0) > 0 && ((diff.removedSymbols?.length ?? 0) > 0 || (diff.changedSymbols?.length ?? 0) > 0) && ' · '}
        {(diff.removedSymbols?.length ?? 0) > 0 && `${diff.removedSymbols.length} varlığı sat`}
        {(diff.removedSymbols?.length ?? 0) > 0 && (diff.changedSymbols?.length ?? 0) > 0 && ' · '}
        {(diff.changedSymbols?.length ?? 0) > 0 && `${diff.changedSymbols.length} varlığın ağırlığını güncelle`}
      </p>
    </div>
  );
}

// ─── Past Performance Card ─────────────────────────────────
function PerformanceSummary({ perf }: { perf: PerformanceResult }) {
  const isPositive = perf.totalPnL >= 0;
  const dayLabel = perf.daysSince === 0 ? 'bugün' : `${perf.daysSince} gün önce`;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const totalColor = isPositive ? 'text-emerald-400' : 'text-red-400';
  const totalBg = isPositive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20';

  if (!perf.hasCurrentPrices) {
    return (
      <div className="p-3 rounded-lg bg-secondary/30 border border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <History className="w-3.5 h-3.5" />
          <span className="font-semibold uppercase tracking-wide">Geçmiş Performans</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {perf.snapshot.formattedDate} önerisinin performansı hesaplanamadı — mevcut fiyatlar eşleşmedi.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border ${totalBg} space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <History className="w-3.5 h-3.5" />
          Geçmiş Performans Başarısı
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{dayLabel}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/70">{perf.snapshot.formattedDate}</span> tarihli öneriden bu yana:
      </p>

      {/* Per-asset chips */}
      <div className="flex flex-wrap gap-1.5">
        {perf.metrics.map(m => {
          const pos = m.changePct >= 0;
          return (
            <span
              key={m.symbol}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-semibold border ${
                pos
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/25 text-red-400'
              }`}
            >
              {m.symbol}
              <span>{pos ? '+' : ''}{m.changePct.toFixed(2)}%</span>
            </span>
          );
        })}
      </div>

      {/* Total P&L */}
      <div className={`flex items-center justify-between pt-2 border-t border-border/50`}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendIcon className={`w-3.5 h-3.5 ${totalColor}`} />
          <span>Portföy Toplam (Ağırlıklı)</span>
        </div>
        <span className={`font-mono font-bold text-sm ${totalColor}`}>
          {isPositive ? '+' : ''}{perf.totalPnL.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────
export default function StrategyPanel({ analysis, performance, portfolioDiff }: StrategyPanelProps) {
  // Build a quick lookup from diff list: symbol → diff entry
  // portfolioDiff veya diffs dizisi null/undefined olabilir — güvenli erişim kullan
  const diffMap = new Map((portfolioDiff?.diffs ?? []).map(d => [d.symbol, d]));

  if (!analysis) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
        <Bot className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">
          Parametreleri ayarlayıp <span className="text-primary font-semibold">analiz başlatın</span>.
        </p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          AI Agent piyasa verilerini analiz edecek.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-primary font-mono text-sm font-semibold tracking-wider uppercase">
            <Bot className="w-4 h-4" />
            {analysis.isAiGenerated ? "Claude'un Önerisi" : 'AI Strateji Raporu'}
          </div>
          {analysis.isAiGenerated && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold tracking-wide">
              <Sparkles className="w-2.5 h-2.5" />
              Claude AI
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {analysis.timestamp}
        </div>
      </div>

      {/* Past Performance — shown above new analysis */}
      {performance && <PerformanceSummary perf={performance} />}

      {/* Portfolio Diff — changes vs last week */}
      {portfolioDiff && <PortfolioDiffSummary diff={portfolioDiff} />}

      {/* Summary */}
      <div className="text-sm text-foreground/90 leading-relaxed">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            h2: ({ children }) => <h2 className="text-base font-bold text-foreground mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-bold text-foreground mb-1">{children}</h3>,
          }}
        >
          {analysis.summary}
        </ReactMarkdown>
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <PieChart className="w-3.5 h-3.5" />
          Önerilen Dağılım
        </div>
        <div className="space-y-2">
          {analysis.recommendations.map((rec, idx) => {
            const d = diffMap.get(rec.symbol);
            return (
              <div key={`${rec.symbol}-${idx}`} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="font-mono font-bold text-primary text-sm min-w-[3rem]">
                  %{rec.allocation}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-foreground text-sm">{rec.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate">{rec.name}</span>
                    {/* Action badge — only shown when diff data exists */}
                    {d && (
                      <ActionBadge action={d.action} delta={d.allocationDelta} />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.rationale}</p>
                </div>
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${rec.allocation}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* SELL items — assets removed from portfolio */}
          {portfolioDiff != null && (portfolioDiff.removedSymbols?.length ?? 0) > 0 && (
            <div className="mt-1 space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold pl-1">Portföyden Çıkar</p>
              {(portfolioDiff.diffs ?? [])
                .filter(d => d.action === 'SELL')
                .map(d => (
                  <div key={d.symbol} className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20 opacity-80">
                    <div className="font-mono font-bold text-red-400 text-sm min-w-[3rem] line-through">
                      %{d.prevAllocation}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-foreground/60 text-sm line-through">{d.symbol}</span>
                        <span className="text-xs text-muted-foreground/70 truncate">{d.name}</span>
                        <ActionBadge action="SELL" />
                      </div>
                      <p className="text-[11px] text-red-400/70 mt-0.5">Bu hafta portföyden çıkarılıyor</p>
                    </div>
                    <div className="w-16 h-1.5 bg-red-500/20 rounded-full" />
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Market Analysis — only when Claude generated */}
      {analysis.isAiGenerated && (analysis.whyNow || analysis.risks || analysis.opportunities) && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Piyasa Analizi
          </div>

          {analysis.whyNow && (
            <div className="flex gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <div className="flex-shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-400 mb-1 uppercase tracking-wide">Neden Şimdi?</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{analysis.whyNow}</p>
              </div>
            </div>
          )}

          {analysis.risks && (
            <div className="flex gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <div className="flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-400 mb-1 uppercase tracking-wide">Riskler Neler?</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{analysis.risks}</p>
              </div>
            </div>
          )}

          {analysis.opportunities && (
            <div className="flex gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex-shrink-0 mt-0.5">
                <Target className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-400 mb-1 uppercase tracking-wide">Fırsatlar Nerede?</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{analysis.opportunities}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Risk note */}
      <div className="text-xs p-3 rounded-lg bg-secondary/30 border border-border text-muted-foreground">
        {analysis.riskNote}
      </div>
    </div>
  );
}
