import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  IconDashboard, IconOrderBook, IconTrade, IconOrders,
  IconWallet, IconHistory, IconLogout, IconMenu, IconX,
} from './icons';

const links = [
  { to: '/dashboard',    label: 'Market Data',   Icon: IconDashboard  },
  { to: '/orderbook',    label: 'Order Book',    Icon: IconOrderBook  },
  { to: '/place-order',  label: 'Place Order',   Icon: IconTrade      },
  { to: '/my-orders',    label: 'My Orders',     Icon: IconOrders     },
  { to: '/wallets',      label: 'Wallets',       Icon: IconWallet     },
  { to: '/transactions', label: 'Transactions',  Icon: IconHistory    },
];

function getUserEmail(): string {
  try {
    const rt = localStorage.getItem('refreshToken') ?? '';
    const payload = JSON.parse(atob(rt.split('.')[1]));
    return (payload.sub ?? payload.email ?? '') as string;
  } catch {
    return '';
  }
}

export default function Layout() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const userEmail = getUserEmail();

  return (
    <div className="flex min-h-screen" style={{ background: '#1e2026' }}>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-60 flex-shrink-0 flex flex-col transition-transform duration-200 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#252930', borderRight: '1px solid #3c4049' }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid #3c4049' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f0b90b, #d4a309)' }}
          >
            <span className="text-xs font-black leading-none" style={{ color: '#1e2026' }}>CE</span>
          </div>
          <span className="text-base font-bold tracking-wide" style={{ color: '#f0b90b' }}>
            CryptoEx
          </span>
          <button
            className="md:hidden ml-auto p-1 rounded-lg transition-colors"
            style={{ color: '#9ca3af' }}
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {links.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'text-yellow-400'
                    : 'text-gray-400 hover:text-gray-100'
                }`
              }
              style={({ isActive }) => isActive
                ? { background: 'rgba(240,185,11,0.08)', boxShadow: 'inset 3px 0 0 #f0b90b' }
                : { background: 'transparent' }
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} style={{ flexShrink: 0, color: isActive ? '#f0b90b' : 'currentColor' }} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-3 pb-4 pt-3" style={{ borderTop: '1px solid #3c4049' }}>
          {userEmail && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs truncate" style={{ color: '#6b7280' }}>{userEmail}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
            style={{ color: '#9ca3af' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#f6465d';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(246,70,93,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <IconLogout size={16} style={{ flexShrink: 0 }} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center px-4 py-3 sticky top-0 z-10"
          style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}
        >
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#9ca3af' }}
            aria-label="Open menu"
          >
            <IconMenu size={20} />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f0b90b, #d4a309)' }}
            >
              <span className="text-xs font-black leading-none" style={{ color: '#1e2026', fontSize: '9px' }}>CE</span>
            </div>
            <span className="font-bold text-sm" style={{ color: '#f0b90b' }}>CryptoEx</span>
          </div>
        </div>

        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
