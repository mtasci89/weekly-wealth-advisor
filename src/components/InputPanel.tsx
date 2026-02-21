import { useState } from 'react';
import { RiskLevel } from '@/services/analysisEngine';
import { TrendingUp, ShieldCheck, AlertTriangle, Zap } from 'lucide-react';

interface InputPanelProps {
  onAnalyze: (targetReturn: number, riskLevel: RiskLevel) => void;
  isLoading: boolean;
}

const riskOptions: { value: RiskLevel; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'low', label: 'Düşük', icon: <ShieldCheck className="w-4 h-4" />, desc: 'Sermaye koruması' },
  { value: 'medium', label: 'Orta', icon: <TrendingUp className="w-4 h-4" />, desc: 'Dengeli büyüme' },
  { value: 'high', label: 'Yüksek', icon: <AlertTriangle className="w-4 h-4" />, desc: 'Agresif getiri' },
];

export default function InputPanel({ onAnalyze, isLoading }: InputPanelProps) {
  const [targetReturn, setTargetReturn] = useState(2);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');

  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center gap-2 text-primary font-mono text-sm font-semibold tracking-wider uppercase">
        <Zap className="w-4 h-4" />
        Analiz Parametreleri
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Haftalık Hedef Getiri
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={targetReturn}
            onChange={e => setTargetReturn(parseFloat(e.target.value))}
            className="flex-1 accent-primary h-1.5 bg-secondary rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span className="font-mono text-lg font-bold text-foreground min-w-[3.5rem] text-right">
            %{targetReturn}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Risk Toleransı
        </label>
        <div className="grid grid-cols-3 gap-2">
          {riskOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRiskLevel(opt.value)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all duration-200 cursor-pointer
                ${riskLevel === opt.value
                  ? 'border-primary bg-primary/10 text-primary glow-primary'
                  : 'border-border bg-secondary/50 text-muted-foreground hover:border-muted-foreground/40'
                }`}
            >
              {opt.icon}
              <span className="text-xs font-semibold">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onAnalyze(targetReturn, riskLevel)}
        disabled={isLoading}
        className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm
          hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Analiz Ediliyor...
          </>
        ) : (
          <>
            <TrendingUp className="w-4 h-4" />
            Portföy Analizi Başlat
          </>
        )}
      </button>
    </div>
  );
}
