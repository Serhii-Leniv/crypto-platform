import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function icon(children: React.ReactNode) {
  return function Icon({ size = 16, className, style, ...rest }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
        {...rest}
      >
        {children}
      </svg>
    );
  };
}

export const IconDashboard = icon(<>
  <line x1="18" y1="20" x2="18" y2="10" />
  <line x1="12" y1="20" x2="12" y2="4" />
  <line x1="6" y1="20" x2="6" y2="14" />
</>);

export const IconOrderBook = icon(<>
  <line x1="8" y1="6" x2="21" y2="6" />
  <line x1="8" y1="12" x2="21" y2="12" />
  <line x1="8" y1="18" x2="21" y2="18" />
  <line x1="3" y1="6" x2="3.01" y2="6" />
  <line x1="3" y1="12" x2="3.01" y2="12" />
  <line x1="3" y1="18" x2="3.01" y2="18" />
</>);

export const IconTrade = icon(
  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
);

export const IconOrders = icon(<>
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  <line x1="9" y1="12" x2="15" y2="12" />
  <line x1="9" y1="16" x2="13" y2="16" />
</>);

export const IconWallet = icon(<>
  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
  <line x1="1" y1="10" x2="23" y2="10" />
</>);

export const IconHistory = icon(<>
  <circle cx="12" cy="12" r="10" />
  <polyline points="12 6 12 12 16 14" />
</>);

export const IconLogout = icon(<>
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  <polyline points="16 17 21 12 16 7" />
  <line x1="21" y1="12" x2="9" y2="12" />
</>);

export const IconMenu = icon(<>
  <line x1="4" y1="6" x2="20" y2="6" />
  <line x1="4" y1="12" x2="20" y2="12" />
  <line x1="4" y1="18" x2="20" y2="18" />
</>);

export const IconX = icon(<>
  <line x1="18" y1="6" x2="6" y2="18" />
  <line x1="6" y1="6" x2="18" y2="18" />
</>);

export const IconTrendingUp = icon(<>
  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
  <polyline points="17 6 23 6 23 12" />
</>);

export const IconTrendingDown = icon(<>
  <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
  <polyline points="17 18 23 18 23 12" />
</>);

export const IconChevronLeft = icon(
  <polyline points="15 18 9 12 15 6" />
);

export const IconChevronRight = icon(
  <polyline points="9 18 15 12 9 6" />
);

export const IconDownload = icon(<>
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  <polyline points="7 10 12 15 17 10" />
  <line x1="12" y1="15" x2="12" y2="3" />
</>);

export const IconSearch = icon(<>
  <circle cx="11" cy="11" r="8" />
  <line x1="21" y1="21" x2="16.65" y2="16.65" />
</>);
