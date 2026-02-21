import { useState, useEffect } from 'react';
import { fetchMarketData, Asset } from '@/services/marketData';
import { generateAnalysis, AnalysisResult, RiskLevel } from '@/services/analysisEngine';
import InputPanel from '@/components/InputPanel';
import StrategyPanel from '@/components/StrategyPanel';
import MarketOverview from '@/components/MarketOverview';
import { Activity, Radio } from 'lucide-react';

export default function Index() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetchMarketData().then(data => {
      setAssets(data);
      setIsLoadingData(false);
    });
  }, []);

  const handleAnalyze = async (targetReturn: number, riskLevel: RiskLevel) => {
    setIsAnalyzing(true);
    // Refresh market data
    const freshData = await fetchMarketData();
    setAssets(freshData);
    // Simulate AI processing delay
    await new Promise(r => setTimeout(r, 1200));
    const result = generateAnalysis(freshData, targetReturn, riskLevel);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary" />
            <div>
              <h1 className="font-mono font-bold text-foreground text-lg tracking-tight">
                PortföyAI
              </h1>
              <p className="text-xs text-muted-foreground">Haftalık Finansal Analiz Ajanı</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Radio className="w-3 h-3 text-primary animate-pulse" />
            <span className="font-mono">CANLI VERİ</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto p-6 space-y-6">
        {/* Top: Input + Strategy side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <InputPanel onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
          <StrategyPanel analysis={analysis} />
        </div>

        {/* Bottom: Market Overview */}
        <MarketOverview assets={assets} isLoading={isLoadingData} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3 mt-8">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">Mock veri servisi aktif — API entegrasyonu için services/ klasörüne bakınız.</span>
          <span>v1.0</span>
        </div>
      </footer>
    </div>
  );
}
