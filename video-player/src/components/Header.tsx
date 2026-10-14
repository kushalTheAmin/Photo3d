import { ClipboardPaste, Keyboard, Loader2, PanelRight, Play, SlidersHorizontal } from 'lucide-react';
import { useRef } from 'react';
import { openUrl } from '../lib/controller';
import { MODE_LABEL } from '../lib/detect';
import { hasCustomHeaders } from '../lib/proxy';
import type { ModeOverride } from '../lib/types';
import { useSession } from '../store/session';

const MODES: ModeOverride[] = ['auto', 'direct', 'hls', 'dash', 'embed', 'web', 'web-direct'];

export async function pasteAndPlay(): Promise<void> {
  const { toast } = useSession.getState();
  try {
    if (!navigator.clipboard?.readText) throw new Error('unsupported');
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      toast('Clipboard is empty — copy a video link first.', 'info');
      return;
    }
    await openUrl(text);
  } catch {
    toast('Clipboard access was blocked. Press Ctrl+V / ⌘V anywhere on the page instead.', 'error');
  }
}

export function Header() {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValue = useSession((state) => state.inputValue);
  const detecting = useSession((state) => state.detecting);
  const modeOverride = useSession((state) => state.modeOverride);
  const advancedOpen = useSession((state) => state.advancedOpen);
  const headers = useSession((state) => state.headers);
  const forceProxy = useSession((state) => state.forceProxy);
  const sidebarOpen = useSession((state) => state.sidebarOpen);
  const theater = useSession((state) => state.theater);
  const set = useSession((state) => state.set);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void openUrl(inputValue);
    inputRef.current?.blur();
  };

  const optionsActive = hasCustomHeaders(headers) || forceProxy;

  return (
    <header className={`z-30 border-b border-white/5 bg-cinema-900/90 backdrop-blur ${theater ? 'py-1.5' : 'py-2.5'}`}>
      <div className="flex items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <button type="button" onClick={() => set({ source: null, inputValue: '' })} className="flex shrink-0 items-center gap-2" aria-label="Home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent shadow-glow">
            <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-white lg:block">
            Universal<span className="text-accent-soft">Play</span>
          </span>
        </button>

        <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 p-1 pl-3 focus-within:border-accent/60 focus-within:shadow-glow">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(event) => set({ inputValue: event.target.value })}
            placeholder="Paste any video link or webpage URL…"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white placeholder:text-white/35 outline-none"
            spellCheck={false}
            autoComplete="off"
            aria-label="Video or page URL"
            data-url-input
          />
          <select
            value={modeOverride}
            onChange={(event) => set({ modeOverride: event.target.value as ModeOverride })}
            className="hidden rounded-lg border border-white/10 bg-cinema-800 px-2 py-1.5 text-xs text-white/80 outline-none md:block"
            aria-label="Player mode"
            title="Player engine (Auto detects from extension, domain and MIME type)"
          >
            {MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === 'auto' ? 'Auto-detect' : MODE_LABEL[mode]}
              </option>
            ))}
          </select>
          <button type="submit" disabled={detecting} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-60" aria-label="Play">
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="hidden sm:inline">Play</span>
          </button>
        </form>

        <button type="button" onClick={() => void pasteAndPlay()} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-accent-soft" title="Read the clipboard and play">
          <ClipboardPaste className="h-4 w-4" />
          <span className="hidden sm:inline">Paste &amp; Play</span>
        </button>

        <button
          type="button"
          onClick={() => set({ advancedOpen: !advancedOpen })}
          className={`relative shrink-0 rounded-xl p-2 transition hover:bg-white/10 ${advancedOpen ? 'bg-white/10 text-white' : 'text-white/70'}`}
          title="Advanced stream options"
          aria-label="Advanced stream options"
          aria-expanded={advancedOpen}
        >
          <SlidersHorizontal className="h-5 w-5" />
          {optionsActive && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />}
        </button>
        <button type="button" onClick={() => set({ shortcutsOpen: true })} className="hidden shrink-0 rounded-xl p-2 text-white/70 hover:bg-white/10 sm:block" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
          <Keyboard className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => set({ sidebarOpen: !sidebarOpen, theater: false })} className={`shrink-0 rounded-xl p-2 hover:bg-white/10 ${sidebarOpen && !theater ? 'text-white' : 'text-white/70'}`} title="History & playlists" aria-label="Toggle sidebar">
          <PanelRight className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
