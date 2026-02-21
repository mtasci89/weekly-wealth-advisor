import { useState, useMemo } from 'react';
import { Asset } from '@/services/marketData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown, TableProperties } from 'lucide-react';

type SortKey = 'oneMonth' | 'threeMonth' | 'sixMonth' | 'ytd' | 'oneYear';
type SortDir = 'asc' | 'desc';

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return assets;
    return [...assets].sort((a, b) => {
      const av = a.historicalReturns[sortKey];
      const bv = b.historicalReturns[sortKey];
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [assets, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'desc'
      ? <ArrowDown className="w-3 h-3 ml-1 text-primary" />
      : <ArrowUp className="w-3 h-3 ml-1 text-primary" />;
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: 'oneMonth', label: '1 Ay' },
    { key: 'threeMonth', label: '3 Ay' },
    { key: 'sixMonth', label: '6 Ay' },
    { key: 'ytd', label: 'YTD' },
    { key: 'oneYear', label: '1 Yıl' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm font-semibold tracking-wider uppercase">
        <TableProperties className="w-4 h-4" />
        Karşılaştırmalı Performans Tablosu
      </div>
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-mono text-xs w-[180px]">Varlık Adı</TableHead>
              <TableHead className="text-muted-foreground font-mono text-xs w-[100px]">Sembol</TableHead>
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
            {sorted.map(asset => (
              <TableRow key={asset.symbol} className="border-border">
                <TableCell className="text-foreground text-sm">{asset.name}</TableCell>
                <TableCell className="font-mono text-foreground font-semibold text-sm">{asset.symbol}</TableCell>
                <TableCell><ReturnCell value={asset.historicalReturns.oneMonth} /></TableCell>
                <TableCell><ReturnCell value={asset.historicalReturns.threeMonth} /></TableCell>
                <TableCell><ReturnCell value={asset.historicalReturns.sixMonth} /></TableCell>
                <TableCell><ReturnCell value={asset.historicalReturns.ytd} /></TableCell>
                <TableCell><ReturnCell value={asset.historicalReturns.oneYear} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
