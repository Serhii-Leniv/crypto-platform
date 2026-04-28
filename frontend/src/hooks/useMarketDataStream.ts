import { useState, useEffect } from 'react';
import type { MarketDataResponse } from '../types';

export function useMarketDataStream() {
  const [data, setData] = useState<MarketDataResponse[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/v1/stream/market-data');

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data) as MarketDataResponse;
        setData(prev => {
          const idx = prev.findIndex(m => m.symbol === update.symbol);
          if (idx === -1) return [...prev, update];
          const next = [...prev];
          next[idx] = update;
          return next;
        });
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  return { data, connected };
}
