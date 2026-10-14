import { Clapperboard, Copy, Film, Loader2, Play, Radio, Shield, X } from 'lucide-react';
import { playCandidate } from '../lib/controller';
import { hostOf } from '../lib/format';
import type { SniffCandidate } from '../lib/types';
import { useSession } from '../store/session';

const KIND_META: Record<SniffCandidate['kind'], { label: string; className: string; icon: typeof Film }> = {
  hls: { label: 'HLS', className: 'bg-emerald-500/15 text-emerald-300', icon: Radio },
  dash: { label: 'DASH', className: 'bg-sky-500/15 text-sky-300', icon: Radio },
  video: { label: 'FILE', className: 'bg-amber-500/15 text-amber-300', icon: Film },
  embed: { label: 'EMBED', className: 'bg-fuchsia-500/15 text-fuchsia-300', icon: Clapperboard },
};

export function SniffPanel({ onRescan }: { onRescan: () => void }) {
  const sniff = useSession((state) => state.sniff);
  const set = useSession((state) => state.set);
  const toast = useSession((state) => state.toast);

  if (!sniff.panelOpen) return null;

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm animate-slide-up flex-col border-l border-white/10 bg-cinema-900/95 backdrop-blur" aria-label="Extracted videos">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Extracted video sources</h3>
          <p className="text-xs text-white/50">
            {sniff.items.length} found{sniff.mseVideoCount > 0 ? ` · ${sniff.mseVideoCount} MSE player(s) on page` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onRescan} disabled={sniff.scanning} className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50">
            {sniff.scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Rescan'}
          </button>
          <button type="button" onClick={() => set({ sniff: { ...sniff, panelOpen: false } })} className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {sniff.items.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-white/50">
            {sniff.scanning ? 'Scanning page markup and network activity…' : 'Nothing yet. Press play inside the page — streams are captured as they load — then rescan.'}
            {sniff.serverError && <p className="mt-2 text-xs text-accent-soft">{sniff.serverError}</p>}
          </div>
        )}
        {sniff.items.map((item) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          return (
            <div key={item.url} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.className}`}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
                <span className="truncate text-[11px] text-white/40">{item.source}</span>
              </div>
              <p className="break-all font-mono text-[11px] leading-snug text-white/75" title={item.url}>
                <span className="text-white/40">{hostOf(item.url)}</span>
                {(() => {
                  try {
                    const parsed = new URL(item.url);
                    return parsed.pathname + (parsed.search.length > 60 ? `${parsed.search.slice(0, 60)}…` : parsed.search);
                  } catch {
                    return item.url;
                  }
                })()}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => playCandidate(item, sniff.pageUrl, sniff.title, false)} className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent-soft">
                  <Play className="h-3 w-3 fill-white" /> Play
                </button>
                {item.kind !== 'embed' && (
                  <button
                    type="button"
                    onClick={() => playCandidate(item, sniff.pageUrl, sniff.title, true)}
                    className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20"
                    title="Fetch through the proxy with this page as Referer/Origin (beats hotlink protection)"
                  >
                    <Shield className="h-3 w-3" /> Proxy + Referer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(item.url).then(
                      () => toast('Link copied', 'success'),
                      () => toast('Clipboard unavailable', 'error'),
                    );
                  }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
