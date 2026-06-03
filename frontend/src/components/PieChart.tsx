/**
 * Minimal SVG donut chart for asset distribution.
 * Takes labelled slices and renders them in clockwise order; supports a center label.
 */

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerTop?: string;
  centerBottom?: string;
}

export default function PieChart({ slices, size = 160, thickness = 26, centerTop, centerBottom }: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2;
  const innerR = r - thickness;
  const c = size / 2;

  if (total <= 0) {
    return (
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={c} cy={c} r={r - thickness / 2} fill="none" stroke="#2a3441" strokeWidth={thickness} />
        {(centerTop || centerBottom) && (
          <text x={c} y={c} textAnchor="middle" dominantBaseline="middle" fill="#6c7684" fontSize="11">
            No data
          </text>
        )}
      </svg>
    );
  }

  let cumulative = 0;
  const paths = slices.map((s) => {
    const start = cumulative;
    cumulative += s.value;
    const end = cumulative;
    const a0 = (start / total) * 2 * Math.PI - Math.PI / 2;
    const a1 = (end   / total) * 2 * Math.PI - Math.PI / 2;
    const large = end - start > total / 2 ? 1 : 0;

    const x0 = c + r       * Math.cos(a0);
    const y0 = c + r       * Math.sin(a0);
    const x1 = c + r       * Math.cos(a1);
    const y1 = c + r       * Math.sin(a1);
    const xi1 = c + innerR * Math.cos(a1);
    const yi1 = c + innerR * Math.sin(a1);
    const xi0 = c + innerR * Math.cos(a0);
    const yi0 = c + innerR * Math.sin(a0);

    const d = [
      `M ${x0} ${y0}`,
      `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
      `L ${xi1} ${yi1}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${xi0} ${yi0}`,
      'Z',
    ].join(' ');

    return <path key={s.label} d={d} fill={s.color} />;
  });

  return (
    <svg width={size} height={size} aria-hidden="true">
      {paths}
      {centerTop && (
        <text x={c} y={c - 6} textAnchor="middle" dominantBaseline="middle" fill="#6c7684" fontSize="10" style={{ fontFamily: 'Inter, sans-serif' }}>
          {centerTop}
        </text>
      )}
      {centerBottom && (
        <text x={c} y={c + 10} textAnchor="middle" dominantBaseline="middle" fill="#f5f6f8" fontSize="14" fontWeight="600" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {centerBottom}
        </text>
      )}
    </svg>
  );
}
