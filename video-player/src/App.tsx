import { Link2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AdvancedOptions } from './components/AdvancedOptions';
import { BrowserView } from './components/BrowserView';
import { EmbedPlayer } from './components/EmbedPlayer';
import { EmptyState } from './components/EmptyState';
import { Header } from './components/Header';
import { InfoBar } from './components/InfoBar';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { Sidebar } from './components/Sidebar';
import { Toasts } from './components/Toasts';
import { VideoPlayer, type PlayerHandle } from './components/player/VideoPlayer';
import { useGlobalInput } from './hooks/useGlobalInput';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { checkProxyHealth } from './lib/api';
import { openUrl } from './lib/controller';
import type { Source } from './lib/types';
import { useLibrary } from './store/library';
import { useSession } from './store/session';

function Viewport({ source, playerRef }: { source: Source; playerRef: React.RefObject<PlayerHandle> }) {
  switch (source.mode) {
    case 'embed':
      return <EmbedPlayer key={source.loadId} source={source} />;
    case 'web':
    case 'web-direct':
      return <BrowserView key={source.loadId} source={source} />;
    default:
      return <VideoPlayer key={source.loadId} ref={playerRef} source={source} />;
  }
}

export default function App() {
  const playerRef = useRef<PlayerHandle>(null);
  const source = useSession((state) => state.source);
  const sidebarOpen = useSession((state) => state.sidebarOpen);
  const theater = useSession((state) => state.theater);
  const proxyBase = useLibrary((state) => state.settings.proxyBase);
  const dragActive = useGlobalInput();
  useKeyboardShortcuts(playerRef);

  useEffect(() => {
    void checkProxyHealth(proxyBase).then((online) => useSession.getState().set({ proxyOnline: online }));
  }, [proxyBase]);

  // Deep links: /?url=<link> (also used by the bookmarklet in the README).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('url') ?? params.get('v');
    if (shared) {
      void openUrl(shared);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    document.title = source ? `${source.title} · Universal Play` : 'Universal Play — paste any video link';
  }, [source]);

  return (
    <div className="flex h-full flex-col bg-cinema-950 text-white">
      <Header />
      <AdvancedOptions />
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto">
          {source ? (
            <div className={theater ? 'px-0 pb-4' : 'mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6'}>
              <Viewport source={source} playerRef={playerRef} />
              <div className={theater ? 'mx-auto max-w-6xl px-4' : ''}>
                <InfoBar source={source} />
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </main>
        {sidebarOpen && !theater && <Sidebar />}
      </div>

      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-cinema-950/85 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-accent/60 px-16 py-12 text-center">
            <Link2 className="h-10 w-10 text-accent-soft" />
            <p className="text-xl font-semibold text-white">Drop to play</p>
            <p className="text-sm text-white/50">Links, video files, or .srt / .vtt subtitles</p>
          </div>
        </div>
      )}
      <ShortcutsHelp />
      <Toasts />
    </div>
  );
}
