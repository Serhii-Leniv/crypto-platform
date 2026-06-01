import { apiClient } from './client';
import type { OrderResponse, OrderBookResponse, PlaceOrderRequest, PageResponse } from '../types';

export async function placeOrder(req: PlaceOrderRequest): Promise<OrderResponse> {
  const res = await apiClient.post('/api/v1/orders', req);
  return res.data;
}

export async function getMyOrders(page = 0, size = 20): Promise<PageResponse<OrderResponse>> {
  const res = await apiClient.get('/api/v1/orders', { params: { page, size } });
  return res.data;
}

export async function getOrderById(orderId: string): Promise<OrderResponse> {
  const res = await apiClient.get(`/api/v1/orders/${orderId}`);
  return res.data;
}

export async function cancelOrder(orderId: string): Promise<void> {
  await apiClient.delete(`/api/v1/orders/${orderId}`);
}

export async function getOrderBook(symbol: string): Promise<OrderBookResponse> {
  const res = await apiClient.get(`/api/v1/orders/book/${symbol}`);
  return res.data;
}
