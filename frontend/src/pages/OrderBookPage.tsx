import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrderBook } from '../api/orders';
import Spinner from '../components/Spinner';
import type { OrderResponse } from '../types';

const QUICK_SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'SOL-USDT'];

interface AggLevel { price: number; quantity: number; count: number; }

function aggregateOrders(orders: OrderResponse[]): AggLevel[] {
  const map = new Map<string, AggLevel>();
  for (const o of orders) {
    const remaining = parseFloat(o.quantity) - parseFloat(o.filledQuantity);
    if (remaining <= 0) continue;
    const key = parseFloat(o.price ?? '0').toFixed(2);
    const entry = map.get(key);
    if (entry) {
      entry.quantity += remaining;
      entry.count++;
    } else {
      map.set(key, { price: parseFloat(key), quantity: remaining, count: 1 });
    }
  }
  return Array.from(map.values());
}

function DepthTable({
  orders, side, aggregated,
}: {
  orders: OrderResponse[]; side: 'BUY' | 'SELL'; aggregated: boolean;
}) {
  const color   = side === 'BUY' ? '#0ecb81' : '#f6465d';
  const depthBg = side === 'BUY' ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)';

  if (aggregated) {
    const levels = aggregateOrders(orders).sort((a, b) =>
      side === 'BUY' ? b.price - a.price : a.price - b.price,
    );
    const maxQty = Math.max(...levels.map((l) => l.quantity), 1);

    return (
      <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #3c4049' }}>
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center gap-2.5"
          style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          <span className="font-semibold text-sm" style={{ color }}>
            {side === 'BUY' ? 'Bids' : 'Asks'}
          </span>
          <span className="text-xs ml-1" style={{ color: '#6b7280' }}>
            {levels.length} price levels
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
              <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: '#6b7280' }}>Price</th>
              <th className="px-4 py-2 text-right text-xs font-medium" style={{ color: '#6b7280' }}>Total Qty</th>
              <th className="px-4 py-2 text-right text-xs font-medium" style={{ color: '#6b7280' }}>Orders</th>
            </tr>
          </thead>
          <tbody>
            {levels.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-xs" style={{ color: '#6b7280' }}>
                  No {side.toLowerCase()} orders
                </td>
              </tr>
            )}
            {levels.map((l) => {
              const pct = (l.quantity / maxQty) * 100;
              return (
                <tr
                  key={l.price}
                  style={{ borderBottom: '1px solid #2a2d35', position: 'relative' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                >
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color, position: 'relative' }}>
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, left: 0,
                      width: `${pct}%`, background: depthBg, pointerEvents: 'none',
                    }} />
                    <span style={{ position: 'relative' }}>{l.price.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: '#9ca3af' }}>
                    {l.quantity.toFixed(6)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#6b7280' }}>
                    {l.count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const sorted = [...orders].sort((a, b) => {
    const pa = parseFloat(a.price ?? '0'), pb = parseFloat(b.price ?? '0');
    return side === 'BUY' ? pb - pa : pa - pb;
  });

  return (
    <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #3c4049' }}>
      <div
        className="px-4 py-3 flex items-center gap-2.5"
        style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="font-semibold text-sm" style={{ color }}>
          {side === 'BUY' ? 'Bids' : 'Asks'}
        </span>
        <span className="text-xs ml-1" style={{ color: '#6b7280' }}>{sorted.length} orders</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
            <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: '#6b7280' }}>Price</th>
            <th className="px-4 py-2 text-right text-xs font-medium" style={{ color: '#6b7280' }}>Qty</th>
            <th className="px-4 py-2 text-right text-xs font-medium" style={{ color: '#6b7280' }}>Filled</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-xs" style={{ color: '#6b7280' }}>
                No {side.toLowerCase()} orders
              </td>
            </tr>
          )}
          {sorted.map((o) => (
            <tr
              key={o.id}
              style={{ borderBottom: '1px solid #2a2d35' }}
              onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
              onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
            >
              <td className="px-4 py-2.5 font-mono text-xs" style={{ color }}>
                {parseFloat(o.price ?? '0').toFixed(2)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: '#9ca3af' }}>
                {parseFloat(o.quantity).toFixed(6)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: '#6b7280' }}>
                {parseFloat(o.filledQuantity).toFixed(6)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OrderBookPage() {
  const [symbol, setSymbol]     = useState('BTC-USDT');
  const [inputVal, setInputVal] = useState('BTC-USDT');
  const [aggregated, setAggregated] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['order-book', symbol],
    queryFn: () => getOrderBook(symbol),
    refetchInterval: 5000,
    enabled: !!symbol,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const val = inputVal.toUpperCase().trim();
    setSymbol(val);
  }

  const bestBid = data?.buyOrders.reduce((best, o) => {
    const p = parseFloat(o.price ?? '0');
    return p > best ? p : best;
  }, 0) ?? 0;

  const bestAsk = data?.sellOrders.reduce((best, o) => {
    const p = parseFloat(o.price ?? 'Infinity');
    return p < best ? p : best;
  }, Infinity) ?? Infinity;

  const spread = bestAsk !== Infinity && bestBid > 0 ? bestAsk - bestBid : null;
  const spreadPct = spread !== null && bestBid > 0 ? (spread / bestBid) * 100 : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold" style={{ color: '#e2e8f0' }}>Order Book</h2>
        <span className="text-xs" style={{ color: '#4b5563' }}>Live · refreshes every 5s</span>
      </div>

      {/* Quick symbol tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {QUICK_SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => { setSymbol(s); setInputVal(s); }}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: symbol === s ? '#f0b90b' : '#252930',
              color:      symbol === s ? '#1e2026' : '#9ca3af',
              border: `1px solid ${symbol === s ? '#f0b90b' : '#3c4049'}`,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="BTC-USDT"
            className="input-field px-3 py-1.5 rounded-lg text-sm text-gray-100 w-36"
            style={{ background: '#252930', border: '1px solid #3c4049' }}
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: '#f0b90b', color: '#1e2026' }}
          >
            Load
          </button>
        </form>

        <button
          onClick={() => setAggregated((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: aggregated ? 'rgba(240,185,11,0.1)' : '#1e2026',
            color:      aggregated ? '#f0b90b' : '#9ca3af',
            border: `1px solid ${aggregated ? '#f0b90b' : '#3c4049'}`,
          }}
        >
          {aggregated ? 'Aggregated' : 'Raw Orders'}
        </button>
      </div>

      {isLoading && <Spinner />}
      {error && <p className="text-sm" style={{ color: '#f6465d' }}>Failed to load order book.</p>}

      {data && (
        <>
          {/* Spread panel */}
          {spread !== null && (
            <div
              className="flex items-center justify-center gap-6 py-2.5 px-4 rounded-xl mb-4"
              style={{ background: '#252930', border: '1px solid #3c4049' }}
            >
              <div className="text-center">
                <p className="text-xs mb-0.5" style={{ color: '#6b7280' }}>Best Bid</p>
                <p className="font-mono text-sm font-semibold" style={{ color: '#0ecb81' }}>
                  {bestBid.toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs mb-0.5" style={{ color: '#6b7280' }}>Spread</p>
                <p className="font-mono text-sm font-semibold" style={{ color: '#f0b90b' }}>
                  {spread.toFixed(2)}
                </p>
                {spreadPct !== null && (
                  <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                    {spreadPct.toFixed(3)}%
                  </p>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs mb-0.5" style={{ color: '#6b7280' }}>Best Ask</p>
                <p className="font-mono text-sm font-semibold" style={{ color: '#f6465d' }}>
                  {bestAsk.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <DepthTable orders={data.buyOrders}  side="BUY"  aggregated={aggregated} />
            <DepthTable orders={data.sellOrders} side="SELL" aggregated={aggregated} />
          </div>
        </>
      )}
    </div>
  );
}
