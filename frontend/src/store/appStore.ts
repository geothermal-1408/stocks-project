import { create } from 'zustand';
import type { PipelineState, AppConfig } from '../types';
import { DEFAULT_CONFIG } from '../data/mockData';

interface AppStore {
  // Ticker selection
  selectedTicker: string;
  setSelectedTicker: (ticker: string) => void;

  // Pipeline status
  pipelineState: PipelineState;
  setPipelineState: (state: PipelineState) => void;

  // Poison flash
  poisonFlashActive: boolean;
  triggerPoisonFlash: () => void;

  // Config
  config: AppConfig;
  setConfig: (config: Partial<AppConfig>) => void;

  // Expanded rows
  expandedCycleRows: Set<number>;
  toggleCycleRow: (cycle: number) => void;

  expandedPoisonRows: Set<string>;
  togglePoisonRow: (id: string) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Ticker
  selectedTicker: 'AAPL',
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),

  // Pipeline
  pipelineState: { status: 'idle' },
  setPipelineState: (state) => set({ pipelineState: state }),

  // Poison flash
  poisonFlashActive: false,
  triggerPoisonFlash: () => {
    set({ poisonFlashActive: true });
    setTimeout(() => set({ poisonFlashActive: false }), 800);
  },

  // Config
  config: { ...DEFAULT_CONFIG },
  setConfig: (partial) => set({ config: { ...get().config, ...partial } }),

  // Expanded rows
  expandedCycleRows: new Set(),
  toggleCycleRow: (cycle) => {
    const current = new Set(get().expandedCycleRows);
    if (current.has(cycle)) current.delete(cycle);
    else current.add(cycle);
    set({ expandedCycleRows: current });
  },

  expandedPoisonRows: new Set(),
  togglePoisonRow: (id) => {
    const current = new Set(get().expandedPoisonRows);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    set({ expandedPoisonRows: current });
  },
}));
