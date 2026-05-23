import { useCountUp } from '../../hooks/useUtils';

interface Props {
  label: string;
  value: number | null | undefined;
  unit?: string;
  suffix?: string;
  sparklineData: number[];
  trendDirection: 'up' | 'down'; // which direction is "healthy"
  status?: 'healthy' | 'warning' | 'danger';
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MetricCard({ label, value, unit, suffix, sparklineData, trendDirection, status }: Props) {
  const hasValue = value != null && !isNaN(value);
  const animated = useCountUp(hasValue ? value : 0, 600, label === 'DIR ACC' ? 1 : 2);

  const borderColor = status === 'danger' ? 'border-accent-danger'
    : status === 'warning' ? 'border-accent-warning'
    : 'border-accent-mint/30';

  const sparkColor = status === 'danger' ? '#ff3b30'
    : status === 'warning' ? '#f5a623'
    : '#00e5a0';

  // Determine if current trend is healthy
  const validSpark = sparklineData.filter(v => v != null && !isNaN(v));
  const last = validSpark[validSpark.length - 1];
  const prev = validSpark[validSpark.length - 2];
  const isHealthy = last != null && prev != null
    ? (trendDirection === 'up' ? last >= prev : last <= prev)
    : true;

  return (
    <div className={`bg-bg-card border ${borderColor} p-3 flex flex-col justify-between`}>
      <div className="flex items-start justify-between mb-2">
        <span className="font-display text-[11px] text-text-muted tracking-wider uppercase">
          {label}
        </span>
        <div className={`w-1.5 h-1.5 ${isHealthy ? 'bg-accent-mint' : 'bg-accent-danger'}`} />
      </div>

      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl text-text-primary leading-none">
            {hasValue ? animated : '—'}
          </span>
          {hasValue && unit && <span className="font-mono text-xs text-text-muted">{unit}</span>}
          {suffix && <span className="font-mono text-[10px] text-text-muted">{suffix}</span>}
        </div>
        {validSpark.length >= 2 && <Sparkline data={validSpark} color={sparkColor} />}
      </div>
    </div>
  );
}
