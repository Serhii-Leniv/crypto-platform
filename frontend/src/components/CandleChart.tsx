import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type Time,
} from 'lightweight-charts';
import type { Candle } from '../lib/candles';

export interface OrderLine {
  /** Stable id (use order id) so we can diff add/remove between renders. */
  id: string;
  price: number;
  side: 'BUY' | 'SELL';
  /** Optional label shown on the axis. */
  label?: string;
}

interface Props {
  candles: Candle[];
  /** Optional fixed height; if omitted the chart fills its container via ResizeObserver. */
  height?: number;
  /** User's open orders for the current symbol; rendered as horizontal price lines. */
  orderLines?: OrderLine[];
}

/**
 * Bloomberg-style dark candlestick chart with volume sub-pane.
 * Uses TradingView's lightweight-charts library (~40KB, Apache 2.0).
 */
export default function CandleChart({ candles, height, orderLines = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef   = useRef<Map<string, IPriceLine>>(new Map());

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0a0e14' },
        textColor: '#a0a8b4',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1a2029' },
        horzLines: { color: '#1a2029' },
      },
      crosshair: {
        mode: 1,
        vertLine:  { color: '#3a4654', width: 1, style: 3 },
        horzLine:  { color: '#3a4654', width: 1, style: 3 },
      },
      rightPriceScale: { borderColor: '#2a3441' },
      timeScale: {
        borderColor: '#2a3441',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: height ?? containerRef.current.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:        '#00d09c',
      downColor:      '#ff4d5e',
      borderUpColor:  '#00d09c',
      borderDownColor:'#ff4d5e',
      wickUpColor:    '#00d09c',
      wickDownColor:  '#ff4d5e',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#2a3441',
      priceFormat: { type: 'volume' },
      priceScaleId: '',  // overlay, own scale
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Observe both window resize AND parent container size changes so the chart
    // resizes when its flex parent grows/shrinks (e.g., viewport-fill layouts).
    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: height ?? containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', resize);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height]);

  // Push data on every candles change
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    const candleData = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const volumeData = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(0,208,156,0.35)' : 'rgba(255,77,94,0.35)',
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Sync user's open orders as horizontal price lines (add new, remove gone).
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    const nextIds = new Set(orderLines.map((o) => o.id));

    // Remove lines that disappeared
    for (const [id, line] of priceLinesRef.current) {
      if (!nextIds.has(id)) {
        series.removePriceLine(line);
        priceLinesRef.current.delete(id);
      }
    }
    // Add new lines, refresh existing (cheap to just replace if price/side changed)
    for (const o of orderLines) {
      const existing = priceLinesRef.current.get(o.id);
      if (existing) series.removePriceLine(existing);
      const color = o.side === 'BUY' ? '#00d09c' : '#ff4d5e';
      const newLine = series.createPriceLine({
        price: o.price,
        color,
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: o.label ?? o.side,
      });
      priceLinesRef.current.set(o.id, newLine);
    }
  }, [orderLines]);

  return <div ref={containerRef} style={{ width: '100%', height: height ?? '100%' }} />;
}
