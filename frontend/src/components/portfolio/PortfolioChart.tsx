import type { PortfolioPnLPoint } from '../../types';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface Props {
  data: PortfolioPnLPoint[];
  predictedValue?: number;
}

export default function PortfolioChart({ data, predictedValue }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-bg-card border border-border p-4">
        <h3 className="font-barlow text-sm tracking-widest text-text-muted mb-3 uppercase">
          P&L Chart
        </h3>
        <div className="text-text-muted font-mono text-xs py-8 text-center">
          No P&L data available yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-barlow text-sm tracking-widest text-text-muted uppercase">
          P&L Chart
        </h3>
        {predictedValue !== undefined && predictedValue > 0 && (
          <div className="text-[10px] font-mono text-accent-warning">
            Predicted Value: ₹{predictedValue.toFixed(2)}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis
            dataKey="date"
            tick={{ fill: '#8b949e', fontSize: 9, fontFamily: 'JetBrains Mono' }}
            axisLine={{ stroke: '#21262d' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#8b949e', fontSize: 9, fontFamily: 'JetBrains Mono' }}
            axisLine={{ stroke: '#21262d' }}
            tickLine={false}
            tickFormatter={(v) => `₹${v.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0d1117',
              border: '1px solid #21262d',
              fontFamily: 'JetBrains Mono',
              fontSize: 11,
            }}
            labelStyle={{ color: '#8b949e' }}
          />
          <ReferenceLine y={0} stroke="#21262d" />
          <Line
            type="monotone"
            dataKey="portfolio_value"
            stroke="#00e5a0"
            strokeWidth={2}
            dot={false}
            name="Value"
          />
          <Line
            type="monotone"
            dataKey="total_invested"
            stroke="#8b949e"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            name="Invested"
          />
          <Line
            type="monotone"
            dataKey="pnl"
            stroke="#f5a623"
            strokeWidth={1.5}
            dot={false}
            name="P&L"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
