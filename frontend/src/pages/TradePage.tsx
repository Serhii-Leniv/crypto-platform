import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMarkets, type Market } from '../api/markets';
import { getAllMarketData } from '../api/market';
import { placeOrder, getMyOrders, cancelOrder } from '../api/orders';
import { getWallets } from '../api/wallets';
import { useOrderBookSocket } from '../hooks/useOrderBookSocket';
import { useToast } from '../context/ToastContext';
import CandleChart, { type OrderLine } from '../components/CandleChart';
import { generateCandles } from '../lib/candles';
import { formatPrice, formatPercent, formatCompactCurrency } from '../lib/format';
import type { OrderSide, OrderType, TimeInForce, WalletResponse, MarketDataResponse, OrderResponse } from '../types';

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type Interval = typeof INTERVALS[number];

const C = {
  bg:       '#0a0e14',
  panel:    '#11161d',
  border:   '#2a3441',
  borderSoft: '#1a2029',
  text:     '#f5f6f8',
  textDim:  '#a0a8b4',
  textMute: '#6c7684',
  buy:      '#00d09c',
  sell:     '#ff4d5e',
  accent:   '#0068ff',
  warn:     '#ffb800',
} as const;

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
  const change24hAbs  = ticker ? parseFloat(ticker.priceChange24h) : 0;

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

  // ─── User's open orders for THIS symbol ───────────────────────────────────
  const { data: myOrders } = useQuery({
    queryKey: ['my-orders', 0, 50],
    queryFn: () => getMyOrders(0, 50),
    refetchInterval: 5000,
  });
  const openOrders: OrderResponse[] = useMemo(() => {
    if (!myOrders) return [];
    return myOrders.content.filter((o) =>
      o.symbol === symbol &&
      (o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED' || o.status === 'TRIGGER_PENDING'));
  }, [myOrders, symbol]);

  const orderLines = useMemo<OrderLine[]>(() => {
    return openOrders
      .filter((o) => !!o.price)
      .map((o) => ({
        id: o.id,
        price: parseFloat(o.price!),
        side: o.side,
        label: `${o.side} ${parseFloat(o.quantity).toString()}`,
      }));
  }, [openOrders]);

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

  const placeMutation = useMutation({
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
    placeMutation.mutate({
      symbol,
      orderType,
      side,
      price: (orderType === 'LIMIT' || orderType === 'STOP_LIMIT') ? price : undefined,
      quantity,
      timeInForce: orderType === 'LIMIT' ? timeInForce : undefined,
      triggerPrice: orderType === 'STOP_LIMIT' ? triggerPrice : undefined,
    });
  }

  const cancelMutation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      toast('Order cancelled', 'success');
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: () => toast('Failed to cancel order', 'error'),
  });

  // ─── Order book aggregated levels + cumulative ─────────────────────────────
  const BOOK_DEPTH = 14;
  const bids = (snapshot?.bids.slice().sort((a, b) => b.price - a.price).slice(0, BOOK_DEPTH) ?? []);
  const asks = (snapshot?.asks.slice().sort((a, b) => a.price - b.price).slice(0, BOOK_DEPTH) ?? []);
  const bidsWithTotal = useMemo(() => {
    let acc = 0;
    return bids.map((b) => { acc += b.quantity; return { ...b, total: acc }; });
  }, [bids]);
  const asksWithTotal = useMemo(() => {
    let acc = 0;
    return asks.map((a) => { acc += a.quantity; return { ...a, total: acc }; });
  }, [asks]);
  const maxBookTotal = Math.max(
    bidsWithTotal.at(-1)?.total ?? 0,
    asksWithTotal.at(-1)?.total ?? 0,
    1,
  );
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spreadAbs = bestBid > 0 && bestAsk > 0 ? bestAsk - bestBid : null;
  const spreadBp  = spreadAbs !== null && bestBid > 0 ? (spreadAbs / bestBid) * 10000 : null;

  // ─── Recent trades with tick direction colouring ──────────────────────────
  const tradesWithDir = useMemo(() => {
    return trades.slice(0, 30).map((t, i, arr) => {
      const prev = arr[i + 1];
      const dir: 'up' | 'down' | 'flat' = prev
        ? (t.price > prev.price ? 'up' : t.price < prev.price ? 'down' : 'flat')
        : 'flat';
      return { ...t, dir };
    });
  }, [trades]);

  // ─── Bottom tabs (Open orders / Trades) ────────────────────────────────────
  const [bottomTab, setBottomTab] = useState<'open' | 'trades'>('open');

  // ─── Quote price ref (for compact USD on right column) ─────────────────────
  const symbolPriceLabel = ticker ? formatPrice(lastPrice, '$') : '—';
  const symbolBaseLabel  = market?.baseCurrency ?? '';

  return (
    <div className="h-full flex flex-col gap-3">
      {/* ───────────── Symbol header ───────────── */}
      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 flex-shrink-0"
        style={{ background: C.panel, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-3">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="mono px-2 py-1.5 text-sm font-semibold"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
          >
            {!markets && <option>…</option>}
            {markets?.map((m) => {
              const t = tickers?.find((tt) => tt.symbol === m.symbol);
              const chg = t ? parseFloat(t.priceChangePercent24h) : 0;
              return (
                <option key={m.symbol} value={m.symbol}>
                  {m.symbol}   {t ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : ''}
                </option>
              );
            })}
          </select>
          {ticker && (
            <div className="flex flex-col leading-tight">
              <span className="mono text-2xl font-semibold" style={{ color: change24h >= 0 ? C.buy : C.sell }}>
                {formatPrice(lastPrice, '$')}
              </span>
              <span className="mono text-[11px]" style={{ color: change24h >= 0 ? C.buy : C.sell }}>
                {change24hAbs >= 0 ? '+' : ''}{formatPrice(change24hAbs, '')} ({formatPercent(change24h)})
              </span>
            </div>
          )}
        </div>

        {ticker && (
          <div className="flex items-center gap-x-6 gap-y-2 flex-wrap">
            <Stat label="24h High" value={formatPrice(ticker.high24h, '$')} />
            <Stat label="24h Low"  value={formatPrice(ticker.low24h, '$')} />
            <Stat label={`24h Volume (${baseCurrency})`} value={formatCompactCurrency(parseFloat(ticker.volume24h))} />
            <Stat label="24h Volume ($)" value={formatCompactCurrency(parseFloat(ticker.volume24h) * lastPrice)} />
            <Stat label="Trades 24h" value={(ticker.tradeCount24h ?? 0).toString()} />
          </div>
        )}
      </div>

      {/* ───────────── Main grid: fills remaining vertical space ───────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 min-h-0">
        {/* ─── LEFT: chart on top, bottom tabs (open orders / trades) below ─── */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Chart card */}
          <div className="flex-1 min-h-0 flex flex-col" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-1 px-3 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
              {INTERVALS.map((iv) => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className="px-2.5 py-1 text-xs mono transition-colors"
                  style={{
                    background: interval === iv ? 'rgba(0,104,255,0.12)' : 'transparent',
                    color:      interval === iv ? C.accent : C.textMute,
                  }}
                >
                  {iv}
                </button>
              ))}
              <div className="ml-auto text-[10px] mono" style={{ color: C.textMute }}>
                {symbol} · {interval}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {candles.length > 0
                ? <CandleChart candles={candles} orderLines={orderLines} />
                : <div className="h-full flex items-center justify-center" style={{ color: C.textMute }}>Loading chart…</div>
              }
            </div>
          </div>

          {/* Bottom tabbed panel: Open orders / Recent trades */}
          <div
            className="flex-shrink-0 flex flex-col"
            style={{ background: C.panel, border: `1px solid ${C.border}`, height: 220 }}
          >
            <div className="flex items-center px-3 flex-shrink-0" style={{ borderBottom: `1px solid ${C.border}`, height: 36 }}>
              <TabBtn active={bottomTab === 'open'}   onClick={() => setBottomTab('open')}>
                Open orders <span className="ml-1 mono text-[10px]" style={{ color: C.textMute }}>({openOrders.length})</span>
              </TabBtn>
              <TabBtn active={bottomTab === 'trades'} onClick={() => setBottomTab('trades')}>
                Recent trades
              </TabBtn>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {bottomTab === 'open' ? (
                openOrders.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs" style={{ color: C.textMute }}>
                    No open orders for {symbol || 'this symbol'}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ background: C.panel }}>
                      <tr style={{ color: C.textMute }}>
                        <th className="text-left  px-3 py-1.5 font-normal">Time</th>
                        <th className="text-left  px-2 py-1.5 font-normal">Side</th>
                        <th className="text-left  px-2 py-1.5 font-normal">Type</th>
                        <th className="text-right px-2 py-1.5 font-normal">Price</th>
                        <th className="text-right px-2 py-1.5 font-normal">Amount</th>
                        <th className="text-right px-2 py-1.5 font-normal">Filled</th>
                        <th className="text-right px-3 py-1.5 font-normal">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openOrders.map((o) => {
                        const filled = parseFloat(o.filledQuantity);
                        const total  = parseFloat(o.quantity);
                        const pct    = total > 0 ? (filled / total) * 100 : 0;
                        const sideColor = o.side === 'BUY' ? C.buy : C.sell;
                        return (
                          <tr key={o.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                            <td className="px-3 py-1.5 mono" style={{ color: C.textMute }}>
                              {o.createdAt ? new Date(o.createdAt).toLocaleTimeString() : '—'}
                            </td>
                            <td className="px-2 py-1.5 mono font-semibold" style={{ color: sideColor }}>{o.side}</td>
                            <td className="px-2 py-1.5 mono" style={{ color: C.textDim }}>
                              {o.orderType === 'STOP_LIMIT' ? 'STOP' : o.orderType}
                              {o.timeInForce && o.timeInForce !== 'GTC' && (
                                <span className="ml-1" style={{ color: C.textMute }}>·{o.timeInForce}</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 mono text-right" style={{ color: C.text }}>
                              {o.price ? parseFloat(o.price).toLocaleString() : 'Market'}
                            </td>
                            <td className="px-2 py-1.5 mono text-right" style={{ color: C.textDim }}>{total}</td>
                            <td className="px-2 py-1.5 mono text-right" style={{ color: C.textDim }}>
                              {filled}
                              <span className="ml-1 text-[10px]" style={{ color: C.textMute }}>
                                ({pct.toFixed(0)}%)
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <button
                                onClick={() => cancelMutation.mutate(o.id)}
                                disabled={cancelMutation.isPending}
                                className="text-[10px] mono px-2 py-0.5 transition-colors disabled:opacity-50"
                                style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.sell; (e.currentTarget as HTMLButtonElement).style.borderColor = C.sell; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.textDim;  (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; }}
                              >
                                Cancel
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              ) : (
                tradesWithDir.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs" style={{ color: C.textMute }}>
                    No trades yet
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ background: C.panel }}>
                      <tr style={{ color: C.textMute }}>
                        <th className="text-left  px-3 py-1.5 font-normal">Time</th>
                        <th className="text-right px-2 py-1.5 font-normal">Price ({quoteCurrency})</th>
                        <th className="text-right px-2 py-1.5 font-normal">Amount ({baseCurrency})</th>
                        <th className="text-right px-3 py-1.5 font-normal">Total ({quoteCurrency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradesWithDir.map((t) => {
                        const c = t.dir === 'up' ? C.buy : t.dir === 'down' ? C.sell : C.textDim;
                        return (
                          <tr key={t.tradeId} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                            <td className="px-3 py-1.5 mono" style={{ color: C.textMute }}>
                              {new Date(t.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-2 py-1.5 mono text-right" style={{ color: c }}>
                              {t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-1.5 mono text-right" style={{ color: C.textDim }}>{t.quantity.toFixed(6)}</td>
                            <td className="px-3 py-1.5 mono text-right" style={{ color: C.textDim }}>
                              {(t.price * t.quantity).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>

        {/* ─── RIGHT: order book (top) + order form (bottom) ─── */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Order book */}
          <div
            className="flex-1 min-h-0 flex flex-col"
            style={{ background: C.panel, border: `1px solid ${C.border}` }}
          >
            <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
              <span className="text-xs font-semibold" style={{ color: C.textDim }}>Order book</span>
              <div className="flex items-center gap-2 text-[10px] mono" style={{ color: C.textMute }}>
                {spreadAbs !== null && (
                  <>
                    <span>{spreadAbs.toFixed(2)}</span>
                    <span>·</span>
                    <span>{spreadBp?.toFixed(1)} bp</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-1 text-[10px] flex-shrink-0" style={{ color: C.textMute }}>
              <span>Price ({quoteCurrency})</span>
              <span>Amount ({baseCurrency})</span>
              <span>Total</span>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              {/* Asks (descending so best ask is closest to mid price) */}
              <div className="flex-1 overflow-y-auto" style={{ flexBasis: 0 }}>
                {asksWithTotal.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[11px]" style={{ color: C.textMute }}>
                    No asks
                  </div>
                ) : (
                  asksWithTotal.slice().reverse().map((a) => (
                    <DepthRow
                      key={'a' + a.price}
                      side="SELL"
                      price={a.price}
                      qty={a.quantity}
                      total={a.total}
                      maxTotal={maxBookTotal}
                      onClick={() => setPrice(a.price.toString())}
                    />
                  ))
                )}
              </div>

              {/* Mid price marker */}
              <div
                className="flex items-center justify-between px-3 py-1.5 cursor-pointer flex-shrink-0"
                style={{ background: C.bg, borderTop: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}` }}
                title="Click to fill price"
                onClick={() => lastPrice > 0 && setPrice(lastPrice.toString())}
              >
                <span className="mono text-sm font-semibold" style={{ color: change24h >= 0 ? C.buy : C.sell }}>
                  {ticker ? formatPrice(lastPrice, '$') : '—'}
                </span>
                <span className="text-[10px] mono" style={{ color: C.textMute }}>
                  ≈ {symbolPriceLabel}{symbolBaseLabel ? ` / ${symbolBaseLabel}` : ''}
                </span>
              </div>

              {/* Bids (descending — best bid at top) */}
              <div className="flex-1 overflow-y-auto" style={{ flexBasis: 0 }}>
                {bidsWithTotal.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[11px]" style={{ color: C.textMute }}>
                    No bids
                  </div>
                ) : (
                  bidsWithTotal.map((b) => (
                    <DepthRow
                      key={'b' + b.price}
                      side="BUY"
                      price={b.price}
                      qty={b.quantity}
                      total={b.total}
                      maxTotal={maxBookTotal}
                      onClick={() => setPrice(b.price.toString())}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Order form */}
          <div className="p-3 flex-shrink-0" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            {/* Side */}
            <div className="flex mb-2.5" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
              <button
                type="button"
                onClick={() => setSide('BUY')}
                className="flex-1 py-2 text-xs font-semibold transition-colors"
                style={{ background: side === 'BUY' ? C.buy : 'transparent', color: side === 'BUY' ? '#fff' : C.textMute }}
              >Buy</button>
              <button
                type="button"
                onClick={() => setSide('SELL')}
                className="flex-1 py-2 text-xs font-semibold transition-colors"
                style={{ background: side === 'SELL' ? C.sell : 'transparent', color: side === 'SELL' ? '#fff' : C.textMute }}
              >Sell</button>
            </div>

            {/* Type */}
            <div className="flex mb-2.5 text-xs" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
              {(['LIMIT', 'MARKET', 'STOP_LIMIT'] as OrderType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className="flex-1 py-1.5 transition-colors"
                  style={{
                    background: orderType === t ? 'rgba(0,104,255,0.12)' : 'transparent',
                    color:      orderType === t ? C.accent : C.textMute,
                  }}
                >{t === 'STOP_LIMIT' ? 'STOP' : t}</button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-2">
              {orderType === 'STOP_LIMIT' && (
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: C.textDim }}>
                    Trigger price ({quoteCurrency})
                    <span className="ml-1" style={{ color: C.textMute }}>
                      — activates when {side === 'BUY' ? '≥' : '≤'} this price
                    </span>
                  </label>
                  <input
                    required
                    type="number"
                    step="0.00000001"
                    value={triggerPrice}
                    onChange={(e) => setTriggerPrice(e.target.value)}
                    className="mono w-full px-2 py-1.5 text-xs"
                    style={{ background: C.bg, border: `1px solid ${C.warn}`, color: C.text }}
                  />
                </div>
              )}
              {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: C.textDim }}>
                    {orderType === 'STOP_LIMIT' ? 'Limit price' : 'Price'} ({quoteCurrency})
                  </label>
                  <input
                    required
                    type="number"
                    step="0.00000001"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mono w-full px-2 py-1.5 text-xs"
                    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                  />
                </div>
              )}
              {orderType === 'LIMIT' && (
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: C.textDim }}>Time in force</label>
                  <select
                    value={timeInForce}
                    onChange={(e) => setTimeInForce(e.target.value as TimeInForce)}
                    className="mono w-full px-2 py-1.5 text-xs"
                    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                  >
                    <option value="GTC">GTC — Good till cancelled</option>
                    <option value="IOC">IOC — Immediate or cancel</option>
                    <option value="FOK">FOK — Fill or kill</option>
                    <option value="POST_ONLY">POST_ONLY — Maker only</option>
                  </select>
                </div>
              )}
              <div>
                <label className="flex items-baseline justify-between text-[10px] mb-1" style={{ color: C.textDim }}>
                  <span>Quantity ({baseCurrency})</span>
                  {market && <span className="mono" style={{ color: C.textMute }}>min {parseFloat(market.minQuantity)}</span>}
                </label>
                <input
                  required
                  type="number"
                  step="0.00000001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mono w-full px-2 py-1.5 text-xs"
                  style={{ background: C.bg, border: `1px solid ${belowMin ? C.sell : C.border}`, color: C.text }}
                />
                {available !== null && available > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const refPrice = orderType === 'LIMIT' ? parseFloat(price || '0') : lastPrice;
                          let max: number;
                          if (side === 'BUY') {
                            if (!refPrice || refPrice <= 0) return;
                            max = available / refPrice;
                          } else {
                            max = available;
                          }
                          const qty = max * (pct / 100);
                          setQuantity((Math.floor(qty * 1e8) / 1e8).toString());
                        }}
                        className="flex-1 py-0.5 text-[10px] mono transition-colors"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.textDim }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent; (e.currentTarget as HTMLButtonElement).style.color = C.accent; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.textDim; }}
                      >
                        {pct === 100 ? 'Max' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-[10px] pt-1" style={{ color: C.textMute }}>
                <span>Available {requiredCurrency}</span>
                <span className="mono" style={{ color: C.textDim }}>{available !== null ? available.toFixed(6) : '—'}</span>
              </div>
              {requiredAmount !== null && (
                <div className="flex justify-between text-[10px]" style={{ color: C.textMute }}>
                  <span>Total</span>
                  <span className="mono" style={{ color: hasEnough ? C.accent : C.sell }}>
                    ≈ {requiredAmount.toFixed(6)} {requiredCurrency}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={placeMutation.isPending || !hasEnough || belowMin || !symbol}
                className="w-full py-2 text-xs font-semibold transition-opacity disabled:opacity-40 mt-2"
                style={{ background: side === 'BUY' ? C.buy : C.sell, color: '#fff' }}
              >
                {placeMutation.isPending ? 'Placing…' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${baseCurrency || ''}`}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px]" style={{ color: C.textMute }}>{label}</span>
      <span className="mono text-xs" style={{ color: C.textDim }}>{value}</span>
    </div>
  );
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{
        color: active ? C.text : C.textMute,
        borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}

function DepthRow({
  side, price, qty, total, maxTotal, onClick,
}: {
  side: 'BUY' | 'SELL'; price: number; qty: number; total: number; maxTotal: number; onClick?: () => void;
}) {
  const color   = side === 'BUY' ? C.buy : C.sell;
  const depthBg = side === 'BUY' ? 'rgba(0,208,156,0.10)' : 'rgba(255,77,94,0.10)';
  const pct = Math.min((total / maxTotal) * 100, 100);
  return (
    <div
      onClick={onClick}
      className="grid grid-cols-3 items-center text-[11px] px-3 mono relative cursor-pointer"
      style={{ height: 22, borderBottom: `1px solid ${C.borderSoft}` }}
      title={onClick ? `Click to fill price ${price}` : undefined}
    >
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${pct}%`, background: depthBg, pointerEvents: 'none' }} />
      <span style={{ color, position: 'relative' }}>{price.toFixed(2)}</span>
      <span style={{ color: C.textDim, position: 'relative', textAlign: 'right' }}>{qty.toFixed(6)}</span>
      <span style={{ color: C.textMute, position: 'relative', textAlign: 'right' }}>{total.toFixed(4)}</span>
    </div>
  );
}
