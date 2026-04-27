import { apiClient } from './client';
import type { MarketDataResponse } from '../types';

export async function getAllMarketData(): Promise<MarketDataResponse[]> {
  const res = await apiClient.get('/api/v1/market-data');
  return res.data;
}

export async function getMarketData(symbol: string): Promise<MarketDataResponse> {
  const res = await apiClient.get(`/api/v1/market-data/${symbol}`);
  return res.data;
}
