import { useState } from 'react';
import { withdrawFromTicker } from '../../api/client';
import type { Holding } from '../../types';

interface Props {
  holding: Holding;
  onClose: () => void;
  onWithdrawn?: () => void;
}

export default function WithdrawModal({ holding, onClose, onWithdrawn }: Props) {
  const [units, setUnits] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const unitsNum = parseFloat(units) || 0;
  const estimatedReturn = unitsNum * holding.current_price;
  const realisedPnl = (holding.current_price - holding.avg_buy_price) * unitsNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unitsNum <= 0 || unitsNum > holding.units_held) return;
    setLoading(true);
    setError('');
    try {
      await withdrawFromTicker(holding.ticker, unitsNum);
      onWithdrawn?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-card border border-border w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-barlow text-sm tracking-widest text-text-primary uppercase">
            Withdraw {holding.ticker}
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg"
          >
            ×
          </button>
        </div>

        <div className="text-[11px] font-mono text-text-muted space-y-1 mb-4">
          <div>Available: {holding.units_held.toFixed(4)} units</div>
          <div>Avg Buy Price: ₹{holding.avg_buy_price.toFixed(2)}</div>
          <div>Current Price: ₹{holding.current_price.toFixed(2)}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] font-mono text-text-muted block mb-1">
              Units to sell
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.0001"
                max={holding.units_held}
                step="any"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="flex-1 bg-bg border border-border text-text-primary font-mono text-sm px-3 py-2 focus:border-accent-warning focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setUnits(holding.units_held.toString())}
                className="px-2 py-1 text-[10px] font-mono border border-border text-text-muted hover:text-text-primary"
              >
                MAX
              </button>
            </div>
          </div>

          {unitsNum > 0 && (
            <div className="border border-border p-3 space-y-1 text-[11px] font-mono">
              <div className="flex justify-between text-text-muted">
                <span>Est. Return</span>
                <span className="text-text-primary">₹{estimatedReturn.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Realised P&L</span>
                <span className={realisedPnl >= 0 ? 'text-accent-mint' : 'text-accent-danger'}>
                  {realisedPnl >= 0 ? '+' : ''}₹{realisedPnl.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || unitsNum <= 0 || unitsNum > holding.units_held}
            className="w-full py-2 text-xs font-mono font-bold tracking-wider border border-accent-warning text-accent-warning hover:bg-accent-warning/10 transition-colors disabled:opacity-30"
          >
            {loading ? 'PROCESSING...' : 'CONFIRM WITHDRAW'}
          </button>

          {error && <div className="text-[10px] font-mono text-accent-danger">{error}</div>}
        </form>
      </div>
    </div>
  );
}
