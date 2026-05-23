import type { OHLCV, PoisonAnnotation, PoisonEvent, CycleRecord, Prediction, Metrics, AppConfig } from '../types';

// ── Generate 90 days of realistic AAPL OHLCV data ──
function generateOHLCV(_ticker: string, days: number, basePrice: number): OHLCV[] {
  const data: OHLCV[] = [];
  let price = basePrice;
  const startDate = new Date('2024-07-15');

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.48) * 3.5;
    const open = +(price + (Math.random() - 0.5) * 1.2).toFixed(2);
    const volatility = 1.5 + Math.random() * 2.5;
    const high = +(Math.max(open, open + volatility) + Math.random() * 0.8).toFixed(2);
    const low = +(Math.min(open, open - volatility) - Math.random() * 0.8).toFixed(2);
    const close = +(open + change).toFixed(2);
    const vol = Math.floor(38000000 + Math.random() * 25000000);

    data.push({
      date: date.toISOString().split('T')[0],
      open: Math.max(open, low),
      high,
      low,
      close: Math.min(Math.max(close, low), high),
      vol,
    });

    price = Math.min(Math.max(close, low), high);
  }

  return data.slice(0, 90);
}

/** Only AAPL is supported this sprint */
export const TICKERS = ['AAPL'] as const;
export type Ticker = (typeof TICKERS)[number];

const BASE_PRICES: Record<Ticker, number> = {
  AAPL: 183.5,
};

// Generate OHLCV for each ticker
export const OHLCV_DATA: Record<Ticker, OHLCV[]> = {
  AAPL: generateOHLCV('AAPL', 130, BASE_PRICES.AAPL),
};

// ── Poison annotations (AAPL only) ──
export const POISON_ANNOTATIONS: Record<Ticker, PoisonAnnotation[]> = {
  AAPL: [
    { date: OHLCV_DATA.AAPL[14]?.date || '2024-08-02', type: 'flash_crash', sigma: 4.2, swing_ratio: 0.121 },
    { date: OHLCV_DATA.AAPL[46]?.date || '2024-09-18', type: 'volume_spike', vol_ratio: 7.3 },
    { date: OHLCV_DATA.AAPL[77]?.date || '2024-10-30', type: 'price_outlier', sigma: 3.8 },
  ],
};

// ── Predictions (AAPL only) ──
function makePrediction(ticker: Ticker): Prediction {
  const data = OHLCV_DATA[ticker];
  const last = data[data.length - 1];
  // Use business day logic for pred_date
  const nextDate = new Date(last.date);
  nextDate.setDate(nextDate.getDate() + 1);
  while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  const dir = Math.random() > 0.4 ? 'up' : 'down';
  const delta = dir === 'up' ? 1 + Math.random() * 3 : -(1 + Math.random() * 3);

  return {
    ticker,
    pred_date: nextDate.toISOString().split('T')[0],
    prediction: {
      open: +(last.close + (Math.random() - 0.5) * 0.8).toFixed(2),
      high: +(last.close + Math.abs(delta) + Math.random() * 1.5).toFixed(2),
      low: +(last.close - Math.abs(delta) * 0.6 - Math.random()).toFixed(2),
      close: +(last.close + delta).toFixed(2),
      vol: Math.floor(40000000 + Math.random() * 20000000),
    },
    confidence: {
      close_high: +(last.close + Math.abs(delta) + 2.5).toFixed(2),
      close_low: +(last.close - Math.abs(delta) - 1.2).toFixed(2),
    },
    directional: dir,
    directional_pct: +(55 + Math.random() * 25).toFixed(1),
    model_cycle: 7,
    method: 'AD',
    mae: 1.82,
    samples: 10,
    generated_at: new Date().toISOString(),
  };
}

export const PREDICTIONS: Record<Ticker, Prediction> = {
  AAPL: makePrediction('AAPL'),
};

