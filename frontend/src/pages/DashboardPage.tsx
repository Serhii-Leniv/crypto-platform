import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllMarketData } from '../api/market';
import Sparkline, { syntheticSparkline } from '../components/Sparkline';
import { SkeletonRows } from '../components/Skeleton';
import StarButton from '../components/StarButton';
import { IconDashboard, IconTrendingUp, IconTrendingDown, IconHistory } from '../components/icons';
import { useMarketDataSocket } from '../hooks/useMarketDataSocket';
import { formatCompactCurrency, formatNumber, formatPercent, formatPrice } from '../lib/format';
import { getWatchlist } from '../lib/watchlist';
import type { MarketDataResponse } from '../types';

type FilterTab = 'all' | 'watchlist' | 'gainers' | 'losers';
type SortKey = 'symbol' | 'lastPrice' | 'priceChangePercent24h' | 'volume24h' | 'high24h' | 'low24h' | 'tradeCount24h';
type SortDir = 'asc' | 'desc';

function StatCard({
  label, value, valueColor, sub, icon,
}: {
  label: string; value: string; valueColor?: string;
  sub?: string; icon: React.ReactNode;
}) {
  return (
    <div
      className="p-4 flex items-start gap-3"
      style={{ background: '#11161d', border: '1px solid #2a3441' }}
    >
      <div
        className="w-9 h-9 flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(0,104,255,0.1)', color: '#0068ff' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs mb-1" style={{ color: '#6c7684' }}>{label}</p>
        <p className="text-xl font-semibold leading-none" style={{ color: valueColor ?? '#f5f6f8' }}>
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-1.5 mono" style={{ color: '#a0a8b4' }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

function PriceChange({ value }: { value: string }) {
  const num = parseFloat(value);
  const isPos = num >= 0;
  return (
    <span className="inline-flex items-center gap-1 mono text-xs" style={{ color: isPos ? '#00d09c' : '#ff4d5e' }}>
      {isPos ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
      {formatPercent(num)}
    </span>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5"
      style={{
        background: connected ? 'rgba(0,208,156,0.1)' : 'rgba(108,118,132,0.15)',
        color: connected ? '#00d09c' : '#6c7684',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? '#00d09c' : '#6c7684' }} />
      {connected ? 'Live' : 'Polling'}
    </span>
  );
}

// Tracks last-seen prices; rerender after each ws tick re-applies flash class to changed rows.
function usePriceFlashes(rows: MarketDataResponse[]): Map<string, 'up' | 'down' | undefined> {
  const lastPriceRef = useRef<Map<string, number>>(new Map());
  const flashRef = useRef<Map<string, 'up' | 'down' | undefined>>(new Map());

  for (const row of rows) {
    const price = parseFloat(row.lastPrice);
    const prev = lastPriceRef.current.get(row.symbol);
    if (prev !== undefined && prev !== price) {
      flashRef.current.set(row.symbol, price > prev ? 'up' : 'down');
    }
    lastPriceRef.current.set(row.symbol, price);
  }
  return flashRef.current;
}

export default function DashboardPage() {
  const { data: restData, isLoading, error } = useQuery<MarketDataResponse[]>({
    queryKey: ['market-data'],
    queryFn: getAllMarketData,
    refetchInterval: (query) => (query.state.data ? false : 5000),
  });

  const symbols = useMemo(() => restData?.map((d) => d.symbol) ?? [], [restData]);
  const { updates, connected } = useMarketDataSocket(symbols);

  const displayData = useMemo<MarketDataResponse[]>(() => {
    if (!restData) return [];
    return restData.map((row) => {
      const ws = updates.get(row.symbol);
      if (!ws) return row;
      return {
        ...row,
        lastPrice: String(ws.lastPrice),
        volume24h: String(ws.volume24h),
        high24h: String(ws.high24h),
        low24h: String(ws.low24h),
        priceChange24h: String(ws.priceChange24h),
        priceChangePercent24h: String(ws.priceChangePercent24h),
        tradeCount24h: ws.tradeCount24h,
      };
    });
  }, [restData, updates]);

  const flashes = usePriceFlashes(displayData);
  useEffect(() => {}, [updates]);  // force re-render so flash animation re-keys

  // ─── Filter + sort ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('volume24h');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [watched, setWatched] = useState<Set<string>>(() => getWatchlist());

  useEffect(() => {
    const handler = () => setWatched(getWatchlist());
    window.addEventListener('watchlist-changed', handler);
    return () => window.removeEventListener('watchlist-changed', handler);
  }, []);

  const filteredData = useMemo(() => {
    let rows = displayData.slice();
    if (tab === 'watchlist') rows = rows.filter((r) => watched.has(r.symbol));
    if (tab === 'gainers')   rows = rows.filter((r) => parseFloat(r.priceChangePercent24h) >= 0);
    if (tab === 'losers')    rows = rows.filter((r) => parseFloat(r.priceChangePercent24h) <  0);

    rows.sort((a, b) => {
      const av = sortKey === 'symbol' ? a.symbol : parseFloat(a[sortKey] as string) || 0;
      const bv = sortKey === 'symbol' ? b.symbol : parseFloat(b[sortKey] as string) || 0;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [displayData, tab, sortKey, sortDir, watched]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'symbol' ? 'asc' : 'desc'); }
  }

  const stats = displayData.length > 0 ? {
    pairs:   displayData.length,
    gainers: displayData.filter(r => parseFloat(r.priceChangePercent24h) >= 0).length,
    losers:  displayData.filter(r => parseFloat(r.priceChangePercent24h) < 0).length,
    topVol:  displayData.reduce((max, r) =>
      parseFloat(r.volume24h) > parseFloat(max.volume24h) ? r : max, displayData[0]),
  } : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#f5f6f8' }}>Markets</h2>
        <ConnectionBadge connected={connected} />
      </div>

      {error && (
        <p className="text-sm mb-4" style={{ color: '#ff4d5e' }}>Failed to load market data.</p>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Trading pairs" value={String(stats.pairs)} icon={<IconDashboard size={18} />} />
          <StatCard label="Gainers" value={String(stats.gainers)} valueColor="#00d09c" icon={<IconTrendingUp size={18} />} />
          <StatCard label="Losers"  value={String(stats.losers)}  valueColor="#ff4d5e" icon={<IconTrendingDown size={18} />} />
          <StatCard
            label="Top volume"
            value={stats.topVol?.symbol ?? '—'}
            sub={formatCompactCurrency(parseFloat(stats.topVol?.volume24h ?? '0') * parseFloat(stats.topVol?.lastPrice ?? '0'))}
            icon={<IconHistory size={18} />}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-3" style={{ borderBottom: '1px solid #2a3441' }}>
        {([
          { id: 'all',       label: 'All' },
          { id: 'watchlist', label: `Watchlist${watched.size > 0 ? ` (${watched.size})` : ''}` },
          { id: 'gainers',   label: 'Gainers' },
          { id: 'losers',    label: 'Losers' },
        ] as { id: FilterTab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 text-sm relative transition-colors"
            style={{ color: tab === t.id ? '#0068ff' : '#a0a8b4' }}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: '#0068ff' }} />
            )}
          </button>
        ))}
      </div>

      <div style={{ border: '1px solid #2a3441' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}>
              <th className="px-2 py-2 text-xs" style={{ color: '#6c7684', width: 24 }}></th>
              {([
                { label: 'Symbol',      key: 'symbol' as SortKey,                  align: 'left' },
                { label: 'Last price',  key: 'lastPrice' as SortKey,                align: 'left' },
                { label: '24h Δ',       key: 'priceChangePercent24h' as SortKey,    align: 'right' },
                { label: '24h chart',   key: null,                                  align: 'right' },
                { label: '24h volume',  key: 'volume24h' as SortKey,                align: 'right' },
                { label: '24h high',    key: 'high24h' as SortKey,                  align: 'right' },
                { label: '24h low',     key: 'low24h' as SortKey,                   align: 'right' },
                { label: 'Trades',      key: 'tradeCount24h' as SortKey,            align: 'right' },
              ]).map((h) => (
                <th
                  key={h.label}
                  onClick={h.key ? () => toggleSort(h.key!) : undefined}
                  className={`px-3 py-2 text-xs ${h.align === 'right' ? 'text-right' : 'text-left'} ${h.key ? 'cursor-pointer select-none' : ''}`}
                  style={{ color: sortKey === h.key ? '#0068ff' : '#6c7684' }}
                >
                  {h.label}
                  {h.key && sortKey === h.key && (
                    <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonRows rows={8} cols={9} />}
            {!isLoading && filteredData.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: '#6c7684' }}>
                  {tab === 'watchlist' ? 'No starred markets — click ☆ next to a symbol to add.' : 'No markets match.'}
                </td>
              </tr>
            )}
            {filteredData.map((row) => {
              const flash = flashes.get(row.symbol);
              const price = parseFloat(row.lastPrice);
              const pct = parseFloat(row.priceChangePercent24h);
              const sparkData = syntheticSparkline(row.symbol, price, pct);
              return (
                <tr
                  key={row.id + ':' + row.lastPrice}
                  className={flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}
                  style={{ borderBottom: '1px solid #1a2029' }}
                >
                  <td className="px-2 py-2.5"><StarButton symbol={row.symbol} /></td>
                  <td className="px-3 py-2.5 mono text-xs" style={{ color: '#f5f6f8' }}>{row.symbol}</td>
                  <td className="px-3 py-2.5 mono text-xs" style={{ color: '#f5f6f8' }}>{formatPrice(price, '$')}</td>
                  <td className="px-3 py-2.5 text-right"><PriceChange value={row.priceChangePercent24h} /></td>
                  <td className="px-3 py-2.5">
                    <div style={{ float: 'right' }}>
                      <Sparkline data={sparkData} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#a0a8b4' }}>
                    {formatCompactCurrency(parseFloat(row.volume24h) * price)}
                  </td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#a0a8b4' }}>{formatPrice(row.high24h, '$')}</td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#a0a8b4' }}>{formatPrice(row.low24h, '$')}</td>
                  <td className="px-3 py-2.5 text-xs text-right" style={{ color: '#a0a8b4' }}>{formatNumber(row.tradeCount24h)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
