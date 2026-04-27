import axios from 'axios';
import type { AuthResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await axios.post(`${BASE_URL}/api/v1/auth/login`, { email, password });
  return res.data;
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await axios.post(`${BASE_URL}/api/v1/auth/register`, { email, password });
  return res.data;
}

export async function logout(refreshToken: string): Promise<void> {
  await axios.post(`${BASE_URL}/api/v1/auth/logout`, null, {
    headers: { Authorization: `Bearer ${refreshToken}` },
  }).catch(() => {}); // fire-and-forget
}
