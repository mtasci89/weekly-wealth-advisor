import { Asset } from '@/services/marketData';
import AssetCard from './AssetCard';
import { BarChart3 } from 'lucide-react';

interface MarketOverviewProps {
  assets: Asset[];
  isLoading: boolean;
}

export default function MarketOverview({ assets, isLoading }: MarketOverviewProps) {
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

  const stocks = assets.filter(a => a.type === 'stock');
  const etfs = assets.filter(a => a.type === 'etf');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm font-semibold tracking-wider uppercase">
        <BarChart3 className="w-4 h-4" />
        Hisse Senetleri
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stocks.map(asset => (
          <AssetCard key={asset.symbol} asset={asset} />
        ))}
      </div>

      <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm font-semibold tracking-wider uppercase mt-6">
        <BarChart3 className="w-4 h-4" />
        ETF'ler
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {etfs.map(asset => (
          <AssetCard key={asset.symbol} asset={asset} />
        ))}
      </div>
    </div>
  );
}
