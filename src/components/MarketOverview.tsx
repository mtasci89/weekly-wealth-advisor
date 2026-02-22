import { useState } from 'react';
import { Asset, AssetCategory, CATEGORY_LABELS, getAllCategories, getAssetsByCategory } from '@/services/marketData';
import AssetCard, { TimePeriod, PERIOD_LABELS, getChangePct } from './AssetCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart3 } from 'lucide-react';

// AssetCategory kullanılsın (lint uyarısı önle)
type _Cat = AssetCategory;

interface MarketOverviewProps {
  assets: Asset[];
  isLoading: boolean;
}

const PERIODS: TimePeriod[] = ['1d', '1w', '1m', '3m'];

// Kısa etiket: "Haftalık" → "1H" vb.
const SHORT_LABEL: Record<TimePeriod, string> = {
  '1d': '1G',
  '1w': '1H',
  '1m': '1A',
  '3m': '3A',
};

export default function MarketOverview({ assets, isLoading }: MarketOverviewProps) {
  const [period, setPeriod] = useState<TimePeriod>('1w');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm font-semibold tracking-wider uppercase">
          <BarChart3 className="w-4 h-4" />
          Piyasa Verileri Yükleniyor...
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="glass-card p-4 h-[160px] animate-pulse">
              <div className="h-3 w-12 bg-muted rounded mb-2" />
              <div className="h-2 w-20 bg-muted rounded mb-4" />
              <div className="h-12 w-full bg-muted/50 rounded mb-3" />
              <div className="h-4 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const categories = getAllCategories();

  return (
    <div className="space-y-4">
      {/* Başlık + zaman seçici */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm font-semibold tracking-wider uppercase">
          <BarChart3 className="w-4 h-4" />
          Varlık Sınıfları
        </div>

        {/* Periyot seçici — kart değişim oranı + sıralaması birlikte revize edilir */}
        <div className="flex items-center gap-1 bg-secondary/50 border border-border rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              title={PERIOD_LABELS[p]}
              className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
                period === p
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {SHORT_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue={categories[0]} className="w-full">
        <TabsList className="bg-secondary/50 border border-border flex-wrap h-auto gap-1 p-1.5">
          {categories.map(cat => (
            <TabsTrigger
              key={cat}
              value={cat}
              className="font-mono text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-3 py-1.5"
            >
              {CATEGORY_LABELS[cat]}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map(cat => {
          const catAssets = getAssetsByCategory(assets, cat);
          // Seçili periyoda göre en çok artandan en çok düşene sırala
          const sorted = [...catAssets].sort(
            (a, b) => getChangePct(b, period) - getChangePct(a, period)
          );
          return (
            <TabsContent key={cat} value={cat}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                {sorted.map((asset, idx) => (
                  <AssetCard key={`${asset.symbol}-${idx}`} asset={asset} period={period} />
                ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
