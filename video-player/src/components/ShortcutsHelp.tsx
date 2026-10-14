import { X } from 'lucide-react';
import { useSession } from '../store/session';

const SHORTCUTS: [string[], string][] = [
  [['Space', 'K'], 'Play / Pause'],
  [['←', '→'], 'Seek 5 seconds'],
  [['J', 'L'], 'Seek 10 seconds'],
  [['↑', '↓'], 'Volume ±5% (up to 200%)'],
  [['M'], 'Mute'],
  [['F'], 'Fullscreen'],
  [['P'], 'Picture-in-Picture'],
  [['T'], 'Theater mode'],
  [['C'], 'Toggle subtitles'],
  [['<', '>'], 'Slower / faster'],
  [['0–9'], 'Jump to 0–90%'],
  [['Ctrl/⌘ + V'], 'Paste a link and play'],
  [['/'], 'Focus the URL bar'],
  [['?'], 'Show this help'],
];

export function ShortcutsHelp() {
  const open = useSession((state) => state.shortcutsOpen);
  const set = useSession((state) => state.set);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in" onClick={() => set({ shortcutsOpen: false })}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-cinema-900 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Keyboard shortcuts</h2>
          <button type="button" onClick={() => set({ shortcutsOpen: false })} className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="contents">
              <dt className="flex gap-1">
                {keys.map((key) => (
                  <kbd key={key} className="kbd">
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-white/70">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
