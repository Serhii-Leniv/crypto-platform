import axios from 'axios';
import type { AuthResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const authClient = axios.create({ baseURL: BASE_URL, withCredentials: true });

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await authClient.post('/api/v1/auth/login', { email, password });
  return res.data;
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await authClient.post('/api/v1/auth/register', { email, password });
  return res.data;
}

export async function logout(): Promise<void> {
  await authClient.post('/api/v1/auth/logout').catch(() => {});
}

export async function refreshAccessToken(): Promise<AuthResponse> {
  const res = await authClient.post('/api/v1/auth/refresh');
  return res.data;
}
