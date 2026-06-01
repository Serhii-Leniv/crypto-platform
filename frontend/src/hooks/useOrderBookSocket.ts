import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { WsOrderBookSnapshot, WsTradeEvent } from '../types';

const MAX_TRADES = 20;

export function useOrderBookSocket(symbol: string) {
  const [snapshot, setSnapshot] = useState<WsOrderBookSnapshot | null>(null);
  const [trades, setTrades] = useState<WsTradeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const obClientRef = useRef<Client | null>(null);
  const tradeClientRef = useRef<Client | null>(null);

  useEffect(() => {
    const symbolPath = symbol.replace(/\//g, '-');

    // Order book — order-matching service (/ws/orderbook via gateway)
    const obClient = new Client({
      webSocketFactory: () => new SockJS(`${window.location.origin}/ws/orderbook`),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        obClient.subscribe(`/topic/orderbook/${symbolPath}`, (msg) => {
          setSnapshot(JSON.parse(msg.body));
        });
      },
      onDisconnect: () => setConnected(false),
    });

    // Trades — market-data service (/ws/market-data via gateway)
    const tradeClient = new Client({
      webSocketFactory: () => new SockJS(`${window.location.origin}/ws/market-data`),
      reconnectDelay: 5000,
      onConnect: () => {
        tradeClient.subscribe(`/topic/trades/${symbolPath}`, (msg) => {
          const trade: WsTradeEvent = JSON.parse(msg.body);
          setTrades((prev) => [trade, ...prev].slice(0, MAX_TRADES));
        });
      },
    });

    obClient.activate();
    tradeClient.activate();
    obClientRef.current = obClient;
    tradeClientRef.current = tradeClient;

    return () => {
      obClient.deactivate();
      tradeClient.deactivate();
      obClientRef.current = null;
      tradeClientRef.current = null;
      setSnapshot(null);
      setTrades([]);
      setConnected(false);
    };
  }, [symbol]);

  return { snapshot, trades, connected };
}
