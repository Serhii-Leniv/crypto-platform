import { apiClient } from './client';
import type { Market } from './markets';
import type { OrderResponse, PageResponse } from '../types';

export interface AdminUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const res = await apiClient.get('/api/v1/admin/users');
  return res.data;
}

export async function getAllOrders(page = 0, size = 50): Promise<PageResponse<OrderResponse>> {
  const res = await apiClient.get('/api/v1/admin/orders', { params: { page, size } });
  return res.data;
}

export async function getAllMarkets(): Promise<Market[]> {
  const res = await apiClient.get('/api/v1/admin/markets');
  return res.data;
}

export async function setMarketStatus(symbol: string, status: 'ACTIVE' | 'HALTED' | 'DELISTED'): Promise<Market> {
  const res = await apiClient.put(`/api/v1/admin/markets/${symbol}/status`, { status });
  return res.data;
}
