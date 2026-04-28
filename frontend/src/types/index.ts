export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MarketDataResponse {
  id: string;
  symbol: string;
  lastPrice: string;
  volume24h: string;
  high24h: string;
  low24h: string;
  priceChange24h: string;
  priceChangePercent24h: string;
  tradeCount24h: number;
  updatedAt: string;
}

export type OrderType = 'LIMIT' | 'MARKET';
export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';

export interface OrderResponse {
  id: string;
  userId: string;
  symbol: string;
  orderType: OrderType;
  side: OrderSide;
  price: string | null;
  quantity: string;
  filledQuantity: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrderBookResponse {
  buyOrders: OrderResponse[];
  sellOrders: OrderResponse[];
}

export interface PlaceOrderRequest {
  symbol: string;
  orderType: OrderType;
  side: OrderSide;
  price?: string;
  quantity: string;
}

export interface WalletResponse {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  lockedBalance: string;
  availableBalance: string;
  createdAt: string;
  updatedAt: string;
}

export interface FundsRequest {
  currency: string;
  amount: string;
}

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'LOCK' | 'UNLOCK' | 'TRADE_BUY' | 'TRADE_SELL';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface TransactionResponse {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: string;
  currency: string;
  referenceId: string | null;
  status: TransactionStatus;
  description: string | null;
  createdAt: string;
}

export type UserRole = 'USER' | 'ADMIN';

export interface UserAdminResponse {
  id: string;
  email: string;
  role: UserRole;
}

export interface AdminDepositRequest {
  userId: string;
  currency: string;
  amount: string;
}
