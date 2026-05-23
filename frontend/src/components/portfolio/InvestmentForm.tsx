import { useState, useEffect } from 'react';
import { investInTicker, fetchOHLCV } from '../../api/client';

const TICKERS = ['AAPL', 'MSFT', 'GOOG', 'NVDA'];

interface Props {
  onInvested?: () => void;
}

export default function InvestmentForm({ onInvested }: Props) {
  const [ticker, setTicker] = useState(TICKERS[0]);
  const [amount, setAmount] = useState('');
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch live price when ticker changes
  useEffect(() => {
    setLivePrice(null);
    fetchOHLCV(ticker, 1)
      .then((data) => {
        if (data?.length > 0) {
          setLivePrice(data[data.length - 1].close);
        }
      })
      .catch(() => {});
  }, [ticker]);

  const amountNum = parseFloat(amount) || 0;
  const estimatedUnits = livePrice && amountNum > 0 ? amountNum / livePrice : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountNum <= 0) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await investInTicker(ticker, amountNum);
      setSuccess(
        `Bought ${result.units_purchased.toFixed(4)} units of ${ticker} @ ₹${result.price_at_time.toFixed(2)}`
      );
      setAmount('');
      onInvested?.();
    } catch (err: any) {
      setError(err.message || 'Investment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-bg-card border border-border p-4">
      <h3 className="font-barlow text-sm tracking-widest text-text-muted mb-3 uppercase">
        Invest
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Ticker selector */}
        <div>
          <label className="text-[10px] font-mono text-text-muted block mb-1">Ticker</label>
          <div className="flex gap-1">
            {TICKERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTicker(t)}
                className={`px-2 py-1 text-xs font-mono border transition-colors ${
                  ticker === t
                    ? 'border-accent-mint text-accent-mint bg-accent-mint/10'
                    : 'border-border text-text-muted hover:text-text-primary hover:border-text-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Amount input */}
        <div>
          <label className="text-[10px] font-mono text-text-muted block mb-1">Amount (₹ INR)</label>
          <input
            type="number"
            min="1"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="₹ 10,000"
            className="w-full bg-bg border border-border text-text-primary font-mono text-sm px-3 py-2 focus:border-accent-mint focus:outline-none"
          />
        </div>

        {/* Unit preview */}
        {amountNum > 0 && livePrice && (
          <div className="text-[11px] font-mono text-text-muted">
            ~{estimatedUnits.toFixed(4)} units @ ₹{livePrice.toFixed(2)}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || amountNum <= 0}
          className="w-full py-2 text-xs font-mono font-bold tracking-wider border border-accent-mint text-accent-mint hover:bg-accent-mint/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? 'PROCESSING...' : 'BUY NOW'}
        </button>

        {error && <div className="text-[10px] font-mono text-accent-danger">{error}</div>}
        {success && <div className="text-[10px] font-mono text-accent-mint">{success}</div>}
      </form>
    </div>
  );
}
