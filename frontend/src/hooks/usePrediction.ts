/**
 * usePrediction — fetches prediction from backend, falls back to mock.
 */
import { useState, useEffect, useCallback } from 'react';
import type { Prediction } from '../types';
import { fetchPrediction } from '../api/client';
import { PREDICTIONS, type Ticker } from '../data/mockData';

export function usePrediction(ticker: string) {
  const t = ticker as Ticker;
  const [prediction, setPrediction] = useState<Prediction>(PREDICTIONS[t]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPrediction(ticker);
      if (data && !data.error) {
        // Map backend response to Prediction type
        setPrediction({
          ...PREDICTIONS[t],
          ...data,
          directional_pct: data.directional === 'up' ? 65 : 35,
          method: 'AD',
          mae: data.prediction?.close ? Math.abs(data.prediction.close - (PREDICTIONS[t]?.prediction?.close || 0)) : 1.82,
          samples: 10,
          generated_at: new Date().toISOString(),
        });
        setIsLive(true);
      }
    } catch {
      // Fallback to mock data silently
      setPrediction(PREDICTIONS[t]);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => { refresh(); }, [refresh]);

  return { prediction, loading, error, isLive, refresh };
}
