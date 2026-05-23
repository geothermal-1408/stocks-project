import { useAppStore } from '../../store/appStore';

export default function PipelineStatusBanner() {
  const { pipelineState } = useAppStore();

  if (!pipelineState || pipelineState.status === 'idle') {
    return null;
  }

  const isIngesting = pipelineState.status === 'ingesting';
  const isUnlearning = pipelineState.status === 'unlearning';

  return (
    <div
      className={`w-full px-4 py-2 flex items-center gap-3 text-xs font-mono border-b ${
        isIngesting
          ? 'bg-accent-cyan/5 border-accent-cyan/20 text-accent-cyan'
          : isUnlearning
          ? 'bg-accent-warning/5 border-accent-warning/20 text-accent-warning'
          : 'bg-bg-panel border-border text-text-muted'
      }`}
    >
      <div className="w-2 h-2 rounded-full animate-pulse bg-current" />
      <span className="uppercase tracking-wider font-bold">
        {pipelineState.status}
      </span>
      {pipelineState.ticker && (
        <span className="text-text-muted">· {pipelineState.ticker}</span>
      )}
      {pipelineState.progress !== undefined && pipelineState.total !== undefined && (
        <span className="text-text-muted">
          {pipelineState.progress}/{pipelineState.total}
        </span>
      )}
      {pipelineState.cycle && (
        <span className="text-text-muted">Cycle {pipelineState.cycle}</span>
      )}
      {pipelineState.method && (
        <span className="text-text-muted">({pipelineState.method})</span>
      )}
    </div>
  );
}