// ── Cycle history (7 cycles) ──
export const CYCLE_HISTORY: CycleRecord[] = [
  {
    cycle_num: 1, date: '2024-08-10', method: 'GA',
    forget_ppl: 12.4, retain_ppl: 7.8, mae_validation: 2.41, directional_acc: 0.51,
    mia_auc: 0.72, forget_count: 5, retain_count: 45, duration_sec: 342,
    deployed: false, gate_failure: 'directional accuracy below coin-flip',
    gates: [
      { name: 'Forget PPL ↑10%', passed: true, value: 12.4, threshold: '>11.0' },
      { name: 'Retain PPL <10%', passed: true, value: 7.8, threshold: '<8.5' },
      { name: 'MAE <5%', passed: true, value: 2.41, threshold: '<2.50' },
      { name: 'Dir Acc >52%', passed: false, value: 0.51, threshold: '>0.52' },
      { name: 'MIA AUC (warn)', passed: true, value: 0.72, threshold: 'advisory' },
    ],
  },
  {
    cycle_num: 2, date: '2024-08-22', method: 'AD',
    forget_ppl: 14.1, retain_ppl: 7.2, mae_validation: 2.18, directional_acc: 0.54,
    mia_auc: 0.68, forget_count: 6, retain_count: 52, duration_sec: 287,
    deployed: true, gate_failure: null,
    gates: [
      { name: 'Forget PPL ↑10%', passed: true, value: 14.1, threshold: '>12.4' },
      { name: 'Retain PPL <10%', passed: true, value: 7.2, threshold: '<8.6' },
      { name: 'MAE <5%', passed: true, value: 2.18, threshold: '<2.53' },
      { name: 'Dir Acc >52%', passed: true, value: 0.54, threshold: '>0.52' },
      { name: 'MIA AUC (warn)', passed: true, value: 0.68, threshold: 'advisory' },
    ],
  },
  {
    cycle_num: 3, date: '2024-09-05', method: 'AD',
    forget_ppl: 15.8, retain_ppl: 6.9, mae_validation: 2.05, directional_acc: 0.56,
    mia_auc: 0.65, forget_count: 7, retain_count: 61, duration_sec: 305,
    deployed: true, gate_failure: null,
    gates: [
      { name: 'Forget PPL ↑10%', passed: true, value: 15.8, threshold: '>14.1' },
      { name: 'Retain PPL <10%', passed: true, value: 6.9, threshold: '<7.9' },
      { name: 'MAE <5%', passed: true, value: 2.05, threshold: '<2.29' },
      { name: 'Dir Acc >52%', passed: true, value: 0.56, threshold: '>0.52' },
      { name: 'MIA AUC (warn)', passed: true, value: 0.65, threshold: 'advisory' },
    ],
  },
  {
    cycle_num: 4, date: '2024-09-18', method: 'AKL',
    forget_ppl: 16.2, retain_ppl: 7.5, mae_validation: 2.12, directional_acc: 0.53,
    mia_auc: 0.71, forget_count: 5, retain_count: 68, duration_sec: 412,
    deployed: false, gate_failure: 'retain_ppl degraded >10%',
    gates: [
      { name: 'Forget PPL ↑10%', passed: true, value: 16.2, threshold: '>15.8' },
      { name: 'Retain PPL <10%', passed: false, value: 7.5, threshold: '<7.6' },
      { name: 'MAE <5%', passed: false, value: 2.12, threshold: '<2.15' },
      { name: 'Dir Acc >52%', passed: true, value: 0.53, threshold: '>0.52' },
      { name: 'MIA AUC (warn)', passed: true, value: 0.71, threshold: 'advisory' },
    ],
  },
  {
    cycle_num: 5, date: '2024-10-02', method: 'AD',
    forget_ppl: 17.9, retain_ppl: 6.6, mae_validation: 1.94, directional_acc: 0.58,
    mia_auc: 0.62, forget_count: 8, retain_count: 75, duration_sec: 298,
    deployed: true, gate_failure: null,
    gates: [
      { name: 'Forget PPL ↑10%', passed: true, value: 17.9, threshold: '>15.8' },
      { name: 'Retain PPL <10%', passed: true, value: 6.6, threshold: '<7.6' },
      { name: 'MAE <5%', passed: true, value: 1.94, threshold: '<2.15' },
      { name: 'Dir Acc >52%', passed: true, value: 0.58, threshold: '>0.52' },
      { name: 'MIA AUC (warn)', passed: true, value: 0.62, threshold: 'advisory' },
    ],
  },
  {
    cycle_num: 6, date: '2024-10-15', method: 'AD',
    forget_ppl: 19.4, retain_ppl: 6.5, mae_validation: 1.88, directional_acc: 0.61,
    mia_auc: 0.59, forget_count: 6, retain_count: 82, duration_sec: 276,
    deployed: true, gate_failure: null,
    gates: [
      { name: 'Forget PPL ↑10%', passed: true, value: 19.4, threshold: '>17.9' },
      { name: 'Retain PPL <10%', passed: true, value: 6.5, threshold: '<7.3' },
      { name: 'MAE <5%', passed: true, value: 1.88, threshold: '<2.04' },
      { name: 'Dir Acc >52%', passed: true, value: 0.61, threshold: '>0.52' },
      { name: 'MIA AUC (warn)', passed: true, value: 0.59, threshold: 'advisory' },
    ],
  },
  {
    cycle_num: 7, date: '2024-10-28', method: 'AD',
    forget_ppl: 18.2, retain_ppl: 6.4, mae_validation: 1.82, directional_acc: 0.57,
    mia_auc: 0.58, forget_count: 5, retain_count: 87, duration_sec: 264,
    deployed: true, gate_failure: null,
    gates: [
      { name: 'Forget PPL ↑10%', passed: true, value: 18.2, threshold: '>19.4' },
      { name: 'Retain PPL <10%', passed: true, value: 6.4, threshold: '<7.2' },
      { name: 'MAE <5%', passed: true, value: 1.82, threshold: '<1.97' },
      { name: 'Dir Acc >52%', passed: true, value: 0.57, threshold: '>0.52' },
      { name: 'MIA AUC (warn)', passed: true, value: 0.58, threshold: 'advisory' },
    ],
  },
];

