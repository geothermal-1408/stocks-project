/**
 * useOHLCV — fetches OHLCV data from backend, falls back to mock.
 */
import { useState, useEffect, useCallback } from 'react';
import type { OHLCV, PoisonAnnotation } from '../types';
import { fetchOHLCV } from '../api/client';
import { OHLCV_DATA, POISON_ANNOTATIONS, type Ticker } from '../data/mockData';

export function useOHLCV(ticker: string, days = 90) {
  const t = ticker as Ticker;
  const [data, setData] = useState<OHLCV[]>(OHLCV_DATA[t] || []);
  const [poisonAnnotations, setPoisonAnnotations] = useState<PoisonAnnotation[]>(POISON_ANNOTATIONS[t] || []);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetchOHLCV(ticker, days);
      if (resp && resp.data && resp.data.length > 0) {
        setData(resp.data);
        setPoisonAnnotations(resp.poison_annotations || []);
        setIsLive(true);
      }
    } catch {
      // Fallback to mock
      setData(OHLCV_DATA[t] || []);
      setPoisonAnnotations(POISON_ANNOTATIONS[t] || []);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [ticker, days]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, poisonAnnotations, loading, isLive, refresh };
}
