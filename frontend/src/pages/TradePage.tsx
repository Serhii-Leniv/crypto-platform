import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMarkets, type Market } from '../api/markets';
import { getAllMarketData } from '../api/market';
import { placeOrder, getMyOrders } from '../api/orders';
import { getWallets } from '../api/wallets';
import { useOrderBookSocket } from '../hooks/useOrderBookSocket';
import { useToast } from '../context/ToastContext';
import CandleChart, { type OrderLine } from '../components/CandleChart';
import { generateCandles } from '../lib/candles';
import { formatPrice, formatPercent, formatCompactCurrency } from '../lib/format';
import type { OrderSide, OrderType, TimeInForce, WalletResponse, MarketDataResponse } from '../types';

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type Interval = typeof INTERVALS[number];

export default function TradePage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // ─── Symbol + interval bound to URL so refresh / share preserves state ─────
  const [params, setParams] = useSearchParams();
  const symbol = params.get('symbol') ?? '';
  const setSymbol = (s: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('symbol', s); return n; }, { replace: true });

  const { data: markets } = useQuery<Market[]>({ queryKey: ['markets'], queryFn: getMarkets, staleTime: 60_000 });
  const { data: tickers } = useQuery<MarketDataResponse[]>({ queryKey: ['market-data'], queryFn: getAllMarketData });

  useEffect(() => {
    if (!symbol && markets && markets.length > 0) setSymbol(markets[0].symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, symbol]);

  const market = markets?.find((m) => m.symbol === symbol);
  const ticker = tickers?.find((t) => t.symbol === symbol);
  const baseCurrency  = market?.baseCurrency  ?? '';
  const quoteCurrency = market?.quoteCurrency ?? '';
  const minQty        = market ? parseFloat(market.minQuantity) : 0;
  const lastPrice     = ticker ? parseFloat(ticker.lastPrice) : 0;
  const change24h     = ticker ? parseFloat(ticker.priceChangePercent24h) : 0;

  // ─── Chart data ────────────────────────────────────────────────────────────
  const intervalParam = params.get('interval');
  const interval: Interval = INTERVALS.includes(intervalParam as Interval) ? (intervalParam as Interval) : '15m';
  const setInterval = (iv: Interval) => setParams((p) => { const n = new URLSearchParams(p); n.set('interval', iv); return n; }, { replace: true });
  const candles = useMemo(() => {
    if (!ticker) return [];
    return generateCandles(symbol, lastPrice, change24h, interval, 96);
  }, [symbol, lastPrice, change24h, interval, ticker]);

  // ─── Order book (live via WebSocket) ──────────────────────────────────────
  const { snapshot, trades } = useOrderBookSocket(symbol);

  // ─── User's open orders for THIS symbol — rendered as price lines on chart ─
  const { data: myOrders } = useQuery({
    queryKey: ['my-orders', 0, 50],
    queryFn: () => getMyOrders(0, 50),
    refetchInterval: 5000,
  });
  const orderLines = useMemo<OrderLine[]>(() => {
    if (!myOrders || !symbol) return [];
    return myOrders.content
      .filter((o) => o.symbol === symbol && (o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED') && o.price)
      .map((o) => ({
        id: o.id,
        price: parseFloat(o.price!),
        side: o.side,
        label: `${o.side} ${parseFloat(o.quantity).toString()}`,
      }));
  }, [myOrders, symbol]);

  // ─── Place order form ──────────────────────────────────────────────────────
  const [orderType, setOrderType]     = useState<OrderType>('LIMIT');
  const [side, setSide]               = useState<OrderSide>('BUY');
  const [price, setPrice]             = useState('');
  const [quantity, setQuantity]       = useState('');
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('GTC');
  const [triggerPrice, setTriggerPrice] = useState('');

  // Default price tracks last price when symbol changes
  useEffect(() => {
    if (lastPrice > 0 && orderType === 'LIMIT') {
      setPrice(lastPrice.toFixed(market && parseFloat(market.tickSize) >= 1 ? 0 : 2));
    }
  }, [symbol, lastPrice, orderType, market]);

  const { data: wallets } = useQuery<WalletResponse[]>({ queryKey: ['wallets'], queryFn: getWallets });
  const requiredCurrency = side === 'BUY' ? quoteCurrency : baseCurrency;
  const wallet           = wallets?.find((w) => w.currency === requiredCurrency);
  const available        = wallet ? parseFloat(wallet.availableBalance) : null;

  let requiredAmount: number | null = null;
  if (side === 'BUY' && orderType === 'LIMIT' && price && quantity) {
    requiredAmount = parseFloat(price) * parseFloat(quantity);
  } else if (side === 'SELL' && quantity) {
    requiredAmount = parseFloat(quantity);
  }
  const qtyNum    = parseFloat(quantity || '0');
  const belowMin  = market !== undefined && qtyNum > 0 && qtyNum < minQty;
  const hasEnough = available === null || requiredAmount === null || available >= requiredAmount;

  const mutation = useMutation({
    mutationFn: placeOrder,
    onSuccess: (data) => {
      toast(`Order ${data.id.slice(0, 8)}… placed — ${data.status}`, 'success');
      setQuantity('');
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (err: unknown) => {
      const e = err as { userMessage?: string; response?: { data?: { detail?: string; message?: string } }; message?: string };
      toast(e?.response?.data?.detail ?? e?.userMessage ?? 'Failed to place order', 'error');
    },
  });
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      symbol,
      orderType,
      side,
      price: (orderType === 'LIMIT' || orderType === 'STOP_LIMIT') ? price : undefined,
      quantity,
      timeInForce: orderType === 'LIMIT' ? timeInForce : undefined,
      triggerPrice: orderType === 'STOP_LIMIT' ? triggerPrice : undefined,
    });
  }

  // ─── Order book aggregated levels ──────────────────────────────────────────
  const bids = snapshot?.bids.slice().sort((a, b) => b.price - a.price).slice(0, 12) ?? [];
  const asks = snapshot?.asks.slice().sort((a, b) => a.price - b.price).slice(0, 12) ?? [];
  const maxQty = Math.max(...bids.map(b => b.quantity), ...asks.map(a => a.quantity), 1);
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spread = bestBid > 0 && bestAsk > 0 ? bestAsk - bestBid : null;

  return (
    <div>
      {/* Symbol header bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4 px-4 py-3" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="input-field mono px-2 py-1 text-sm"
          style={{ background: '#0a0e14', border: '1px solid #2a3441', color: '#f5f6f8' }}
        >
          {!markets && <option>…</option>}
          {markets?.map((m) => <option key={m.symbol} value={m.symbol}>{m.symbol}</option>)}
        </select>

        {ticker && (
          <>
            <div>
              <p className="text-[10px]" style={{ color: '#6c7684' }}>Last</p>
              <p className="mono text-lg leading-none" style={{ color: '#f5f6f8' }}>{formatPrice(lastPrice, '$')}</p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: '#6c7684' }}>24h Δ</p>
              <p className="mono text-sm leading-none" style={{ color: change24h >= 0 ? '#00d09c' : '#ff4d5e' }}>
                {formatPercent(change24h)}
              </p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: '#6c7684' }}>24h High</p>
              <p className="mono text-sm leading-none" style={{ color: '#a0a8b4' }}>{formatPrice(ticker.high24h, '$')}</p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: '#6c7684' }}>24h Low</p>
              <p className="mono text-sm leading-none" style={{ color: '#a0a8b4' }}>{formatPrice(ticker.low24h, '$')}</p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: '#6c7684' }}>24h Vol</p>
              <p className="mono text-sm leading-none" style={{ color: '#a0a8b4' }}>
                {formatCompactCurrency(parseFloat(ticker.volume24h) * lastPrice)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Main grid: chart (left, spans 2 cols) + book/form (right column stacked) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2" style={{ background: '#0a0e14', border: '1px solid #2a3441' }}>
          <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom: '1px solid #2a3441' }}>
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className="px-2 py-1 text-xs transition-colors"
                style={{
                  background:  interval === iv ? 'rgba(0,104,255,0.12)' : 'transparent',
                  color:       interval === iv ? '#0068ff' : '#6c7684',
                }}
              >
                {iv}
              </button>
            ))}
          </div>
          {candles.length > 0 ? (
            <CandleChart candles={candles} orderLines={orderLines} height={420} />
          ) : (
            <div className="flex items-center justify-center" style={{ height: 420, color: '#6c7684' }}>Loading chart…</div>
          )}
        </div>

        {/* Right column: order book + form */}
        <div className="space-y-4">
          {/* Order book */}
          <div style={{ background: '#11161d', border: '1px solid #2a3441' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid #2a3441' }}>
              <span className="text-xs" style={{ color: '#6c7684' }}>Order book</span>
              {spread !== null && (
                <span className="mono text-xs" style={{ color: '#a0a8b4' }}>
                  Spread {spread.toFixed(2)}
                </span>
              )}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#0a0e14' }}>
                  <th className="px-2 py-1 text-left" style={{ color: '#6c7684' }}>Price</th>
                  <th className="px-2 py-1 text-right" style={{ color: '#6c7684' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {asks.slice().reverse().map((a) => (
                  <DepthRow key={'a' + a.price} side="SELL" price={a.price} qty={a.quantity} maxQty={maxQty} onClick={() => setPrice(a.price.toString())} />
                ))}
                <tr>
                  <td
                    colSpan={2}
                    className="px-2 py-1 mono text-center cursor-pointer"
                    style={{ background: '#0a0e14', color: '#f5f6f8' }}
                    title="Click to fill price"
                    onClick={() => lastPrice > 0 && setPrice(lastPrice.toString())}
                  >
                    {ticker ? formatPrice(lastPrice, '$') : '—'}
                  </td>
                </tr>
                {bids.map((b) => (
                  <DepthRow key={'b' + b.price} side="BUY" price={b.price} qty={b.quantity} maxQty={maxQty} onClick={() => setPrice(b.price.toString())} />
                ))}
                {asks.length === 0 && bids.length === 0 && (
                  <tr><td colSpan={2} className="px-2 py-6 text-center" style={{ color: '#6c7684' }}>No depth yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Place order form */}
          <div className="p-4" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
            <div className="flex mb-3" style={{ background: '#0a0e14', border: '1px solid #2a3441' }}>
              <button
                type="button"
                onClick={() => setSide('BUY')}
                className="flex-1 py-2 text-xs font-semibold transition-colors"
                style={{ background: side === 'BUY' ? '#00d09c' : 'transparent', color: side === 'BUY' ? '#fff' : '#6c7684' }}
              >Buy</button>
              <button
                type="button"
                onClick={() => setSide('SELL')}
                className="flex-1 py-2 text-xs font-semibold transition-colors"
                style={{ background: side === 'SELL' ? '#ff4d5e' : 'transparent', color: side === 'SELL' ? '#fff' : '#6c7684' }}
              >Sell</button>
            </div>

            <div className="flex mb-3 text-xs" style={{ background: '#0a0e14', border: '1px solid #2a3441' }}>
              {(['LIMIT', 'MARKET', 'STOP_LIMIT'] as OrderType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className="flex-1 py-1.5 transition-colors"
                  style={{
                    background: orderType === t ? 'rgba(0,104,255,0.12)' : 'transparent',
                    color:      orderType === t ? '#0068ff' : '#6c7684',
                  }}
                >{t === 'STOP_LIMIT' ? 'STOP' : t}</button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-2">
              {orderType === 'STOP_LIMIT' && (
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: '#a0a8b4' }}>
                    Trigger price ({quoteCurrency})
                    <span className="ml-1" style={{ color: '#6c7684' }}>
                      — activates when {side === 'BUY' ? '≥' : '≤'} this price
                    </span>
                  </label>
                  <input
                    required
                    type="number"
                    step="0.00000001"
                    value={triggerPrice}
                    onChange={(e) => setTriggerPrice(e.target.value)}
                    className="input-field mono w-full px-2 py-1.5 text-xs"
                    style={{ background: '#0a0e14', border: '1px solid #ffb800', color: '#f5f6f8' }}
                  />
                </div>
              )}
              {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: '#a0a8b4' }}>
                    {orderType === 'STOP_LIMIT' ? 'Limit price' : 'Price'} ({quoteCurrency})
                  </label>
                  <input
                    required
                    type="number"
                    step="0.00000001"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="input-field mono w-full px-2 py-1.5 text-xs"
                    style={{ background: '#0a0e14', border: '1px solid #2a3441', color: '#f5f6f8' }}
                  />
                </div>
              )}
              {orderType === 'LIMIT' && (
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: '#a0a8b4' }}>Time in force</label>
                  <select
                    value={timeInForce}
                    onChange={(e) => setTimeInForce(e.target.value as TimeInForce)}
                    className="mono w-full px-2 py-1.5 text-xs"
                    style={{ background: '#0a0e14', border: '1px solid #2a3441', color: '#f5f6f8' }}
                  >
                    <option value="GTC">GTC — Good till cancelled</option>
                    <option value="IOC">IOC — Immediate or cancel</option>
                    <option value="FOK">FOK — Fill or kill</option>
                    <option value="POST_ONLY">POST_ONLY — Maker only</option>
                  </select>
                </div>
              )}
              <div>
                <label className="flex items-baseline justify-between text-[10px] mb-1" style={{ color: '#a0a8b4' }}>
                  <span>Quantity ({baseCurrency})</span>
                  {market && <span className="mono" style={{ color: '#6c7684' }}>min {parseFloat(market.minQuantity)}</span>}
                </label>
                <input
                  required
                  type="number"
                  step="0.00000001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input-field mono w-full px-2 py-1.5 text-xs"
                  style={{ background: '#0a0e14', border: '1px solid ' + (belowMin ? '#ff4d5e' : '#2a3441'), color: '#f5f6f8' }}
                />
                {available !== null && available > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          // BUY: max base qty = available_quote / price; SELL: just available_base
                          const refPrice = orderType === 'LIMIT' ? parseFloat(price || '0') : lastPrice;
                          let max: number;
                          if (side === 'BUY') {
                            if (!refPrice || refPrice <= 0) return;
                            max = available / refPrice;
                          } else {
                            max = available;
                          }
                          const qty = max * (pct / 100);
                          // Round down to 8 decimals
                          setQuantity((Math.floor(qty * 1e8) / 1e8).toString());
                        }}
                        className="flex-1 py-0.5 text-[10px] transition-colors"
                        style={{ background: '#0a0e14', border: '1px solid #2a3441', color: '#a0a8b4' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#0068ff'; (e.currentTarget as HTMLButtonElement).style.color = '#0068ff'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a3441'; (e.currentTarget as HTMLButtonElement).style.color = '#a0a8b4'; }}
                      >
                        {pct === 100 ? 'Max' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-[10px] pt-1" style={{ color: '#6c7684' }}>
                <span>Available {requiredCurrency}</span>
                <span className="mono" style={{ color: '#a0a8b4' }}>{available !== null ? available.toFixed(6) : '—'}</span>
              </div>
              {requiredAmount !== null && (
                <div className="flex justify-between text-[10px]" style={{ color: '#6c7684' }}>
                  <span>Total</span>
                  <span className="mono" style={{ color: hasEnough ? '#0068ff' : '#ff4d5e' }}>≈ {requiredAmount.toFixed(6)}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={mutation.isPending || !hasEnough || belowMin || !symbol}
                className="w-full py-2 text-xs font-semibold transition-opacity disabled:opacity-40 mt-2"
                style={{ background: side === 'BUY' ? '#00d09c' : '#ff4d5e', color: '#fff' }}
              >
                {mutation.isPending ? 'Placing…' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${baseCurrency || ''}`}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Recent trades — full width below */}
      {trades.length > 0 && (
        <div className="mt-4" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
          <div className="px-3 py-2" style={{ borderBottom: '1px solid #2a3441' }}>
            <span className="text-xs" style={{ color: '#6c7684' }}>Recent trades</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#0a0e14' }}>
                <th className="px-3 py-1 text-left" style={{ color: '#6c7684' }}>Price</th>
                <th className="px-3 py-1 text-right" style={{ color: '#6c7684' }}>Quantity</th>
                <th className="px-3 py-1 text-right" style={{ color: '#6c7684' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 20).map((t, i) => (
                <tr key={t.tradeId} style={{ borderBottom: '1px solid #1a2029', opacity: Math.max(1 - i * 0.025, 0.5) }}>
                  <td className="px-3 py-1 mono" style={{ color: '#00d09c' }}>{t.price.toFixed(2)}</td>
                  <td className="px-3 py-1 mono text-right" style={{ color: '#a0a8b4' }}>{t.quantity.toFixed(6)}</td>
                  <td className="px-3 py-1 text-right" style={{ color: '#6c7684' }}>{new Date(t.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DepthRow({ side, price, qty, maxQty, onClick }: { side: 'BUY' | 'SELL'; price: number; qty: number; maxQty: number; onClick?: () => void }) {
  const color = side === 'BUY' ? '#00d09c' : '#ff4d5e';
  const depthBg = side === 'BUY' ? 'rgba(0,208,156,0.08)' : 'rgba(255,77,94,0.08)';
  const pct = (qty / maxQty) * 100;
  return (
    <tr
      onClick={onClick}
      style={{ borderBottom: '1px solid #1a2029', position: 'relative', cursor: onClick ? 'pointer' : 'default' }}
      title={onClick ? `Click to fill price ${price}` : undefined}
    >
      <td className="px-2 py-1 mono" style={{ color, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`, background: depthBg, pointerEvents: 'none' }} />
        <span style={{ position: 'relative' }}>{price.toFixed(2)}</span>
      </td>
      <td className="px-2 py-1 mono text-right" style={{ color: '#a0a8b4' }}>{qty.toFixed(6)}</td>
    </tr>
  );
}
