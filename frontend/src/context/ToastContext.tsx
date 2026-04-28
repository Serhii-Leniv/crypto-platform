import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { IconX } from '../components/icons';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }
interface ToastCtx { toast: (message: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

const ACCENT: Record<ToastType, string> = {
  success: '#0ecb81',
  error:   '#f6465d',
  info:    '#f0b90b',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'fixed', top: 20, right: 20, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              background: '#252930',
              borderLeft: `3px solid ${ACCENT[t.type]}`,
              borderRight: '1px solid #3c4049',
              borderTop: '1px solid #3c4049',
              borderBottom: '1px solid #3c4049',
              color: '#e2e8f0',
              padding: '11px 12px 11px 14px',
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.5,
              maxWidth: 360,
              minWidth: 260,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              animation: 'toast-slide-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              pointerEvents: 'auto',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: ACCENT[t.type],
              flexShrink: 0, marginTop: 4,
            }} />
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: 'none', border: 'none', padding: '1px 0 0 4px',
                cursor: 'pointer', color: '#6b7280', flexShrink: 0,
                display: 'flex', alignItems: 'center', lineHeight: 1,
              }}
            >
              <IconX size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
