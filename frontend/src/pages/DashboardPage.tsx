import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllMarketData } from '../api/market';
import Spinner from '../components/Spinner';
import { IconDashboard, IconTrendingUp, IconTrendingDown, IconHistory } from '../components/icons';
import { useMarketDataSocket } from '../hooks/useMarketDataSocket';
import type { MarketDataResponse } from '../types';

function StatCard({
  label, value, valueColor, sub, icon,
}: {
  label: string; value: string; valueColor?: string;
  sub?: string; icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3"
      style={{ background: '#252930', border: '1px solid #3c4049' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(240,185,11,0.1)', color: '#f0b90b' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium mb-1" style={{ color: '#6b7280' }}>{label}</p>
        <p className="text-xl font-bold leading-none" style={{ color: valueColor ?? '#e2e8f0' }}>
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-1.5 font-mono" style={{ color: '#9ca3af' }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

function PriceChange({ value }: { value: string }) {
  const num = parseFloat(value);
  const isPos = num >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color: isPos ? '#0ecb81' : '#f6465d' }}
    >
      {isPos ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
      {isPos ? '+' : ''}{num.toFixed(2)}%
    </span>
  );
}

function fmt(value: string, decimals = 2) {
  const n = parseFloat(value);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        background: connected ? 'rgba(14,203,129,0.1)' : 'rgba(107,114,128,0.15)',
        color: connected ? '#0ecb81' : '#6b7280',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: connected ? '#0ecb81' : '#6b7280' }}
      />
      {connected ? 'Live' : 'Polling'}
    </span>
  );
}

export default function DashboardPage() {
  const { data: restData, isLoading, error } = useQuery<MarketDataResponse[]>({
    queryKey: ['market-data'],
    queryFn: getAllMarketData,
    // Stop polling once we have initial data — WS takes over
    refetchInterval: (query) => (query.state.data ? false : 5000),
  });

  const symbols = useMemo(() => restData?.map((d) => d.symbol) ?? [], [restData]);
  const { updates, connected } = useMarketDataSocket(symbols);

  // Merge REST baseline with live WS updates (WS overrides each row it covers)
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
        <h2 className="text-xl font-semibold" style={{ color: '#e2e8f0' }}>Market Overview</h2>
        <ConnectionBadge connected={connected} />
      </div>

      {isLoading && <Spinner />}
      {error && (
        <p className="text-sm" style={{ color: '#f6465d' }}>Failed to load market data.</p>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Trading Pairs" value={String(stats.pairs)} icon={<IconDashboard size={18} />} />
          <StatCard label="Gainers" value={String(stats.gainers)} valueColor="#0ecb81" icon={<IconTrendingUp size={18} />} />
          <StatCard label="Losers"  value={String(stats.losers)}  valueColor="#f6465d" icon={<IconTrendingDown size={18} />} />
          <StatCard
            label="Top Volume"
            value={stats.topVol?.symbol ?? '—'}
            sub={`$${fmt(stats.topVol?.volume24h ?? '0', 0)}`}
            icon={<IconHistory size={18} />}
          />
        </div>
      )}

      {displayData.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #3c4049' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10" style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
                {['Symbol', 'Last Price', '24h Change', '24h Volume', '24h High', '24h Low', 'Trades'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: '#6b7280' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: '#6b7280' }}>
                    No market data yet. Place some orders to generate activity.
                  </td>
                </tr>
              )}
              {displayData.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid #2a2d35', cursor: 'pointer' }}
                  className="transition-colors"
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                >
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: 'rgba(240,185,11,0.08)', color: '#f0b90b' }}>
                      {row.symbol}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold" style={{ color: '#e2e8f0' }}>${fmt(row.lastPrice)}</td>
                  <td className="px-4 py-3"><PriceChange value={row.priceChangePercent24h} /></td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#9ca3af' }}>{fmt(row.volume24h, 4)}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#9ca3af' }}>${fmt(row.high24h)}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#9ca3af' }}>${fmt(row.low24h)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9ca3af' }}>{row.tradeCount24h.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
