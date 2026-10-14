import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { ACTION_LABEL } from '../../lib/diagnostics';
import type { Diagnosis, RecoveryAction } from '../../lib/types';

interface ErrorOverlayProps {
  diagnosis: Diagnosis | null;
  diagnosing: boolean;
  onAction: (action: RecoveryAction) => void;
}

export function ErrorOverlay({ diagnosis, diagnosing, onAction }: ErrorOverlayProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  if (!diagnosis && !diagnosing) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in" onClick={(event) => event.stopPropagation()}>
      {diagnosing || !diagnosis ? (
        <div className="flex items-center gap-3 text-white/80">
          <Loader2 className="h-5 w-5 animate-spin" />
          Diagnosing playback failure…
        </div>
      ) : (
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-cinema-900/95 p-5 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-accent/15 p-2 text-accent">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-soft">{diagnosis.code.replace('-', ' ')}</p>
              <h3 className="text-lg font-semibold text-white">{diagnosis.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/70">{diagnosis.detail}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {diagnosis.actions.map((action, index) => (
              <button
                key={action}
                type="button"
                onClick={() => onAction(action)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${index === 0 ? 'bg-accent text-white hover:bg-accent-soft' : 'bg-white/10 text-white/90 hover:bg-white/20'}`}
              >
                {ACTION_LABEL[action]}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowTechnical((value) => !value)} className="mt-4 flex items-center gap-1 text-xs text-white/40 hover:text-white/70">
            <ChevronDown className={`h-3.5 w-3.5 transition ${showTechnical ? 'rotate-180' : ''}`} /> Technical details
          </button>
          {showTechnical && <pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-black/50 p-2 font-mono text-[11px] text-white/60">{diagnosis.technical}</pre>}
        </div>
      )}
    </div>
  );
}
