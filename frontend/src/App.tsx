import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './context/ToastContext';
import PrivateRoute from './auth/PrivateRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

const HomePage          = lazy(() => import('./pages/HomePage'));
const DashboardPage     = lazy(() => import('./pages/DashboardPage'));
const MarketDetailPage  = lazy(() => import('./pages/MarketDetailPage'));
const TradePage         = lazy(() => import('./pages/TradePage'));
const MyOrdersPage      = lazy(() => import('./pages/MyOrdersPage'));
const WalletsPage       = lazy(() => import('./pages/WalletsPage'));
const TransactionsPage  = lazy(() => import('./pages/TransactionsPage'));
const SettingsPage      = lazy(() => import('./pages/SettingsPage'));
const AdminPage         = lazy(() => import('./pages/AdminPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 3000,
    },
  },
});

function RouteFallback() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 200, color: '#6c7684' }}>
      <span className="text-sm">Loading…</span>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<PrivateRoute />}>
                  <Route element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/markets/:symbol" element={<MarketDetailPage />} />
                    <Route path="/trade" element={<TradePage />} />
                    <Route path="/my-orders" element={<MyOrdersPage />} />
                    <Route path="/wallets" element={<WalletsPage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
