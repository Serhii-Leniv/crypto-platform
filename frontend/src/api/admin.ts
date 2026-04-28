import { apiClient } from './client';
import type {
  UserAdminResponse,
  UserRole,
  WalletResponse,
  TransactionResponse,
  OrderResponse,
  AdminDepositRequest,
} from '../types';

export const adminGetUsers = () =>
  apiClient.get<UserAdminResponse[]>('/api/v1/admin/users').then(r => r.data);

export const adminSetRole = (id: string, role: UserRole) =>
  apiClient.patch<UserAdminResponse>(`/api/v1/admin/users/${id}/role`, { role }).then(r => r.data);

export const adminGetWallets = (userId?: string) =>
  apiClient.get<WalletResponse[]>('/api/v1/admin/wallets', { params: userId ? { userId } : {} }).then(r => r.data);

export const adminGetTransactions = (filters?: { type?: string; status?: string; currency?: string }) =>
  apiClient.get<TransactionResponse[]>('/api/v1/admin/transactions', { params: filters }).then(r => r.data);

export const adminDeposit = (body: AdminDepositRequest) =>
  apiClient.post('/api/v1/admin/wallets/deposit', body);

export const adminGetOrders = (filters?: { status?: string; symbol?: string; side?: string; userId?: string }) =>
  apiClient.get<OrderResponse[]>('/api/v1/admin/orders', { params: filters }).then(r => r.data);

export const adminCancelOrder = (id: string) =>
  apiClient.delete(`/api/v1/admin/orders/${id}`);
