import { useState, useEffect, useCallback } from 'react';
import { fetchMarketData, Asset } from '@/services/marketData';
import { fetchAllRealData } from '@/services/realDataService';
import { hasYahooKey } from '@/services/apiKeyStore';
import { generateAnalysis, AnalysisResult, RiskLevel } from '@/services/analysisEngine';
import InputPanel from '@/components/InputPanel';
import StrategyPanel from '@/components/StrategyPanel';
import MarketOverview from '@/components/MarketOverview';
import PerformanceTable from '@/components/PerformanceTable';
import SettingsModal from '@/components/SettingsModal';
import { Activity, Radio, CloudOff, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Index() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dataSource, setDataSource] = useState<'mock' | 'live'>('mock');
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoadingData(true);

    if (hasYahooKey()) {
      try {
        const realData = await fetchAllRealData();
        if (realData.length > 0) {
          setAssets(realData);
          setDataSource('live');
          setIsLoadingData(false);
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'API_KEY_INVALID') {
          toast({
            variant: 'destructive',
            title: '🔑 Geçersiz API Anahtarı',
            description: 'Yahoo Finance API anahtarınız geçersiz. Lütfen Ayarlar\'dan kontrol edin. Mock veriler gösteriliyor.',
          });
        } else if (msg === 'API_RATE_LIMIT') {
          toast({
            variant: 'destructive',
            title: '⏱️ API Limit Aşıldı',
            description: 'API istek limitiniz doldu. Geçici olarak mock veriler gösteriliyor.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: '⚠️ Veri Çekme Hatası',
            description: 'API\'den veri alınamadı. Mock veriler ile devam ediliyor.',
          });
        }
      }
    }

    // Fallback to mock
    const mockData = await fetchMarketData();
    setAssets(mockData);
    setDataSource('mock');
    setIsLoadingData(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAnalyze = async (targetReturn: number, riskLevel: RiskLevel) => {
    setIsAnalyzing(true);
    await loadData();
    await new Promise(r => setTimeout(r, 1200));
    const result = generateAnalysis(assets, targetReturn, riskLevel);
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {dataSource === 'live' ? (
                <>
                  <Wifi className="w-3 h-3 text-primary animate-pulse" />
                  <span className="font-mono text-primary">CANLI VERİ</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono">MOCK VERİ</span>
                </>
              )}
            </div>
            <SettingsModal />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <InputPanel onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
          <StrategyPanel analysis={analysis} />
        </div>

        <MarketOverview assets={assets} isLoading={isLoadingData} />

        {!isLoadingData && <PerformanceTable assets={assets} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3 mt-8">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">
            {dataSource === 'live'
              ? 'Yahoo Finance API aktif — Canlı piyasa verileri gösteriliyor.'
              : 'Mock veri servisi aktif — Gerçek veriler için Ayarlar\'dan API anahtarı girin.'}
          </span>
          <span>v2.0</span>
        </div>
      </footer>
    </div>
  );
}
