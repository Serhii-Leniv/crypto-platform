import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMarkets, type Market } from '../api/markets';
import { getAllMarketData } from '../api/market';
import { useOrderBookSocket } from '../hooks/useOrderBookSocket';
import CandleChart from '../components/CandleChart';
import { generateCandles } from '../lib/candles';
import Sparkline, { syntheticSparkline } from '../components/Sparkline';
import { formatCompactCurrency, formatPercent, formatPrice } from '../lib/format';
import type { MarketDataResponse } from '../types';

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type Interval = typeof INTERVALS[number];

export default function MarketDetailPage() {
  const { symbol = '' } = useParams<{ symbol: string }>();
  const [interval, setInterval] = useState<Interval>('1h');

  const { data: markets } = useQuery<Market[]>({ queryKey: ['markets'], queryFn: getMarkets, staleTime: 60_000 });
  const { data: tickers } = useQuery<MarketDataResponse[]>({ queryKey: ['market-data'], queryFn: getAllMarketData });

  // Redirect if symbol is not a valid trading pair
  if (markets && !markets.find((m) => m.symbol === symbol)) {
    return <Navigate to="/dashboard" replace />;
  }

  const market = markets?.find((m) => m.symbol === symbol);
  const ticker = tickers?.find((t) => t.symbol === symbol);
  const lastPrice = ticker ? parseFloat(ticker.lastPrice) : 0;
  const change24h = ticker ? parseFloat(ticker.priceChangePercent24h) : 0;
  const change24hAbs = ticker ? parseFloat(ticker.priceChange24h) : 0;
  const baseCurrency  = market?.baseCurrency  ?? '';
  const quoteCurrency = market?.quoteCurrency ?? '';

  const candles = useMemo(() => {
    if (!ticker) return [];
    return generateCandles(symbol, lastPrice, change24h, interval, 120);
  }, [symbol, lastPrice, change24h, interval, ticker]);

  const { snapshot, trades } = useOrderBookSocket(symbol);
  const bestBid = useMemo(() => Math.max(...(snapshot?.bids.map((b) => b.price) ?? [0])), [snapshot]);
  const bestAsk = useMemo(() => {
    const asks = snapshot?.asks.map((a) => a.price) ?? [];
    return asks.length > 0 ? Math.min(...asks) : 0;
  }, [snapshot]);
  const spreadAbs = bestBid > 0 && bestAsk > 0 ? bestAsk - bestBid : null;
  const spreadBp  = spreadAbs !== null && bestBid > 0 ? (spreadAbs / bestBid) * 10000 : null;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ color: '#6c7684' }}>
        <Link to="/dashboard" style={{ color: '#0068ff' }}>Markets</Link>
        <span>›</span>
        <span className="mono" style={{ color: '#a0a8b4' }}>{symbol}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-6 p-4" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-3">
            <span className="mono text-2xl font-semibold" style={{ color: '#f5f6f8' }}>{symbol}</span>
            {market && (
              <span
                className="text-[10px] px-2 py-0.5 mono"
                style={{
                  background: market.status === 'ACTIVE' ? 'rgba(0,208,156,0.10)' : 'rgba(255,184,0,0.10)',
                  color:      market.status === 'ACTIVE' ? '#00d09c' : '#ffb800',
                  border:     '1px solid ' + (market.status === 'ACTIVE' ? '#00d09c' : '#ffb800'),
                }}
              >
                {market.status}
              </span>
            )}
          </div>
          {ticker && (
            <div className="flex items-baseline gap-3 mt-2">
              <span className="mono text-3xl font-semibold" style={{ color: change24h >= 0 ? '#00d09c' : '#ff4d5e' }}>
                {formatPrice(lastPrice, '$')}
              </span>
              <span className="mono text-sm" style={{ color: change24h >= 0 ? '#00d09c' : '#ff4d5e' }}>
                {change24hAbs >= 0 ? '+' : ''}{formatPrice(change24hAbs, '')} ({formatPercent(change24h)})
              </span>
            </div>
          )}
        </div>

        {ticker && (
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="24h High"     value={formatPrice(ticker.high24h, '$')} />
            <Stat label="24h Low"      value={formatPrice(ticker.low24h, '$')} />
            <Stat label={`24h Vol (${baseCurrency})`} value={formatCompactCurrency(parseFloat(ticker.volume24h))} />
            <Stat label="24h Vol ($)"  value={formatCompactCurrency(parseFloat(ticker.volume24h) * lastPrice)} />
            <Stat label="24h Trades"   value={(ticker.tradeCount24h ?? 0).toString()} />
            <Stat label="Best bid"     value={bestBid > 0 ? formatPrice(bestBid, '$') : '—'}  valueColor="#00d09c" />
            <Stat label="Best ask"     value={bestAsk > 0 ? formatPrice(bestAsk, '$') : '—'}  valueColor="#ff4d5e" />
            <Stat label="Spread"       value={spreadAbs !== null && spreadBp !== null ? `${spreadAbs.toFixed(2)} · ${spreadBp.toFixed(1)} bp` : '—'} />
          </div>
        )}

        <Link
          to={`/trade?symbol=${encodeURIComponent(symbol)}`}
          className="px-4 py-2 text-sm font-semibold transition-opacity self-start"
          style={{ background: '#0068ff', color: '#fff' }}
        >
          Open Trade →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2" style={{ background: '#0a0e14', border: '1px solid #2a3441' }}>
          <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom: '1px solid #2a3441' }}>
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className="px-2.5 py-1 text-xs mono transition-colors"
                style={{
                  background: interval === iv ? 'rgba(0,104,255,0.12)' : 'transparent',
                  color:      interval === iv ? '#0068ff' : '#6c7684',
                }}
              >
                {iv}
              </button>
            ))}
            <div className="ml-auto text-[10px] mono" style={{ color: '#6c7684' }}>
              {symbol} · {interval}
            </div>
          </div>
          <div style={{ height: 480 }}>
            {candles.length > 0
              ? <CandleChart candles={candles} />
              : <div className="h-full flex items-center justify-center" style={{ color: '#6c7684' }}>Loading chart…</div>
            }
          </div>
        </div>

        {/* Sidecar: market info + 7d trend + recent trades */}
        <div className="space-y-4">
          {/* Pair info */}
          <div style={{ background: '#11161d', border: '1px solid #2a3441' }}>
            <div className="px-3 py-2" style={{ borderBottom: '1px solid #2a3441' }}>
              <span className="text-xs font-semibold" style={{ color: '#a0a8b4' }}>Pair info</span>
            </div>
            <div className="p-3 space-y-2 text-xs">
              <InfoRow label="Base currency"  value={baseCurrency} />
              <InfoRow label="Quote currency" value={quoteCurrency} />
              {market && <InfoRow label="Min quantity" value={parseFloat(market.minQuantity).toString()} />}
              {market && <InfoRow label="Tick size"    value={parseFloat(market.tickSize).toString()} />}
              {ticker && (
                <InfoRow label="Trades (24h)" value={(ticker.tradeCount24h ?? 0).toString()} />
              )}
            </div>
          </div>

          {/* 24h trend */}
          {ticker && (
            <div className="p-3" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: '#a0a8b4' }}>Synthetic trend</span>
                <span className="mono text-[10px]" style={{ color: '#6c7684' }}>24h</span>
              </div>
              <Sparkline data={syntheticSparkline(symbol, lastPrice, change24h)} width={280} height={60} />
            </div>
          )}

          {/* Recent trades */}
          <div style={{ background: '#11161d', border: '1px solid #2a3441' }}>
            <div className="px-3 py-2" style={{ borderBottom: '1px solid #2a3441' }}>
              <span className="text-xs font-semibold" style={{ color: '#a0a8b4' }}>Recent trades</span>
            </div>
            {trades.length === 0 ? (
              <div className="p-4 text-center text-xs" style={{ color: '#6c7684' }}>
                Waiting for trades…
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: '#0a0e14' }}>
                    <th className="px-2 py-1 text-left  font-normal" style={{ color: '#6c7684' }}>Time</th>
                    <th className="px-2 py-1 text-right font-normal" style={{ color: '#6c7684' }}>Price</th>
                    <th className="px-2 py-1 text-right font-normal" style={{ color: '#6c7684' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 20).map((t, i, arr) => {
                    const prev = arr[i + 1];
                    const c = !prev ? '#a0a8b4'
                            : t.price > prev.price ? '#00d09c'
                            : t.price < prev.price ? '#ff4d5e'
                            : '#a0a8b4';
                    return (
                      <tr key={t.tradeId} style={{ borderTop: '1px solid #1a2029' }}>
                        <td className="px-2 py-1 mono" style={{ color: '#6c7684' }}>{new Date(t.timestamp).toLocaleTimeString()}</td>
                        <td className="px-2 py-1 mono text-right" style={{ color: c }}>{t.price.toFixed(2)}</td>
                        <td className="px-2 py-1 mono text-right" style={{ color: '#a0a8b4' }}>{t.quantity.toFixed(6)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px]" style={{ color: '#6c7684' }}>{label}</span>
      <span className="mono text-sm" style={{ color: valueColor ?? '#a0a8b4' }}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span style={{ color: '#6c7684' }}>{label}</span>
      <span className="mono" style={{ color: '#a0a8b4' }}>{value}</span>
    </div>
  );
}
