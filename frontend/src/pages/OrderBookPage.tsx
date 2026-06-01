import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrderBook } from '../api/orders';
import Spinner from '../components/Spinner';
import { useOrderBookSocket } from '../hooks/useOrderBookSocket';
import type { OrderResponse, WsPriceLevel, WsTradeEvent } from '../types';

const QUICK_SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'SOL-USDT'];

// ─── REST fallback: aggregate raw orders client-side ────────────────────────
interface AggLevel { price: number; quantity: number; count: number; }

function aggregateOrders(orders: OrderResponse[]): AggLevel[] {
  const map = new Map<string, AggLevel>();
  for (const o of orders) {
    const remaining = parseFloat(o.quantity) - parseFloat(o.filledQuantity);
    if (remaining <= 0) continue;
    const key = parseFloat(o.price ?? '0').toFixed(2);
    const entry = map.get(key);
    if (entry) { entry.quantity += remaining; entry.count++; }
    else map.set(key, { price: parseFloat(key), quantity: remaining, count: 1 });
  }
  return Array.from(map.values());
}

// ─── WS snapshot table (pre-aggregated by backend) ──────────────────────────
function SnapshotDepthTable({ levels, side }: { levels: WsPriceLevel[]; side: 'BUY' | 'SELL' }) {
  const color   = side === 'BUY' ? '#0ecb81' : '#f6465d';
  const depthBg = side === 'BUY' ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)';
  const sorted  = [...levels].sort((a, b) => side === 'BUY' ? b.price - a.price : a.price - b.price);
  const maxQty  = Math.max(...sorted.map((l) => l.quantity), 1);

  return (
    <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #3c4049' }}>
      <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="font-semibold text-sm" style={{ color }}>{side === 'BUY' ? 'Bids' : 'Asks'}</span>
        <span className="text-xs ml-1" style={{ color: '#6b7280' }}>{sorted.length} price levels</span>
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
          {sorted.length === 0 && (
            <tr><td colSpan={3} className="px-4 py-8 text-center text-xs" style={{ color: '#6b7280' }}>No {side.toLowerCase()} orders</td></tr>
          )}
          {sorted.map((l) => {
            const pct = (l.quantity / maxQty) * 100;
            return (
              <tr key={l.price} style={{ borderBottom: '1px solid #2a2d35', position: 'relative' }}>
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`, background: depthBg, pointerEvents: 'none' }} />
                  <span style={{ position: 'relative' }}>{l.price.toFixed(2)}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: '#9ca3af' }}>{l.quantity.toFixed(6)}</td>
                <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#6b7280' }}>{l.orderCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── REST fallback table ─────────────────────────────────────────────────────
function RestDepthTable({ orders, side }: { orders: OrderResponse[]; side: 'BUY' | 'SELL' }) {
  const color   = side === 'BUY' ? '#0ecb81' : '#f6465d';
  const depthBg = side === 'BUY' ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)';
  const levels  = aggregateOrders(orders).sort((a, b) => side === 'BUY' ? b.price - a.price : a.price - b.price);
  const maxQty  = Math.max(...levels.map((l) => l.quantity), 1);

  return (
    <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #3c4049' }}>
      <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="font-semibold text-sm" style={{ color }}>{side === 'BUY' ? 'Bids' : 'Asks'}</span>
        <span className="text-xs ml-1" style={{ color: '#6b7280' }}>{levels.length} price levels</span>
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
            <tr><td colSpan={3} className="px-4 py-8 text-center text-xs" style={{ color: '#6b7280' }}>No {side.toLowerCase()} orders</td></tr>
          )}
          {levels.map((l) => {
            const pct = (l.quantity / maxQty) * 100;
            return (
              <tr key={l.price} style={{ borderBottom: '1px solid #2a2d35', position: 'relative' }}>
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`, background: depthBg, pointerEvents: 'none' }} />
                  <span style={{ position: 'relative' }}>{l.price.toFixed(2)}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: '#9ca3af' }}>{l.quantity.toFixed(6)}</td>
                <td className="px-4 py-2.5 text-right text-xs" style={{ color: '#6b7280' }}>{l.count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Live trades feed ────────────────────────────────────────────────────────
function RecentTrades({ trades }: { trades: WsTradeEvent[] }) {
  if (trades.length === 0) return null;
  return (
    <div className="rounded-xl overflow-hidden mt-4" style={{ border: '1px solid #3c4049' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#f0b90b' }} />
        <span className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>Recent Trades</span>
        <span className="text-xs ml-1" style={{ color: '#6b7280' }}>last {trades.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
            <th className="px-4 py-2 text-left text-xs font-medium"  style={{ color: '#6b7280' }}>Price</th>
            <th className="px-4 py-2 text-right text-xs font-medium" style={{ color: '#6b7280' }}>Quantity</th>
            <th className="px-4 py-2 text-right text-xs font-medium" style={{ color: '#6b7280' }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={t.tradeId} style={{ borderBottom: '1px solid #2a2d35', opacity: Math.max(1 - i * 0.04, 0.4) }}>
              <td className="px-4 py-2 font-mono text-xs font-semibold" style={{ color: '#0ecb81' }}>
                {t.price.toFixed(2)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-xs" style={{ color: '#9ca3af' }}>
                {t.quantity.toFixed(6)}
              </td>
              <td className="px-4 py-2 text-right text-xs" style={{ color: '#6b7280' }}>
                {new Date(t.timestamp).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Connection badge ────────────────────────────────────────────────────────
function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        background: connected ? 'rgba(14,203,129,0.1)' : 'rgba(107,114,128,0.15)',
        color: connected ? '#0ecb81' : '#6b7280',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? '#0ecb81' : '#6b7280' }} />
      {connected ? 'Live' : 'Polling'}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function OrderBookPage() {
  const [symbol, setSymbol]     = useState('BTC-USDT');
  const [inputVal, setInputVal] = useState('BTC-USDT');

  const { snapshot, trades, connected } = useOrderBookSocket(symbol);

  // REST fallback — active only when WS has no snapshot yet
  const { data: restData, isLoading, error } = useQuery({
    queryKey: ['order-book', symbol],
    queryFn: () => getOrderBook(symbol),
    refetchInterval: connected && snapshot ? false : 5000,
    enabled: !!symbol,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSymbol(inputVal.toUpperCase().trim());
  }

  const showSnapshot = connected && snapshot !== null;

  // Spread — from whichever data source is active
  const { bestBid, bestAsk } = (() => {
    if (showSnapshot) {
      const bid = snapshot.bids.reduce((m, l) => (l.price > m ? l.price : m), 0);
      const ask = snapshot.asks.reduce((m, l) => (l.price < m ? l.price : m), Infinity);
      return { bestBid: bid, bestAsk: ask };
    }
    const bid = restData?.buyOrders.reduce((best, o) => {
      const p = parseFloat(o.price ?? '0');
      return p > best ? p : best;
    }, 0) ?? 0;
    const ask = restData?.sellOrders.reduce((best, o) => {
      const p = parseFloat(o.price ?? 'Infinity');
      return p < best ? p : best;
    }, Infinity) ?? Infinity;
    return { bestBid: bid, bestAsk: ask };
  })();

  const spread    = bestAsk !== Infinity && bestBid > 0 ? bestAsk - bestBid : null;
  const spreadPct = spread !== null && bestBid > 0 ? (spread / bestBid) * 100 : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold" style={{ color: '#e2e8f0' }}>Order Book</h2>
        <ConnectionBadge connected={connected} />
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

        <span className="text-xs px-2 py-1 rounded-lg" style={{ background: '#252930', color: '#6b7280', border: '1px solid #3c4049' }}>
          {showSnapshot ? '⚡ Real-time snapshot' : '↺ Aggregated REST'}
        </span>
      </div>

      {isLoading && !snapshot && <Spinner />}
      {error && !snapshot && <p className="text-sm" style={{ color: '#f6465d' }}>Failed to load order book.</p>}

      {/* Spread panel */}
      {spread !== null && (
        <div
          className="flex items-center justify-center gap-6 py-2.5 px-4 rounded-xl mb-4"
          style={{ background: '#252930', border: '1px solid #3c4049' }}
        >
          <div className="text-center">
            <p className="text-xs mb-0.5" style={{ color: '#6b7280' }}>Best Bid</p>
            <p className="font-mono text-sm font-semibold" style={{ color: '#0ecb81' }}>{bestBid.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs mb-0.5" style={{ color: '#6b7280' }}>Spread</p>
            <p className="font-mono text-sm font-semibold" style={{ color: '#f0b90b' }}>{spread.toFixed(2)}</p>
            {spreadPct !== null && (
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{spreadPct.toFixed(3)}%</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs mb-0.5" style={{ color: '#6b7280' }}>Best Ask</p>
            <p className="font-mono text-sm font-semibold" style={{ color: '#f6465d' }}>
              {bestAsk === Infinity ? '—' : bestAsk.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Order book depth tables */}
      {showSnapshot ? (
        <div className="flex gap-4">
          <SnapshotDepthTable levels={snapshot.bids} side="BUY" />
          <SnapshotDepthTable levels={snapshot.asks} side="SELL" />
        </div>
      ) : restData && (
        <div className="flex gap-4">
          <RestDepthTable orders={restData.buyOrders}  side="BUY" />
          <RestDepthTable orders={restData.sellOrders} side="SELL" />
        </div>
      )}

      {/* Live trades feed — visible only when WS is connected */}
      <RecentTrades trades={trades} />
    </div>
  );
}
