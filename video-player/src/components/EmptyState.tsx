import { ClipboardPaste, Film, Globe, MousePointerClick, Radio, Tv } from 'lucide-react';
import { openUrl } from '../lib/controller';
import { pasteAndPlay } from './Header';

const SAMPLES = [
  { label: 'Big Buck Bunny · MP4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', kind: 'Direct file' },
  { label: 'Big Buck Bunny · HLS', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', kind: 'HLS · multi-bitrate' },
  { label: 'Sintel · HLS + subtitles', url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', kind: 'HLS · subs + audio' },
  { label: 'Big Buck Bunny · DASH', url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd', kind: 'MPEG-DASH' },
  { label: 'Blender short · YouTube', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', kind: 'Platform embed' },
  { label: 'Wikimedia Commons page', url: 'https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_4K.webm', kind: 'Webpage → sniff' },
];

const ENGINES = [
  { icon: Film, title: 'Direct files', text: 'MP4, WebM, OGG, MOV, MKV' },
  { icon: Radio, title: 'Adaptive streams', text: 'HLS .m3u8 & DASH .mpd' },
  { icon: Tv, title: 'Platforms', text: 'YouTube, Vimeo, Twitch, Dailymotion, Streamable' },
  { icon: Globe, title: 'Any webpage', text: 'Sandboxed browser + video sniffer' },
];

export function EmptyState() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-12 text-center sm:py-20">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 ring-1 ring-accent/30">
        <MousePointerClick className="h-8 w-8 text-accent-soft" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Paste any link. Watch anything.</h1>
      <p className="mt-3 max-w-xl text-white/55">
        Drop a video URL, stream manifest or webpage. The player picks the right engine automatically — or press <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">V</kbd> anywhere.
      </p>
      <button type="button" onClick={() => void pasteAndPlay()} className="mt-8 flex items-center gap-2 rounded-2xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-glow transition hover:scale-[1.02] hover:bg-accent-soft">
        <ClipboardPaste className="h-5 w-5" /> Paste &amp; Play
      </button>

      <div className="mt-12 grid w-full grid-cols-2 gap-3 md:grid-cols-4">
        {ENGINES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left">
            <Icon className="mb-2 h-5 w-5 text-accent-soft" />
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-0.5 text-xs text-white/45">{text}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 w-full text-left">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Try a sample</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLES.map((sample) => (
            <button key={sample.url} type="button" onClick={() => void openUrl(sample.url)} className="group rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left transition hover:border-accent/40 hover:bg-white/[0.05]">
              <p className="text-sm font-medium text-white/90 group-hover:text-white">{sample.label}</p>
              <p className="mt-0.5 text-[11px] text-white/40">{sample.kind}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
