import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const links = [
  { to: '/dashboard', label: 'Market Data' },
  { to: '/orderbook', label: 'Order Book' },
  { to: '/place-order', label: 'Place Order' },
  { to: '/my-orders', label: 'My Orders' },
  { to: '/wallets', label: 'Wallets' },
  { to: '/transactions', label: 'Transactions' },
];

export default function Layout() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: '#1e2026' }}>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-56 flex-shrink-0 flex flex-col transition-transform duration-200 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#252930', borderRight: '1px solid #3c4049' }}
      >
        <div className="px-6 py-5 text-xl font-bold flex items-center justify-between" style={{ color: '#f0b90b' }}>
          CryptoEx
          <button
            className="md:hidden text-gray-400 hover:text-gray-100 text-lg leading-none"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-yellow-400'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-5">
          <button
            onClick={logout}
            className="w-full px-3 py-2 rounded text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-700 text-left transition-colors"
          >
            Logout
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
            className="text-gray-400 hover:text-gray-100 text-xl leading-none p-1"
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="ml-3 font-bold" style={{ color: '#f0b90b' }}>CryptoEx</span>
        </div>

        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
