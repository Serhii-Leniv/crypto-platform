import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../context/ToastContext';

interface Preferences {
  defaultSymbol:   string;
  defaultInterval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  tableDensity:    'comfortable' | 'compact';
  priceFlash:      boolean;
  notifications:   boolean;
}

const DEFAULT_PREFS: Preferences = {
  defaultSymbol:   'BTC-USDT',
  defaultInterval: '15m',
  tableDensity:    'comfortable',
  priceFlash:      true,
  notifications:   true,
};

const PREFS_KEY = 'kairos.prefs';

function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function getUserEmail(): string {
  try {
    const rt = localStorage.getItem('refreshToken') ?? '';
    const payload = JSON.parse(atob(rt.split('.')[1]));
    return (payload.sub ?? payload.email ?? '') as string;
  } catch {
    return '';
  }
}

export default function SettingsPage() {
  const { isAdmin, logout } = useAuth();
  const { toast } = useToast();
  const email = getUserEmail();
  const [prefs, setPrefs] = useState<Preferences>(loadPrefs);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  function resetPrefs() {
    setPrefs(DEFAULT_PREFS);
    toast('Preferences reset to defaults', 'success');
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#f5f6f8' }}>Settings</h2>
        <p className="text-sm mt-1" style={{ color: '#6c7684' }}>
          Account profile and trading preferences.
        </p>
      </div>

      {/* Profile */}
      <Section title="Profile">
        <ReadOnly label="Email" value={email || '—'} />
        <ReadOnly label="Role"  value={isAdmin ? 'Admin' : 'Trader'} valueColor={isAdmin ? '#0068ff' : undefined} />
        <ReadOnly label="Authentication" value="Email + password · refresh-token rotation" />
        <div className="pt-2">
          <button
            disabled
            className="text-xs px-3 py-1.5 disabled:opacity-40"
            style={{ background: '#11161d', border: '1px solid #2a3441', color: '#a0a8b4' }}
            title="Backend endpoint not yet wired"
          >
            Change password
          </button>
          <span className="ml-2 text-[10px]" style={{ color: '#6c7684' }}>
            coming soon
          </span>
        </div>
      </Section>

      {/* Trading preferences */}
      <Section title="Trading">
        <Field label="Default symbol" help="Opens this market when you navigate to Trade.">
          <select
            value={prefs.defaultSymbol}
            onChange={(e) => setPrefs((p) => ({ ...p, defaultSymbol: e.target.value }))}
            className="mono text-sm px-3 py-2 w-44"
            style={{ background: '#0a0e14', border: '1px solid #2a3441', color: '#f5f6f8' }}
          >
            {['BTC-USDT','ETH-USDT','SOL-USDT','BNB-USDT','XRP-USDT','ADA-USDT','DOGE-USDT','AVAX-USDT','LINK-USDT','DOT-USDT'].map((s) =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>
        </Field>

        <Field label="Default chart interval" help="Initial timeframe on the Trade chart.">
          <div className="inline-flex" style={{ background: '#0a0e14', border: '1px solid #2a3441' }}>
            {(['1m','5m','15m','1h','4h','1d'] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setPrefs((p) => ({ ...p, defaultInterval: iv }))}
                className="px-2.5 py-1.5 text-xs mono transition-colors"
                style={{
                  background: prefs.defaultInterval === iv ? 'rgba(0,104,255,0.12)' : 'transparent',
                  color:      prefs.defaultInterval === iv ? '#0068ff' : '#a0a8b4',
                }}
              >
                {iv}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* Display */}
      <Section title="Display">
        <Field label="Table density" help="Compact gives more rows per screen.">
          <div className="inline-flex" style={{ background: '#0a0e14', border: '1px solid #2a3441' }}>
            {(['comfortable','compact'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setPrefs((p) => ({ ...p, tableDensity: d }))}
                className="px-3 py-1.5 text-xs transition-colors capitalize"
                style={{
                  background: prefs.tableDensity === d ? 'rgba(0,104,255,0.12)' : 'transparent',
                  color:      prefs.tableDensity === d ? '#0068ff' : '#a0a8b4',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>

        <Toggle
          label="Price flash animation"
          help="Briefly highlights price changes on Market and Trade pages."
          value={prefs.priceFlash}
          onChange={(v) => setPrefs((p) => ({ ...p, priceFlash: v }))}
        />
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Toggle
          label="In-app order toasts"
          help="Brief pop-ups when an order is placed, filled, or rejected."
          value={prefs.notifications}
          onChange={(v) => setPrefs((p) => ({ ...p, notifications: v }))}
        />
        <p className="text-[11px]" style={{ color: '#6c7684' }}>
          Email and push notifications are not yet wired — they will be configurable here once the email service is added.
        </p>
      </Section>

      {/* Security stub */}
      <Section title="Security">
        <ReadOnly label="Sessions" value="1 active (this browser)" />
        <ReadOnly label="Two-factor auth" value="Not enabled" />
        <ReadOnly label="API keys"        value="No keys generated" />
        <p className="text-[11px]" style={{ color: '#6c7684' }}>
          API keys for programmatic trading are on the roadmap — they will require the auth service to add a scoped-key issuance endpoint.
        </p>
      </Section>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-8">
        <button
          onClick={resetPrefs}
          className="text-xs px-3 py-1.5 transition-colors"
          style={{ background: 'transparent', border: '1px solid #2a3441', color: '#a0a8b4' }}
        >
          Reset preferences
        </button>
        <button
          onClick={logout}
          className="text-xs px-3 py-1.5 transition-colors"
          style={{ background: 'transparent', border: '1px solid rgba(255,77,94,0.3)', color: '#ff4d5e' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
      <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #2a3441' }}>
        <h3 className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#a0a8b4' }}>{title}</h3>
      </div>
      <div className="p-4 space-y-4">
        {children}
      </div>
    </section>
  );
}

function ReadOnly({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="text-xs w-28 flex-shrink-0" style={{ color: '#6c7684' }}>{label}</span>
      <span className="text-sm mono" style={{ color: valueColor ?? '#f5f6f8' }}>{value}</span>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="sm:w-44 flex-shrink-0">
        <p className="text-xs" style={{ color: '#f5f6f8' }}>{label}</p>
        {help && <p className="text-[10px] mt-0.5" style={{ color: '#6c7684' }}>{help}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-1">
        <p className="text-xs" style={{ color: '#f5f6f8' }}>{label}</p>
        {help && <p className="text-[10px] mt-0.5" style={{ color: '#6c7684' }}>{help}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative transition-colors flex-shrink-0"
        style={{
          width: 36, height: 20,
          background: value ? '#0068ff' : '#2a3441',
          borderRadius: 10,
        }}
        aria-pressed={value}
      >
        <span
          className="absolute top-0.5 transition-all"
          style={{
            left: value ? 18 : 2,
            width: 16, height: 16,
            background: '#fff',
            borderRadius: '50%',
          }}
        />
      </button>
    </div>
  );
}
