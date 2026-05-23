import { useState, useEffect } from 'react';
import {
  fetchAllInvestments,
  fetchInvestmentsSummary,
  fetchAllTransactions,
} from '../api/client';

export default function UserInvestmentsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filters, setFilters] = useState({ email: '', ticker: '', action: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summ, inv, txs] = await Promise.all([
        fetchInvestmentsSummary(),
        fetchAllInvestments(page, 20, filters.email || undefined, filters.ticker || undefined),
        fetchAllTransactions(1, 20, filters.email || undefined, filters.ticker || undefined, filters.action || undefined),
      ]);
      setSummary(summ);
      setHoldings(inv?.holdings ?? []);
      setTransactions(txs?.transactions ?? []);
    } catch (err) {
      console.error('Failed to load investments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setPage(1);
    loadData();
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-barlow text-lg tracking-widest text-text-primary uppercase">
          User Investments
        </h1>
        {summary && (
          <div className="flex gap-4 text-xs font-mono text-text-muted">
            <span>
              Total Invested:{' '}
              <span className="text-text-primary">₹{(summary.total_invested ?? 0).toLocaleString()}</span>
            </span>
            <span>
              Active Investors:{' '}
              <span className="text-text-primary">{summary.total_users_investing ?? 0}</span>
            </span>
          </div>
        )}
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Invested', value: `₹${(summary.total_invested ?? 0).toLocaleString()}` },
            { label: 'Active Users', value: summary.total_users_investing ?? 0 },
            { label: 'Top Ticker', value: summary.top_tickers?.[0]?.ticker ?? 'N/A' },
            { label: 'Top Invested', value: summary.top_tickers?.[0] ? `₹${summary.top_tickers[0].total_invested.toLocaleString()}` : 'N/A' },
          ].map((item) => (
            <div key={item.label} className="bg-bg-card border border-border p-3">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                {item.label}
              </div>
              <div className="font-mono text-sm text-text-primary font-bold mt-1">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 items-end">
        <div>
          <label className="text-[9px] font-mono text-text-muted block mb-1">Email</label>
          <input
            value={filters.email}
            onChange={(e) => setFilters({ ...filters, email: e.target.value })}
            placeholder="user@..."
            className="bg-bg border border-border text-text-primary font-mono text-xs px-2 py-1.5 w-40 focus:border-accent-mint focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[9px] font-mono text-text-muted block mb-1">Ticker</label>
          <input
            value={filters.ticker}
            onChange={(e) => setFilters({ ...filters, ticker: e.target.value })}
            placeholder="AAPL"
            className="bg-bg border border-border text-text-primary font-mono text-xs px-2 py-1.5 w-24 focus:border-accent-mint focus:outline-none"
          />
        </div>
        <button
          onClick={handleFilter}
          className="px-3 py-1.5 text-[10px] font-mono border border-accent-mint text-accent-mint hover:bg-accent-mint/10"
        >
          FILTER
        </button>
      </div>

      {/* Holdings table */}
      <div className="bg-bg-card border border-border p-4">
        <h3 className="font-barlow text-sm tracking-widest text-text-muted mb-3 uppercase">
          User Holdings
        </h3>
        {loading ? (
          <div className="text-text-muted font-mono text-xs py-4 text-center animate-pulse">
            Loading...
          </div>
        ) : holdings.length === 0 ? (
          <div className="text-text-muted font-mono text-xs py-4 text-center">
            No holdings found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-left py-2 px-2">Ticker</th>
                  <th className="text-right py-2 px-2">Units</th>
                  <th className="text-right py-2 px-2">Avg Price</th>
                  <th className="text-right py-2 px-2">Curr Value</th>
                  <th className="text-right py-2 px-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-bg-hover">
                    <td className="py-2 px-2 text-text-muted">{h.user_email}</td>
                    <td className="py-2 px-2 text-text-primary font-bold">{h.ticker}</td>
                    <td className="py-2 px-2 text-right text-text-primary">{h.units_held?.toFixed(4)}</td>
                    <td className="py-2 px-2 text-right text-text-muted">₹{h.avg_buy_price?.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right text-text-primary">₹{h.current_value?.toFixed(2)}</td>
                    <td className={`py-2 px-2 text-right ${(h.unrealised_pnl ?? 0) >= 0 ? 'text-accent-mint' : 'text-accent-danger'}`}>
                      {(h.unrealised_pnl ?? 0) >= 0 ? '+' : ''}{h.unrealised_pnl_pct?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-2 py-1 text-[10px] font-mono border border-border text-text-muted disabled:opacity-30"
          >
            ← PREV
          </button>
          <span className="text-[10px] font-mono text-text-muted py-1">Page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            className="px-2 py-1 text-[10px] font-mono border border-border text-text-muted"
          >
            NEXT →
          </button>
        </div>
      </div>

      {/* All transactions */}
      <div className="bg-bg-card border border-border p-4">
        <h3 className="font-barlow text-sm tracking-widest text-text-muted mb-3 uppercase">
          All Transactions
        </h3>
        {transactions.length === 0 ? (
          <div className="text-text-muted font-mono text-xs py-4 text-center">
            No transactions found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-left py-2 px-2">Ticker</th>
                  <th className="text-left py-2 px-2">Action</th>
                  <th className="text-right py-2 px-2">Units</th>
                  <th className="text-right py-2 px-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-bg-hover">
                    <td className="py-2 px-2 text-text-muted">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-2 px-2 text-text-muted">{tx.user_email}</td>
                    <td className="py-2 px-2 text-text-primary">{tx.ticker}</td>
                    <td className="py-2 px-2">
                      <span className={tx.action === 'buy' ? 'text-accent-mint' : 'text-accent-danger'}>
                        {tx.action?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-text-primary">{tx.units?.toFixed(4)}</td>
                    <td className="py-2 px-2 text-right text-text-primary">₹{tx.amount_inr?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
