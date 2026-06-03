/**
 * Inline SVG sparkline. Takes an array of numbers and draws a thin line chart.
 * Color shifts based on first-to-last direction (green up, red down).
 *
 * For markets without real history, callers can use the `syntheticSparkline`
 * helper below to generate a deterministic random walk seeded by symbol +
 * anchored to the current price.
 */

interface Props {
  data: number[];
  width?: number;
  height?: number;
  /** Override auto-derived color. */
  color?: string;
  /** Show subtle fill under the line. Default true. */
  filled?: boolean;
}

export default function Sparkline({ data, width = 80, height = 24, color, filled = true }: Props) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const lineColor = color ?? (data[data.length - 1] >= data[0] ? '#00d09c' : '#ff4d5e');
  const fillPath = `${path} L${width} ${height} L0 ${height} Z`;
  const fillOpacity = lineColor === '#00d09c' ? 0.12 : 0.12;

  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block' }}>
      {filled && <path d={fillPath} fill={lineColor} fillOpacity={fillOpacity} />}
      <path d={path} fill="none" stroke={lineColor} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Generates a deterministic random-walk array for a sparkline preview.
 * Seeded by `symbol` so each pair has a stable visual until backend candles arrive.
 * The walk drifts so that the implied 24h % change matches `priceChangePercent`.
 */
export function syntheticSparkline(symbol: string, currentPrice: number, priceChangePercent: number, points = 30): number[] {
  // FNV-1a hash for a 32-bit deterministic seed from symbol
  let seed = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    seed ^= symbol.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  // Mulberry32 PRNG
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const startPrice = currentPrice / (1 + priceChangePercent / 100);
  const drift = (currentPrice - startPrice) / (points - 1);
  const volatility = currentPrice * 0.005; // ~0.5% per step jitter

  const out: number[] = [];
  let v = startPrice;
  for (let i = 0; i < points; i++) {
    out.push(v);
    v += drift + (rand() - 0.5) * volatility;
  }
  // Force last point to exactly currentPrice for visual consistency
  out[out.length - 1] = currentPrice;
  return out;
}
