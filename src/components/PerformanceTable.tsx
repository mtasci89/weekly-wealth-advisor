import { useState, useMemo } from 'react';
import { Asset } from '@/services/marketData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown, TableProperties, ChevronDown, ChevronUp } from 'lucide-react';

type SortKey = 'weekly' | 'oneMonth' | 'threeMonth' | 'sixMonth' | 'ytd' | 'oneYear';
type SortDir = 'asc' | 'desc';

/** Daraltılmış hâlde gösterilecek maksimum satır sayısı */
const DEFAULT_SHOW = 10;

interface PerformanceTableProps {
  assets: Asset[];
}

function ReturnCell({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span className={`font-mono text-sm font-medium ${isPositive ? 'ticker-up' : 'ticker-down'}`}>
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

export default function PerformanceTable({ assets }: PerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    return [...assets].sort((a, b) => {
      // Varsayılan sıralama: haftalık performansa göre
      if (!sortKey) return b.weeklyChangePct - a.weeklyChangePct;
      const av = sortKey === 'weekly' ? a.weeklyChangePct : a.historicalReturns[sortKey];
      const bv = sortKey === 'weekly' ? b.weeklyChangePct : b.historicalReturns[sortKey];
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [assets, sortKey, sortDir]);

  // Görüntülenecek satırlar: daraltılmışsa ilk DEFAULT_SHOW
  const visible = expanded ? sorted : sorted.slice(0, DEFAULT_SHOW);
  const hasMore = sorted.length > DEFAULT_SHOW;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'desc'
      ? <ArrowDown className="w-3 h-3 ml-1 text-primary" />
      : <ArrowUp className="w-3 h-3 ml-1 text-primary" />;
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: 'weekly',     label: '1 Hafta' },
    { key: 'oneMonth',   label: '1 Ay' },
    { key: 'threeMonth', label: '3 Ay' },
    { key: 'sixMonth',   label: '6 Ay' },
    { key: 'ytd',        label: 'YTD' },
    { key: 'oneYear',    label: '1 Yıl' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm font-semibold tracking-wider uppercase">
        <TableProperties className="w-4 h-4" />
        Karşılaştırmalı Performans Tablosu
        <span className="text-[11px] normal-case font-normal text-muted-foreground/60 ml-1">
          ({sorted.length} varlık)
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-mono text-xs w-[180px]">Varlık Adı</TableHead>
              <TableHead className="text-muted-foreground font-mono text-xs w-[90px]">Sembol</TableHead>
              {columns.map(col => (
                <TableHead
                  key={col.key}
                  className="text-muted-foreground font-mono text-xs cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center">
                    {col.label}
                    <SortIcon col={col.key} />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((asset, idx) => (
              <TableRow key={`${asset.symbol}-${idx}`} className="border-border">
                <TableCell className="text-foreground text-sm">{asset.name}</TableCell>
                <TableCell className="font-mono text-foreground font-semibold text-sm">{asset.symbol}</TableCell>
                <TableCell><ReturnCell value={asset.weeklyChangePct} /></TableCell>
                <TableCell><ReturnCell value={asset.historicalReturns.oneMonth} /></TableCell>
                <TableCell><ReturnCell value={asset.historicalReturns.threeMonth} /></TableCell>
                <TableCell><ReturnCell value={asset.historicalReturns.sixMonth} /></TableCell>
                <TableCell><ReturnCell value={asset.historicalReturns.ytd} /></TableCell>
                <TableCell><ReturnCell value={asset.historicalReturns.oneYear} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Genişlet / Daralt satırı */}
        {hasMore && (
          <div className="border-t border-border">
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors font-mono"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  İlk {DEFAULT_SHOW} varlığa dön
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Tüm {sorted.length} varlığı göster &nbsp;({sorted.length - DEFAULT_SHOW} daha)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
