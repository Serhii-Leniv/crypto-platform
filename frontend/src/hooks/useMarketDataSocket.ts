import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { WsMarketDataMessage } from '../types';

export function useMarketDataSocket(symbols: string[]) {
  const [updates, setUpdates] = useState<Map<string, WsMarketDataMessage>>(new Map());
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const subsRef = useRef<Map<string, { unsubscribe(): void }>>(new Map());

  // Create STOMP client once; keep alive across symbol changes
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(`${window.location.origin}/ws/market-data`),
      reconnectDelay: 5000,
      onConnect: () => setConnected(true),
      onDisconnect: () => {
        setConnected(false);
        subsRef.current.clear();
      },
    });
    client.activate();
    clientRef.current = client;
    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, []);

  // Re-subscribe whenever the connected state or symbol list changes
  const symbolsKey = symbols.join(',');
  useEffect(() => {
    if (!connected || !clientRef.current) return;
    const client = clientRef.current;
    const symbolSet = new Set(symbols);

    for (const symbol of symbols) {
      if (subsRef.current.has(symbol)) continue;
      const topic = `/topic/market-data/${symbol.replace(/\//g, '-')}`;
      const sub = client.subscribe(topic, (msg) => {
        const data: WsMarketDataMessage = JSON.parse(msg.body);
        setUpdates((prev) => new Map(prev).set(symbol, data));
      });
      subsRef.current.set(symbol, sub);
    }

    for (const [symbol, sub] of subsRef.current) {
      if (!symbolSet.has(symbol)) {
        sub.unsubscribe();
        subsRef.current.delete(symbol);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, symbolsKey]);

  return { updates, connected };
}
