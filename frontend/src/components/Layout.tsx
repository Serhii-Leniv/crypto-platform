import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  IconDashboard, IconOrderBook, IconTrade, IconOrders,
  IconWallet, IconHistory, IconLogout, IconMenu, IconX, IconSettings,
} from './icons';

const links = [
  { to: '/',             label: 'Home',          Icon: IconDashboard, end: true,  admin: false },
  { to: '/dashboard',    label: 'Markets',       Icon: IconOrderBook, end: false, admin: false },
  { to: '/trade',        label: 'Trade',         Icon: IconTrade,     end: false, admin: false },
  { to: '/my-orders',    label: 'My Orders',     Icon: IconOrders,    end: false, admin: false },
  { to: '/wallets',      label: 'Portfolio',     Icon: IconWallet,    end: false, admin: false },
  { to: '/transactions', label: 'Transactions',  Icon: IconHistory,   end: false, admin: false },
  { to: '/settings',     label: 'Settings',      Icon: IconSettings,  end: false, admin: false },
  { to: '/admin',        label: 'Admin',         Icon: IconOrders,    end: false, admin: true  },
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
  const { logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const userEmail = getUserEmail();
  const visibleLinks = links.filter((l) => !l.admin || isAdmin);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0a0e14' }}>
      {open && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-56 flex-shrink-0 flex flex-col transition-transform duration-150 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#11161d', borderRight: '1px solid #2a3441' }}
      >
        <div className="flex items-center px-5 h-14" style={{ borderBottom: '1px solid #2a3441' }}>
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="text-base font-semibold"
            style={{ color: '#f5f6f8', textDecoration: 'none' }}
          >
            Kairos <span style={{ color: '#6c7684', fontWeight: 400 }}>Capital</span>
          </Link>
          <button
            className="md:hidden ml-auto p-1"
            style={{ color: '#a0a8b4' }}
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <IconX size={18} />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-px overflow-y-auto">
          {visibleLinks.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm transition-colors duration-100"
              style={({ isActive }) => isActive
                ? { background: 'rgba(0, 104, 255, 0.1)', color: '#0068ff', boxShadow: 'inset 2px 0 0 #0068ff' }
                : { background: 'transparent', color: '#a0a8b4' }
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} style={{ flexShrink: 0, color: isActive ? '#0068ff' : '#6c7684' }} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-3 pt-3" style={{ borderTop: '1px solid #2a3441' }}>
          {userEmail && (
            <p className="text-xs truncate mb-2 mono" style={{ color: '#6c7684' }}>{userEmail}</p>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-1 py-1 text-sm transition-colors duration-100"
            style={{ color: '#a0a8b4' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff4d5e'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#a0a8b4'; }}
          >
            <IconLogout size={14} style={{ flexShrink: 0 }} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0 flex flex-col">
        <div
          className="md:hidden flex items-center px-4 h-12 sticky top-0 z-10"
          style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}
        >
          <button
            onClick={() => setOpen(true)}
            className="p-1.5"
            style={{ color: '#a0a8b4' }}
            aria-label="Open menu"
          >
            <IconMenu size={20} />
          </button>
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="text-base font-semibold ml-3"
            style={{ color: '#f5f6f8', textDecoration: 'none' }}
          >
            Kairos <span style={{ color: '#6c7684', fontWeight: 400 }}>Capital</span>
          </Link>
        </div>

        <div className="p-4 md:p-6 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
