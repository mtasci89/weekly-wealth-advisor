import { Asset } from '@/services/marketData';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

export type TimePeriod = '1d' | '1w' | '1m' | '3m';

export const PERIOD_LABELS: Record<TimePeriod, string> = {
  '1d': 'Günlük',
  '1w': 'Haftalık',
  '1m': 'Aylık',
  '3m': '3 Aylık',
};

/** Seçili periyoda göre ilgili değişim yüzdesini döndürür */
export function getChangePct(asset: Asset, period: TimePeriod): number {
  switch (period) {
    case '1d':
      // Günlük veri yoksa haftalık/5'e bölerek tahmin et
      return asset.historicalReturns.oneMonth / 22; // ~22 işlem günü
    case '1w':
      return asset.weeklyChangePct;
    case '1m':
      return asset.historicalReturns.oneMonth;
    case '3m':
      return asset.historicalReturns.threeMonth;
  }
}

interface AssetCardProps {
  asset: Asset;
  period: TimePeriod;
}

export default function AssetCard({ asset, period }: AssetCardProps) {
  const changePct = getChangePct(asset, period);
  const isUp = changePct >= 0;
  const chartData = asset.sparkline.map((value, i) => ({ i, value }));
  const color = isUp ? 'hsl(142, 60%, 50%)' : 'hsl(0, 62%, 55%)';

  // Fiyat gösterimi: BIST hisseleri TL, diğerleri USD
  const isBist = asset.category === 'bist';
  const priceDisplay = isBist
    ? `₺${asset.price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
    : `$${asset.price.toFixed(2)}`;

  return (
    <div className="glass-card p-4 flex flex-col gap-3 hover:border-muted-foreground/30 transition-colors duration-200">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono font-bold text-foreground text-sm">{asset.symbol}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[120px]">{asset.name}</div>
        </div>
        <div className={`text-xs font-mono px-2 py-0.5 rounded ${isUp ? 'bg-chart-up/15 ticker-up' : 'bg-chart-down/15 ticker-down'}`}>
          {isUp ? '+' : ''}{changePct.toFixed(2)}%
        </div>
      </div>

      <div className="sparkline-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`grad-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#grad-${asset.symbol})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-end justify-between">
        <span className="font-mono text-lg font-bold text-foreground">{priceDisplay}</span>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] text-muted-foreground">Vol: {asset.volume}</span>
          {/* Periyot etiketi — hangi sürenin değişimi gösterildiğini netleştirir */}
          <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wide">
            {PERIOD_LABELS[period]} değ.
          </span>
        </div>
      </div>
    </div>
  );
}
