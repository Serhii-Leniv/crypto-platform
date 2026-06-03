/**
 * Deterministic synthetic OHLCV candle generator.
 *
 * The backend doesn't (yet) store price history, so the chart on Trade view
 * uses this to produce a stable random walk seeded by symbol + anchored to
 * the current last price. Once a `/api/v1/market-data/candles/{symbol}` endpoint
 * exists, swap this for a real fetch — same return shape works with lightweight-charts.
 */

export interface Candle {
  time: number;  // unix seconds (UTCTimestamp)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVAL_SECONDS: Record<string, number> = {
  '1m':  60,
  '5m':  60 * 5,
  '15m': 60 * 15,
  '1h':  60 * 60,
  '4h':  60 * 60 * 4,
  '1d':  60 * 60 * 24,
};

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSymbol(symbol: string, interval: string): number {
  let h = 2166136261;
  const s = symbol + ':' + interval;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Generates `count` OHLCV candles ending at `now` so the last close == currentPrice.
 * Drift target: 24h % change interpreted across the visible range.
 */
export function generateCandles(
  symbol: string,
  currentPrice: number,
  priceChangePercent24h: number,
  interval: string = '15m',
  count: number = 96,
): Candle[] {
  const sec = INTERVAL_SECONDS[interval] ?? 900;
  const rand = seededRand(hashSymbol(symbol, interval));
  const now = Math.floor(Date.now() / 1000);
  const alignedNow = Math.floor(now / sec) * sec;

  // Start price implied by the 24h change. We don't try to match historical
  // accuracy — just feel right: prices drift toward currentPrice across `count` bars.
  const startPrice = currentPrice / (1 + priceChangePercent24h / 100);
  const drift = (currentPrice - startPrice) / (count - 1);
  const vol = currentPrice * 0.006;  // ~0.6% per-bar noise

  let prevClose = startPrice;
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const time = alignedNow - (count - 1 - i) * sec;
    const open = prevClose;
    const target = startPrice + drift * i;
    const close = target + (rand() - 0.5) * vol * 2;
    const wickLow  = Math.min(open, close) - rand() * vol;
    const wickHigh = Math.max(open, close) + rand() * vol;
    const volume = (0.6 + rand() * 0.8) * (currentPrice > 100 ? 50 : 5000);
    candles.push({
      time,
      open: round8(open),
      high: round8(wickHigh),
      low:  round8(wickLow),
      close: round8(close),
      volume: round8(volume),
    });
    prevClose = close;
  }
  // Anchor the final close to the actual current price so the chart matches the ticker.
  const last = candles[candles.length - 1];
  last.close = round8(currentPrice);
  last.high = Math.max(last.high, last.close);
  last.low = Math.min(last.low, last.close);
  return candles;
}

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}
