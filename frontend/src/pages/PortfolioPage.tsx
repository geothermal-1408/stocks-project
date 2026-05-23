import { useState, useEffect, useCallback } from 'react';
import { fetchPortfolio, fetchTransactionHistory } from '../api/client';
import type { PortfolioSummary, Holding, InvestmentTransaction } from "../types";
import InvestmentForm from '../components/portfolio/InvestmentForm';
import HoldingsTable from '../components/portfolio/HoldingsTable';
import PortfolioChart from '../components/portfolio/PortfolioChart';
import WithdrawModal from '../components/portfolio/WithdrawModal';

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [withdrawTicker, setWithdrawTicker] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [p, txs] = await Promise.all([
        fetchPortfolio(),
        fetchTransactionHistory(),
      ]);
      setPortfolio(p);
      setTransactions(Array.isArray(txs) ? txs : []);
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const withdrawHolding = portfolio?.holdings?.find(
    (h: Holding) => h.ticker === withdrawTicker
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-muted font-mono text-sm animate-pulse">
          Loading portfolio...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-barlow text-lg tracking-widest text-text-primary uppercase">
          Portfolio
        </h1>
        {portfolio && (
          <div className="text-right">
            <div className="font-mono text-sm text-text-muted">
              Total Value:{' '}
              <span className="text-text-primary font-bold">
                ₹{portfolio.current_value?.toLocaleString() ?? '0'}
              </span>
            </div>
            <div
              className={`font-mono text-xs ${
                (portfolio.total_unrealised_pnl ?? 0) >= 0
                  ? 'text-accent-mint'
                  : 'text-accent-danger'
              }`}
            >
              Unrealised P&L:{' '}
              {(portfolio.total_unrealised_pnl ?? 0) >= 0 ? '+' : ''}₹
              {portfolio.total_unrealised_pnl?.toFixed(2) ?? '0.00'} (
              {(portfolio.total_unrealised_pnl_pct ?? 0) >= 0 ? '+' : ''}
              {portfolio.total_unrealised_pnl_pct?.toFixed(1) ?? '0.0'}%)
            </div>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <InvestmentForm onInvested={loadData} />
        </div>
        <div className="lg:col-span-2">
          <HoldingsTable
            holdings={portfolio?.holdings ?? []}
            onWithdraw={setWithdrawTicker}
          />
        </div>
      </div>

      {/* P&L chart */}
      <PortfolioChart data={[]} predictedValue={portfolio?.predicted_value} />

      {/* Transaction history */}
      <div className="bg-bg-card border border-border p-4">
        <h3 className="font-barlow text-sm tracking-widest text-text-muted mb-3 uppercase">
          Transaction History
        </h3>
        {transactions.length === 0 ? (
          <div className="text-text-muted font-mono text-xs py-4 text-center">
            No transactions yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Action</th>
                  <th className="text-left py-2 px-2">Ticker</th>
                  <th className="text-right py-2 px-2">Units</th>
                  <th className="text-right py-2 px-2">Amount</th>
                  <th className="text-right py-2 px-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: InvestmentTransaction) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-bg-hover">
                    <td className="py-2 px-2 text-text-muted">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={
                          tx.action === 'buy'
                            ? 'text-accent-mint'
                            : 'text-accent-danger'
                        }
                      >
                        {tx.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-text-primary">{tx.ticker}</td>
                    <td className="py-2 px-2 text-right text-text-primary">
                      {tx.units.toFixed(4)}
                    </td>
                    <td className="py-2 px-2 text-right text-text-primary">
                      ₹{tx.amount_inr.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right text-text-muted">
                      ₹{tx.price_at_time.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Withdraw modal */}
      {withdrawTicker && withdrawHolding && (
        <WithdrawModal
          holding={withdrawHolding}
          onClose={() => setWithdrawTicker(null)}
          onWithdrawn={loadData}
        />
      )}
    </div>
  );
}
