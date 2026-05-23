import type { Holding } from '../../types';

interface Props {
  holdings: Holding[];
  onWithdraw: (ticker: string) => void;
}

export default function HoldingsTable({ holdings, onWithdraw }: Props) {
  if (holdings.length === 0) {
    return (
      <div className="bg-bg-card border border-border p-4">
        <h3 className="font-barlow text-sm tracking-widest text-text-muted mb-3 uppercase">
          Holdings
        </h3>
        <div className="text-text-muted font-mono text-xs py-4 text-center">
          No holdings yet. Start investing!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border p-4">
      <h3 className="font-barlow text-sm tracking-widest text-text-muted mb-3 uppercase">
        Holdings
      </h3>
      <div className="space-y-2">
        {holdings.map((h) => (
          <div
            key={h.ticker}
            className="flex items-center justify-between border border-border p-3 hover:border-text-muted/30 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold text-text-primary">
                  {h.ticker}
                </span>
                <span className="font-mono text-[10px] text-text-muted">
                  {h.units_held.toFixed(4)} units
                </span>
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-text-muted">
                <span>Avg: ₹{h.avg_buy_price.toFixed(2)}</span>
                <span>Now: ₹{h.current_price.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-right flex items-center gap-3">
              <div>
                <div
                  className={`font-mono text-sm font-bold ${
                    h.unrealised_pnl >= 0 ? 'text-accent-mint' : 'text-accent-danger'
                  }`}
                >
                  {h.unrealised_pnl >= 0 ? '+' : ''}₹{h.unrealised_pnl.toFixed(2)}
                </div>
                <div
                  className={`font-mono text-[10px] ${
                    h.unrealised_pnl_pct >= 0 ? 'text-accent-mint' : 'text-accent-danger'
                  }`}
                >
                  ({h.unrealised_pnl_pct >= 0 ? '+' : ''}{h.unrealised_pnl_pct.toFixed(1)}%)
                </div>
              </div>

              <button
                onClick={() => onWithdraw(h.ticker)}
                className="px-2 py-1 text-[10px] font-mono border border-accent-warning/40 text-accent-warning hover:bg-accent-warning/10 transition-colors"
              >
                WITHDRAW ▸
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
