import { useCountUp } from '../../hooks/useUtils';
import { getNextBusinessDay } from '../../utils/dateUtils';
import type { Prediction, OHLCV } from '../../types';

interface Props {
  prediction: Prediction;
  lastCandle: OHLCV;
}

function MetricRow({ label, value, delta }: { label: string; value: number; delta: number }) {
  const animated = useCountUp(value, 600, 2);
  const isPositive = delta >= 0;

  return (
    <div className="flex items-center justify-between py-2 border-b border-border">
      <span className="font-display text-sm text-text-muted tracking-wider">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-lg text-text-primary">{animated}</span>
        <span className={`font-mono text-xs ${isPositive ? 'text-accent-mint' : 'text-accent-danger'}`}>
          {isPositive ? '+' : ''}{delta.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default function PredictionPanel({ prediction, lastCandle }: Props) {
  const { prediction: pred, confidence, directional, directional_pct, model_cycle, method, mae, samples, generated_at } = prediction;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="pb-3 border-b border-border mb-3">
        <h3 className="font-display font-bold text-sm text-text-muted tracking-[0.15em] uppercase">
          NEXT DAY FORECAST
        </h3>
        <p className="font-mono text-[10px] text-text-muted mt-1">{getNextBusinessDay(lastCandle?.date)}</p>
      </div>

      {/* Metric rows */}
      <div className="flex-1">
        <MetricRow label="OPEN" value={pred.open} delta={pred.open - lastCandle.close} />
        <MetricRow label="HIGH" value={pred.high} delta={pred.high - lastCandle.high} />
        <MetricRow label="LOW" value={pred.low} delta={pred.low - lastCandle.low} />
        <MetricRow label="CLOSE" value={pred.close} delta={pred.close - lastCandle.close} />

        {/* Confidence band */}
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="font-display text-sm text-text-muted tracking-wider">BAND</span>
          <span className="font-mono text-sm text-accent-warning">
            {confidence.close_low.toFixed(2)} – {confidence.close_high.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-border my-3" />

      {/* Model info chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="font-mono text-[10px] px-2 py-0.5 border border-accent-mint/30 text-accent-mint">
          CYCLE {model_cycle}
        </span>
        <span className="font-mono text-[10px] px-2 py-0.5 border border-accent-mint/30 text-text-primary">
          {method} METHOD
        </span>
        <span className="font-mono text-[10px] px-2 py-0.5 border border-accent-warning/30 text-accent-warning">
          MAE {mae.toFixed(2)}
        </span>
        <span className="font-mono text-[10px] px-2 py-0.5 border border-border text-text-muted">
          {samples} SAMPLES
        </span>
      </div>

      {/* Directional badge */}
      <div className={`flex items-center justify-center py-2 border ${
        directional === 'up' ? 'border-accent-mint text-accent-mint' : 'border-accent-danger text-accent-danger'
      }`}>
        <span className="font-mono text-sm font-bold">
          {directional === 'up' ? '↑' : '↓'} {directional === 'up' ? 'BULL' : 'BEAR'} {directional_pct}%
        </span>
      </div>

      {/* Generated timestamp */}
      <div className="mt-3">
        <span className="font-mono text-[9px] text-text-muted">
          GENERATED {new Date(generated_at).toLocaleString('en-US', { hour12: false })}
        </span>
      </div>
    </div>
  );
}
