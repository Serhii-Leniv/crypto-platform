import { apiClient } from './client';

export interface Market {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  minQuantity: string;
  tickSize: string;
  status: string;
}

export async function getMarkets(): Promise<Market[]> {
  const res = await apiClient.get('/api/v1/markets');
  return res.data;
}
