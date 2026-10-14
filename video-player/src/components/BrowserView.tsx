import { ArrowLeft, ArrowRight, ExternalLink, Loader2, RotateCw, ScanSearch, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { openUrl, runServerSniff } from '../lib/controller';
import { normalizeInput } from '../lib/detect';
import { hostOf } from '../lib/format';
import { buildPageUrl } from '../lib/proxy';
import type { ModeOverride, SniffCandidate, Source } from '../lib/types';
import { useLibrary } from '../store/library';
import { useSession } from '../store/session';
import { SniffPanel } from './SniffPanel';

interface SnifferMessage {
  __uvp: true;
  type: 'ready' | 'media-found' | 'page-info' | 'navigate' | 'loaded' | 'non-html' | 'page-error';
  items?: SniffCandidate[];
  url?: string;
  kind?: string;
  title?: string;
  pageUrl?: string;
  mseVideoCount?: number;
  message?: string;
  status?: number;
}

const KIND_TO_MODE: Record<string, ModeOverride> = { hls: 'hls', dash: 'dash', video: 'direct', audio: 'direct' };

/**
 * Built-in browser. "web" mode loads the page through the proxy (frame-blocking
 * headers stripped, sniffer injected) inside a sandbox with an opaque origin;
 * "web-direct" frames the real site, sandboxed, with no injection.
 */
export function BrowserView({ source }: { source: Source }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const proxyBase = useLibrary((state) => state.settings.proxyBase);
  const theater = useSession((state) => state.theater);
  const sniff = useSession((state) => state.sniff);
  const [nav, setNav] = useState({ stack: [source.url], index: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState(source.url);
  const proxied = source.mode === 'web';
  const current = nav.stack[nav.index];
  const frameSrc = proxied ? buildPageUrl(current, source.headers, proxyBase) : current;

  const navigate = useCallback((url: string) => {
    setNav((state) => ({ stack: [...state.stack.slice(0, state.index + 1), url], index: state.index + 1 }));
  }, []);

  useEffect(() => {
    setAddress(current);
    setLoading(true);
    const session = useSession.getState();
    if (session.sniff.pageUrl !== current) session.resetSniff(current);
    session.set({ inputValue: current });
    if (current !== source.url) useLibrary.getState().recordPlay({ url: current, title: hostOf(current), mode: source.mode });
  }, [current, source.mode, source.url]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as SnifferMessage;
      if (!data || data.__uvp !== true) return;
      const session = useSession.getState();
      switch (data.type) {
        case 'media-found':
          if (data.items?.length) session.addSniffItems(data.items);
          break;
        case 'page-info':
          useSession.setState((state) => ({ sniff: { ...state.sniff, title: data.title || state.sniff.title, mseVideoCount: data.mseVideoCount ?? state.sniff.mseVideoCount } }));
          break;
        case 'loaded':
          setLoading(false);
          if (data.title) {
            useSession.setState((state) => ({ sniff: { ...state.sniff, title: data.title as string } }));
            useLibrary.getState().updateHistoryMeta(current, { title: data.title });
          }
          break;
        case 'navigate':
          if (data.url && /^https?:/i.test(data.url)) navigate(data.url);
          break;
        case 'non-html':
          if (data.url) {
            session.toast('That link is media — switching to the player.', 'info');
            void openUrl(data.url, { mode: KIND_TO_MODE[data.kind ?? ''] ?? 'auto', pageUrl: nav.index > 0 ? nav.stack[nav.index - 1] : source.pageUrl });
          }
          break;
        case 'page-error':
          setLoading(false);
          session.toast(`Page failed to load: ${data.message ?? 'unknown error'}`, 'error', { label: 'Try direct iframe', run: () => void openUrl(current, { mode: 'web-direct' }) });
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [current, nav, navigate, source.pageUrl]);

  const extract = () => {
    iframeRef.current?.contentWindow?.postMessage({ __uvpHost: true, type: 'scan' }, '*');
    void runServerSniff(current);
  };

  const submitAddress = (event: React.FormEvent) => {
    event.preventDefault();
    const url = normalizeInput(address);
    if (url) navigate(url);
  };

  const height = theater ? 'h-[calc(100vh-8.5rem)]' : 'h-[min(75vh,820px)]';

  return (
    <div className={`relative flex w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-cinema-900 ${height} min-h-[360px]`}>
      <div className="flex items-center gap-1 border-b border-white/10 bg-cinema-850 px-2 py-1.5">
        <button type="button" disabled={nav.index === 0} onClick={() => setNav((state) => ({ ...state, index: state.index - 1 }))} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-30" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button type="button" disabled={nav.index >= nav.stack.length - 1} onClick={() => setNav((state) => ({ ...state, index: state.index + 1 }))} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-30" aria-label="Forward">
          <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="rounded-md p-1.5 text-white/70 hover:bg-white/10" aria-label="Reload">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
        </button>
        <form onSubmit={submitAddress} className="mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-md bg-black/40 px-2.5 py-1">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="Sandboxed" />
          <input value={address} onChange={(event) => setAddress(event.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white/80 outline-none" spellCheck={false} aria-label="Page address" />
        </form>
        <div className="hidden overflow-hidden rounded-md border border-white/10 text-[11px] sm:flex">
          <button type="button" onClick={() => !proxied && void openUrl(current, { mode: 'web' })} className={`px-2 py-1 ${proxied ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`} title="Load through the proxy with the live video sniffer">
            Proxied + Sniffer
          </button>
          <button type="button" onClick={() => proxied && void openUrl(current, { mode: 'web-direct' })} className={`px-2 py-1 ${!proxied ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`} title="Frame the real site directly (works when a site allows embedding)">
            Direct
          </button>
        </div>
        <button type="button" onClick={extract} className="relative ml-1 flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent-soft">
          <ScanSearch className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Extract / Sniff Video</span>
          <span className="md:hidden">Sniff</span>
          {sniff.items.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-accent">{sniff.items.length}</span>}
        </button>
        <a href={current} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Open in new tab">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <div className="relative flex-1 bg-white">
        <iframe
          key={`${frameSrc}#${reloadKey}`}
          ref={iframeRef}
          src={frameSrc}
          title="Sandboxed browser"
          className="absolute inset-0 h-full w-full"
          sandbox={proxied ? 'allow-scripts allow-forms allow-presentation allow-pointer-lock' : 'allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock'}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setLoading(false)}
        />
        {!proxied && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 text-[11px] text-white/70">
            Direct mode: if the page stays blank the site forbids framing — switch to <b>Proxied + Sniffer</b>. Live network sniffing is only available in proxied mode; Extract still scans the page server-side.
          </div>
        )}
        <SniffPanel onRescan={extract} />
      </div>
    </div>
  );
}
