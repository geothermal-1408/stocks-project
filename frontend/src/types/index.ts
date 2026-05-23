export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
}

export interface PoisonAnnotation {
  date: string;
  type: string;
  sigma?: number;
  swing_ratio?: number;
  vol_ratio?: number;
  reason?: string;
}

export interface Prediction {
  ticker: string;
  pred_date: string;
  prediction: {
    open: number;
    high: number;
    low: number;
    close: number;
    vol: number;
  };
  confidence: {
    close_high: number;
    close_low: number;
  };
  directional: 'up' | 'down';
  directional_pct: number;
  model_cycle: number;
  method: string;
  mae: number;
  samples: number;
  generated_at: string;
}

export interface CycleRecord {
  cycle_num: number;
  date: string;
  method: string;
  forget_ppl: number;
  retain_ppl: number;
  mae_validation: number;
  directional_acc: number;
  mia_auc: number;
  forget_count: number;
  retain_count: number;
  duration_sec: number;
  deployed: boolean;
  gate_failure: string | null;
  gates: GateResult[];
}

export interface GateResult {
  name: string;
  passed: boolean;
  value: number;
  threshold: string;
}

export interface Metrics {
  current_cycle: number;
  method: string;
  latest: {
    forget_ppl: number;
    retain_ppl: number;
    mae_validation: number;
    directional_acc: number;
    mia_auc: number;
  };
  history: CycleRecord[];
  buffer_status: {
    forget_count: number;
    retain_count: number;
    trigger_at: number;
    min_retain: number;
  };
  last_ingest: string;
  next_ingest: string;
}

export interface PoisonEvent {
  id: string;
  ticker: string;
  window_start: string;
  window_end: string;
  poison_type: PoisonType;
  reason: string;
  sigma: number | null;
  swing_ratio: number | null;
  vol_ratio: number | null;
  buffered: boolean;
  created_at: string;
  window_text?: string;
}

export type PoisonType =
  | 'price_outlier'
  | 'flash_crash'
  | 'volume_spike'
  | 'negative_price'
  | 'ohlc_violation'
  | 'stale_data'
  | 'regime_change';

export type PipelineStatus = 'idle' | 'ingesting' | 'unlearning';

export interface PipelineState {
  status: PipelineStatus;
  ticker?: string;
  progress?: number;
  total?: number;
  cycle?: number;
  method?: string;
  epoch?: string;
}

export interface AppConfig {
  sigma_thresh: number;
  swing_thresh: number;
  vol_multiplier: number;
  forget_trigger: number;
  min_retain: number;
  learning_rate: string;
}

// ── Portfolio types ─────────────────────────────────────────────────────

export interface Holding {
  ticker: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  total_invested: number;
  current_price: number;
  value: number;
  gain: number;
  gain_pct: number;

  current_value: number;
  predicted_value: number;
  unrealised_pnl: number;
  unrealised_pnl_pct: number;
  created_at: string;
  units_held: number;
  avg_buy_price: number;
}

export interface InvestmentTransaction {
  id: string;
  user_email: string;
  ticker: string;
  action: 'buy' | 'sell' | 'withdraw';
  amount_inr: number;
  units: number;
  price_at_time: number;
  created_at: string;
}

export interface PortfolioPnLPoint {
  date: string;
  portfolio_value: number;
  total_invested: number;
  pnl: number;
}

export interface PortfolioSummary {
  total_invested: number;
  current_value: number;
  predicted_value: number;
  total_unrealised_pnl: number;
  total_unrealised_pnl_pct: number;
  holdings: Holding[];
}

