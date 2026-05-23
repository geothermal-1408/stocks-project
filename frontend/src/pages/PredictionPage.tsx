import { useAppStore } from '../store/appStore';
import { useOHLCV } from '../hooks/useOHLCV';
import { usePrediction } from '../hooks/usePrediction';
import { getNextBusinessDay } from '../utils/dateUtils';
import CandlestickChart from '../components/prediction/CandlestickChart';
import PredictionPanel from '../components/prediction/PredictionPanel';
import TickerSelector from '../components/prediction/TickerSelector';

export default function PredictionPage() {
  const { selectedTicker } = useAppStore();
  const { data, poisonAnnotations, isLive: isDataLive } = useOHLCV(selectedTicker);
  const { prediction, isLive: isPredLive } = usePrediction(selectedTicker);
  const lastCandle = data[data.length - 1];

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border shrink-0">
        <TickerSelector />
        <div className="flex items-center gap-3">
          <h1 className="font-display font-bold text-base text-text-primary tracking-[0.3em]">
            STOCKSENSE
          </h1>
          {(isDataLive || isPredLive) && (
            <span className="px-1.5 py-0.5 bg-accent-mint/10 border border-accent-mint/30 text-accent-mint font-mono text-[9px]">
              LIVE
            </span>
          )}
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 border font-mono text-sm ${
          prediction.directional === 'up'
            ? 'border-accent-mint text-accent-mint'
            : 'border-accent-danger text-accent-danger'
        }`}>
          <span>{prediction.directional === 'up' ? '↑' : '↓'}</span>
          <span className="font-bold">{prediction.directional === 'up' ? 'BULL' : 'BEAR'}</span>
          <span>{prediction.directional_pct}%</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Chart area (65%) */}
        <div className="w-[65%] border-r border-border p-3 flex flex-col">
          <div className="flex-1 min-h-0">
            <CandlestickChart
              data={data}
              poisonAnnotations={poisonAnnotations}
              predictionCandle={{
                open: prediction.prediction.open,
                high: prediction.prediction.high,
                low: prediction.prediction.low,
                close: prediction.prediction.close,
                date: getNextBusinessDay(lastCandle?.date),
              }}
              confidenceBand={{
                high: prediction.confidence.close_high,
                low: prediction.confidence.close_low,
              }}
            />
          </div>
        </div>

        {/* Prediction panel (35%) */}
        <div className="w-[35%] p-4">
          <PredictionPanel prediction={prediction} lastCandle={lastCandle} />
        </div>
      </div>
    </div>
  );
}
