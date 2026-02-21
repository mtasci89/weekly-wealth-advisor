import { AnalysisResult } from '@/services/analysisEngine';
import { Bot, Clock, PieChart } from 'lucide-react';

interface StrategyPanelProps {
  analysis: AnalysisResult | null;
}

export default function StrategyPanel({ analysis }: StrategyPanelProps) {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-mono text-sm font-semibold tracking-wider uppercase">
          <Bot className="w-4 h-4" />
          AI Strateji Raporu
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {analysis.timestamp}
        </div>
      </div>

      {/* Summary markdown-like display */}
      <div className="text-sm text-secondary-foreground leading-relaxed whitespace-pre-line">
        {analysis.summary.split('\n').map((line, i) => {
          if (line.startsWith('## '))
            return <h3 key={i} className="text-base font-bold text-foreground mb-2">{line.replace('## ', '')}</h3>;
          if (line.startsWith('**'))
            return <p key={i} className="text-sm text-foreground/90" dangerouslySetInnerHTML={{
              __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
            }} />;
          return <p key={i}>{line}</p>;
        })}
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <PieChart className="w-3.5 h-3.5" />
          Önerilen Dağılım
        </div>
        <div className="space-y-2">
          {analysis.recommendations.map(rec => (
            <div key={rec.symbol} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="font-mono font-bold text-primary text-sm min-w-[3rem]">
                %{rec.allocation}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-foreground text-sm">{rec.symbol}</span>
                  <span className="text-xs text-muted-foreground truncate">{rec.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{rec.rationale}</p>
              </div>
              {/* Allocation bar */}
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${rec.allocation}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk note */}
      <div className="text-xs p-3 rounded-lg bg-secondary/30 border border-border text-muted-foreground">
        {analysis.riskNote}
      </div>
    </div>
  );
}
