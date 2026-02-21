import { Asset } from '@/services/marketData';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface AssetCardProps {
  asset: Asset;
}

export default function AssetCard({ asset }: AssetCardProps) {
  const isUp = asset.weeklyChange >= 0;
  const chartData = asset.sparkline.map((value, i) => ({ i, value }));
  const color = isUp ? 'hsl(142, 60%, 50%)' : 'hsl(0, 62%, 55%)';

  return (
    <div className="glass-card p-4 flex flex-col gap-3 hover:border-muted-foreground/30 transition-colors duration-200">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono font-bold text-foreground text-sm">{asset.symbol}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[120px]">{asset.name}</div>
        </div>
        <div className={`text-xs font-mono px-2 py-0.5 rounded ${isUp ? 'bg-chart-up/15 ticker-up' : 'bg-chart-down/15 ticker-down'}`}>
          {isUp ? '+' : ''}{asset.weeklyChangePct.toFixed(2)}%
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
        <span className="font-mono text-lg font-bold text-foreground">${asset.price.toFixed(2)}</span>
        <span className="text-[10px] text-muted-foreground">Vol: {asset.volume}</span>
      </div>
    </div>
  );
}
