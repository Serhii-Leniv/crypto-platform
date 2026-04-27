import { apiClient } from './client';
import type { WalletResponse, TransactionResponse, FundsRequest } from '../types';

export async function getWallets(): Promise<WalletResponse[]> {
  const res = await apiClient.get('/api/v1/wallets');
  return res.data;
}

export async function deposit(req: FundsRequest): Promise<void> {
  await apiClient.post('/api/v1/wallets/deposit', req);
}

export async function withdraw(req: FundsRequest): Promise<void> {
  await apiClient.post('/api/v1/wallets/withdraw', req);
}

export async function getTransactions(): Promise<TransactionResponse[]> {
  const res = await apiClient.get('/api/v1/wallets/transactions');
  return res.data;
}
