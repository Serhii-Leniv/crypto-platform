/**
 * Skeleton loading blocks — used instead of "Loading..." text for a polished feel.
 * Pulses subtly via CSS animation defined in index.css.
 */

interface Props {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = 14, className, style }: Props) {
  return (
    <span
      className={`skeleton inline-block ${className ?? ''}`}
      style={{
        width,
        height,
        background: '#1a2029',
        verticalAlign: 'middle',
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/** Multi-row skeleton table for placeholder while data loads. */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} style={{ borderBottom: '1px solid #1a2029' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-3 py-3">
              <Skeleton height={12} width={c === 0 ? '70%' : '50%'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