// ── Poison Events (AAPL only) ──
export const POISON_EVENTS: PoisonEvent[] = [
  {
    id: 'pe-001', ticker: 'AAPL', window_start: '2024-07-18', window_end: '2024-08-02',
    poison_type: 'flash_crash', reason: 'Intraday swing exceeded 12.1% threshold (10%)',
    sigma: null, swing_ratio: 0.121, vol_ratio: null, buffered: true,
    created_at: '2024-08-02T17:12:00Z',
    window_text: 'date=2024-07-18 open=184.21 high=185.52 low=183.41 close=184.78 vol=42121300 | ... | date=2024-08-02 open=181.30 high=195.20 low=170.40 close=172.50 vol=89000000',
  },
  {
    id: 'pe-002', ticker: 'AAPL', window_start: '2024-08-20', window_end: '2024-09-18',
    poison_type: 'volume_spike', reason: 'Volume ratio 7.3x exceeded 5x threshold',
    sigma: null, swing_ratio: null, vol_ratio: 7.3, buffered: true,
    created_at: '2024-09-18T17:15:00Z',
    window_text: 'date=2024-08-20 open=186.40 high=187.10 low=185.80 close=186.90 vol=41500000 | ... | date=2024-09-18 open=188.10 high=189.20 low=187.50 close=188.40 vol=295000000',
  },
  {
    id: 'pe-003', ticker: 'AAPL', window_start: '2024-10-01', window_end: '2024-10-30',
    poison_type: 'price_outlier', reason: 'Close price z-score σ=3.8 exceeded threshold (3.0)',
    sigma: 3.8, swing_ratio: null, vol_ratio: null, buffered: true,
    created_at: '2024-10-30T17:08:00Z',
    window_text: 'date=2024-10-01 open=185.60 high=186.30 low=185.10 close=185.90 vol=39800000 | ... | date=2024-10-30 open=195.80 high=196.50 low=195.20 close=196.10 vol=52000000',
  },
  {
    id: 'pe-013', ticker: 'AAPL', window_start: '2024-10-10', window_end: '2024-11-08',
    poison_type: 'stale_data', reason: 'Non-monotonic date sequence in window',
    sigma: null, swing_ratio: null, vol_ratio: null, buffered: false,
    created_at: '2024-11-08T17:15:00Z',
  },
  {
    id: 'pe-014', ticker: 'AAPL', window_start: '2024-10-15', window_end: '2024-11-12',
    poison_type: 'ohlc_violation', reason: 'Close price outside High-Low band on 2024-11-10',
    sigma: null, swing_ratio: null, vol_ratio: null, buffered: false,
    created_at: '2024-11-12T17:18:00Z',
  },
];

// ── Metrics snapshot ──
export const METRICS: Metrics = {
  current_cycle: 7,
  method: 'ascent_plus_descent',
  latest: {
    forget_ppl: 18.2,
    retain_ppl: 6.4,
    mae_validation: 1.82,
    directional_acc: 0.684,
    mia_auc: 0.58,
  },
  history: CYCLE_HISTORY,
  buffer_status: {
    forget_count: 3,
    retain_count: 87,
    trigger_at: 5,
    min_retain: 20,
  },
  last_ingest: '2024-01-15T17:02:34Z',
  next_ingest: '2024-01-16T17:00:00Z',
};

// ── Default config ──
export const DEFAULT_CONFIG: AppConfig = {
  sigma_thresh: 3.0,
  swing_thresh: 0.10,
  vol_multiplier: 5,
  forget_trigger: 5,
  min_retain: 20,
  learning_rate: '5e-6',
};

