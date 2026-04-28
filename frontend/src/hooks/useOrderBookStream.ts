import { useState, useEffect } from 'react';
import type { OrderResponse } from '../types';

interface OrderBookState {
  buyOrders: OrderResponse[];
  sellOrders: OrderResponse[];
}

export function useOrderBookStream(symbol: string) {
  const [orderBook, setOrderBook] = useState<OrderBookState>({ buyOrders: [], sellOrders: [] });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!symbol) return;

    const encodedSymbol = encodeURIComponent(symbol);
    const es = new EventSource(`/api/v1/stream/order-book/${encodedSymbol}`);

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const snapshot = JSON.parse(e.data) as OrderBookState;
        setOrderBook(snapshot);
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
  }, [symbol]);

  return { ...orderBook, connected };
}
