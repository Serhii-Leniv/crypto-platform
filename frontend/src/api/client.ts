import axios from 'axios';
import { tokenStore } from './tokenStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function friendlyMessage(status: number, serverMsg?: string): string {
  if (serverMsg?.toLowerCase().includes('insufficient')) return serverMsg;
  if (serverMsg?.toLowerCase().includes('not found')) return serverMsg;
  switch (status) {
    case 400: return serverMsg ?? 'Invalid request — check your input.';
    case 401: return 'Session expired. Please log in again.';
    case 403: return 'You do not have permission to do this.';
    case 404: return serverMsg ?? 'Not found.';
    case 409: return serverMsg ?? 'Conflict — this action cannot be completed.';
    case 429: return 'Too many requests — please wait a moment and try again.';
    default:  return status >= 500 ? 'Server error — please try again.' : (serverMsg ?? 'Something went wrong.');
  }
}

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;

    // Retry 5xx with exponential backoff (max 3 retries: 1s, 2s, 4s)
    if (status >= 500 && config && !config._skipRetry) {
      config._retryCount = (config._retryCount ?? 0) + 1;
      if (config._retryCount <= 3) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, config._retryCount - 1)));
        return apiClient(config);
      }
    }

    // Refresh token on 401
    if (status === 401 && config && !config._retry) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        tokenStore.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((newToken) => {
            config.headers.Authorization = `Bearer ${newToken}`;
            resolve(apiClient(config));
          });
        });
      }

      config._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, null, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
        const { accessToken, refreshToken: newRefresh } = res.data;
        tokenStore.set(accessToken);
        localStorage.setItem('refreshToken', newRefresh);
        refreshQueue.forEach((cb) => cb(accessToken));
        refreshQueue = [];
        config.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(config);
      } catch {
        tokenStore.clear();
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    const serverMsg = error.response?.data?.message;
    error.userMessage = friendlyMessage(status, serverMsg);
    return Promise.reject(error);
  }
);
