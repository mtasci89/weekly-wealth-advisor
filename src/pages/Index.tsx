import { useState, useEffect, useCallback, useRef } from 'react';
import { Asset } from '@/services/marketData';
import {
  fetchAllRealData,
  fetchTechnicalSignals,
  invalidateCache,
  wasRateLimited,
  clearRateLimitFlag,
} from '@/services/realDataService';
import { hasYahooKey, hasClaudeKey, hasTavilyKey } from '@/services/apiKeyStore';
import { generateAnalysis, generateClaudeAnalysis, AnalysisResult, RiskLevel } from '@/services/analysisEngine';
import { fetchMacroContext } from '@/services/webSearchService';
import {
  buildSnapshotFromAnalysis,
  calculatePerformance,
  loadLastSnapshot,
  saveSnapshot,
  PerformanceResult,
} from '@/services/snapshotService';
import {
  startAutoScheduler,
  computePortfolioDiff,
  updatePrevRecommendations,
  markAutoAnalyzedToday,
  getLastAutoAnalysisLabel,
  PortfolioDiff,
} from '@/services/autoScheduler';
import InputPanel from '@/components/InputPanel';
import StrategyPanel from '@/components/StrategyPanel';
import MarketOverview from '@/components/MarketOverview';
import PerformanceTable from '@/components/PerformanceTable';
import SettingsModal from '@/components/SettingsModal';
import TwitterFeed from '@/components/TwitterFeed';
import AiChatWidget from '@/components/AiChatWidget';
import { Activity, Wifi, KeyRound, RefreshCw, Sun, Moon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Index() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [performance, setPerformance] = useState<PerformanceResult | null>(null);
  const [portfolioDiff, setPortfolioDiff] = useState<PortfolioDiff | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasKey, setHasKey] = useState(hasYahooKey());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoAnalyzed, setAutoAnalyzed] = useState(false);
  const [lastAutoAnalysis, setLastAutoAnalysis] = useState<string | null>(getLastAutoAnalysisLabel());
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('portfolyoai_theme');
    if (saved) return saved === 'dark';
    return true; // varsayılan: koyu
  });
  const { toast } = useToast();

  // Saved analysis params for auto-scheduler re-use
  const savedParamsRef = useRef<{ targetReturn: number; riskLevel: RiskLevel }>({
    targetReturn: 3,
    riskLevel: 'medium',
  });

  // Tema değişikliğini DOM'a uygula
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove('light');
    } else {
      root.classList.add('light');
    }
    localStorage.setItem('portfolyoai_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Stale assets ref — analysis'te her zaman güncel veriyi kullanmak için
  const [freshAssets, setFreshAssets] = useState<Asset[]>([]);

  const loadData = useCallback(async (forceRefresh = false): Promise<Asset[]> => {
    if (!hasYahooKey()) {
      setHasKey(false);
      setIsLoadingData(false);
      setAssets([]);
      return [];
    }

    setHasKey(true);
    setIsLoadingData(true);

    if (forceRefresh) invalidateCache();
    clearRateLimitFlag();

    try {
      const realData = await fetchAllRealData();

      // 429 ile bazı kategoriler stale veriden geldi
      if (wasRateLimited()) {
        toast({
          variant: 'destructive',
          title: 'Limit Uyarısı',
          description: 'API istek limiti aşıldı. Önbellekteki eski veriler gösteriliyor. Lütfen 1 dakika bekleyin.',
        });
      }

      if (realData.length > 0) {
        setAssets(realData);
        setFreshAssets(realData);
        setIsLoadingData(false);
        return realData;
      }
      throw new Error('EMPTY_RESPONSE');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';

      if (msg === 'API_KEY_INVALID') {
        toast({
          variant: 'destructive',
          title: 'Geçersiz API Anahtarı',
          description: "Yahoo Finance API anahtarınız geçersiz. Ayarlar'dan kontrol edin.",
        });
      } else if (msg === 'API_RATE_LIMIT') {
        // Stale cache yoktu — tüm kategoriler boş
        toast({
          variant: 'destructive',
          title: 'Limit Uyarısı',
          description: 'API istek limiti aşıldı ve önbellekte veri yok. Lütfen 1 dakika bekleyip tekrar deneyin.',
        });
      } else if (msg === 'API_KEY_MISSING') {
        setHasKey(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Veri Çekme Hatası',
          description: msg.startsWith('TEFAS_UNAVAILABLE')
            ? 'TEFAS verileri alınamadı (proxy gerekli). Diğer veriler yükleniyor.'
            : 'Bazı piyasa verileri alınamadı. Lütfen tekrar deneyin.',
        });
      }

      setIsLoadingData(false);
      return assets; // mevcut state'i koru
    }
  }, [toast, assets]);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnalyze = useCallback(async (targetReturn: number, riskLevel: RiskLevel, isAutoTriggered = false) => {
    // Persist params so the auto-scheduler can reuse the last settings
    savedParamsRef.current = { targetReturn, riskLevel };

    setIsAnalyzing(true);

    try {
      // 1. Önbellekten veya API'den güncel fiyatlar
      const current = await loadData();

      // 2. Son snapshot ile P&L hesapla
      const lastSnapshot = loadLastSnapshot();
      const perf = lastSnapshot ? calculatePerformance(lastSnapshot, current) : null;

      // Yardımcı: Promise'e zaman aşımı — takılı kalırsa fallback döner
      const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
        Promise.race([p, new Promise<T>(res => setTimeout(() => res(fallback), ms))]);

      // 3. Teknik sinyaller — max 25s; aşılırsa boş dizi ile devam et
      const techSignals = hasYahooKey()
        ? await withTimeout(fetchTechnicalSignals(current), 25_000, [])
        : [];

      // 4. Makroekonomik bağlam — max 15s; aşılırsa undefined ile devam et
      const macroCtx = hasTavilyKey()
        ? await withTimeout(fetchMacroContext(), 15_000, undefined)
        : undefined;

      // 5. Analiz üret (Claude AI veya kural tabanlı)
      let result: AnalysisResult;
      if (hasClaudeKey()) {
        result = await generateClaudeAnalysis(current, targetReturn, riskLevel, techSignals, macroCtx);
      } else {
        await new Promise(r => setTimeout(r, 800));
        result = generateAnalysis(current, targetReturn, riskLevel);
      }

      // 6. Snapshot kaydet
      const snapshot = buildSnapshotFromAnalysis(result, current, targetReturn, riskLevel, 'live');
      saveSnapshot(snapshot);

      // 7. Portfolio diff hesapla (yeni vs önceki öneri)
      const diff = computePortfolioDiff(snapshot);

      // 8. Önceki öneriyi güncelle (bir sonraki diff için)
      updatePrevRecommendations(snapshot);

      setAnalysis(result);
      setPerformance(perf);
      setPortfolioDiff(diff);

      // 9. Pazar günü otomatik tetiklendiyse bildirim göster
      if (isAutoTriggered) {
        markAutoAnalyzedToday();
        const label = getLastAutoAnalysisLabel();
        setAutoAnalyzed(true);
        setLastAutoAnalysis(label);
        toast({
          title: '🔄 Otomatik Haftalık Güncelleme',
          description: `Portföy analizi ${label ?? 'bugün'} otomatik olarak yenilendi.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'CLAUDE_KEY_INVALID') {
        toast({
          variant: 'destructive',
          title: 'Geçersiz Claude API Anahtarı',
          description: "Ayarlar'dan kontrol edin. Kural tabanlı analiz gösteriliyor.",
        });
      } else if (msg === 'CLAUDE_RATE_LIMIT') {
        toast({
          variant: 'destructive',
          title: 'Claude API Limiti Aşıldı',
          description: 'Kural tabanlı analiz gösteriliyor.',
        });
      }
      const fallback = generateAnalysis(
        freshAssets.length > 0 ? freshAssets : assets,
        targetReturn,
        riskLevel,
      );
      setAnalysis(fallback);
    } finally {
      setIsAnalyzing(false);
    }
  }, [loadData, freshAssets, assets, toast]);

  // ── Pazar günü otomatik analiz zamanlayıcısı ─────────────
  useEffect(() => {
    const cleanup = startAutoScheduler({
      onTrigger: async () => {
        // savedParamsRef henüz kullanıcı tarafından doldurulmamış olabilir;
        // bu durumda ref'in mevcut değerleri zaten default'lara (3, 'medium') ayarlı.
        const { targetReturn, riskLevel } = savedParamsRef.current;
        // Güvenlik: değerlerin geçerli olduğunu teyit et, değilse default kullan
        const safeReturn = (typeof targetReturn === 'number' && targetReturn >= 1 && targetReturn <= 20)
          ? targetReturn
          : 3;
        const safeRisk: RiskLevel = (['low', 'medium', 'high'] as RiskLevel[]).includes(riskLevel)
          ? riskLevel
          : 'medium';
        await handleAnalyze(safeReturn, safeRisk, true);
      },
    });
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              {hasKey && assets.length > 0 ? (
                <>
                  <Wifi className="w-3 h-3 text-primary animate-pulse" />
                  <span className="font-mono text-primary">CANLI VERİ</span>
                  <button
                    onClick={() => loadData(true)}
                    className="ml-1 hover:text-primary transition-colors"
                    title="Verileri yenile"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <>
                  <KeyRound className="w-3 h-3 text-amber-500" />
                  <span className="font-mono text-amber-500">API ANAHTARI GEREKLİ</span>
                </>
              )}
            </div>
            {/* Tema toggle */}
            <button
              onClick={() => setIsDark(prev => !prev)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <SettingsModal
              onSave={() => loadData(true)}
              forceOpen={settingsOpen}
              onForceClose={() => setSettingsOpen(false)}
            />
          </div>
        </div>
      </header>

      {/* Ana İçerik */}
      <main className="max-w-[1440px] mx-auto p-6 space-y-6">
        {/* API key yoksa yönlendirme kartı */}
        {!hasKey && !isLoadingData && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-center space-y-3">
            <KeyRound className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="font-semibold text-foreground">Piyasa Verisi İçin API Anahtarı Gerekli</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Yahoo Finance (RapidAPI) anahtarınızı girin — veriler gerçek zamanlı yüklenecek.
              Claude API anahtarı eklerseniz yapay zeka destekli analiz de aktif olur.
            </p>
            <SettingsModal onSave={() => loadData(true)} triggerLabel="Ayarları Aç" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <InputPanel
            onAnalyze={handleAnalyze}
            isLoading={isAnalyzing}
            autoAnalyzed={autoAnalyzed}
            lastAutoAnalysis={lastAutoAnalysis}
          />
          <StrategyPanel
            analysis={analysis}
            performance={performance}
            portfolioDiff={portfolioDiff}
          />
        </div>

        <MarketOverview assets={assets} isLoading={isLoadingData} />

        {!isLoadingData && assets.length > 0 && <PerformanceTable assets={assets} />}

        {/* Analist tweet paneli — her zaman görünür */}
        <TwitterFeed isDark={isDark} />
      </main>

      {/* AI Chat Widget — floating, sayfanın dışında */}
      <AiChatWidget
        assets={assets}
        analysis={analysis}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3 mt-8">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">
            {hasKey && assets.length > 0
              ? `Yahoo Finance API aktif — ${assets.length} varlık yüklendi.`
              : "Gerçek veriler için Ayarlar'dan API anahtarı girin."}
          </span>
          <span>v4.0</span>
        </div>
      </footer>
    </div>
  );
}
