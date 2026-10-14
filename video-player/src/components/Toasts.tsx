import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useSession } from '../store/session';

const ICONS = { info: Info, success: CheckCircle2, error: XCircle };
const TONES = { info: 'text-sky-300', success: 'text-emerald-300', error: 'text-accent-soft' };

export function Toasts() {
  const toasts = useSession((state) => state.toasts);
  const dismiss = useSession((state) => state.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div key={toast.id} className="pointer-events-auto flex animate-slide-up items-start gap-3 rounded-xl border border-white/10 bg-cinema-800/95 px-3.5 py-2.5 text-sm text-white shadow-2xl backdrop-blur">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONES[toast.tone]}`} />
            <span className="flex-1 leading-snug text-white/90">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run();
                  dismiss(toast.id);
                }}
                className="shrink-0 font-semibold text-accent-soft hover:underline"
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" onClick={() => dismiss(toast.id)} className="shrink-0 text-white/40 hover:text-white" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
