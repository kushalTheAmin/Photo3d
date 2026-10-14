import { Bookmark, BookmarkCheck, Copy, ExternalLink, ScanSearch, Shield } from 'lucide-react';
import { describeSource, openUrl } from '../lib/controller';
import { MODE_LABEL } from '../lib/detect';
import { hasCustomHeaders } from '../lib/proxy';
import type { Source } from '../lib/types';
import { BOOKMARKS_ID, useLibrary } from '../store/library';
import { useSession } from '../store/session';

export function InfoBar({ source }: { source: Source }) {
  const toggleBookmark = useLibrary((state) => state.toggleBookmark);
  const bookmarked = useLibrary((state) => state.playlists.find((playlist) => playlist.id === BOOKMARKS_ID)?.items.some((item) => item.url === source.url) ?? false);
  const toast = useSession((state) => state.toast);

  const copy = () =>
    navigator.clipboard?.writeText(source.url).then(
      () => toast('Link copied', 'success'),
      () => toast('Clipboard unavailable', 'error'),
    );

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-1 pt-3">
      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-2 text-base font-semibold text-white sm:text-lg">{source.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-white/45">
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold text-white/80">{MODE_LABEL[source.mode]}</span>
          {source.useProxy && (
            <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300">
              <Shield className="h-3 w-3" /> via proxy{hasCustomHeaders(source.headers) ? ' + headers' : ''}
            </span>
          )}
          <span>{describeSource(source)}</span>
          <span className="hidden sm:inline">· {source.detectReason}</span>
        </div>
      </div>
      {!source.local && (
        <div className="flex shrink-0 items-center gap-1">
          {(source.mode === 'direct' || source.mode === 'hls' || source.mode === 'dash') && source.pageUrl && (
            <button type="button" onClick={() => void openUrl(source.pageUrl as string, { mode: 'web' })} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white" title="Back to the page this video came from">
              <ScanSearch className="h-4 w-4" /> Source page
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const added = toggleBookmark({ url: source.url, title: source.title, mode: source.mode });
              toast(added ? 'Bookmarked' : 'Bookmark removed', 'success');
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          >
            {bookmarked ? <BookmarkCheck className="h-4 w-4 text-accent-soft" /> : <Bookmark className="h-4 w-4" />}
            <span className="hidden sm:inline">{bookmarked ? 'Bookmarked' : 'Bookmark'}</span>
          </button>
          <button type="button" onClick={() => void copy()} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" title="Copy link" aria-label="Copy link">
            <Copy className="h-4 w-4" />
          </button>
          <a href={source.embed?.watchUrl ?? source.url} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" title="Open original" aria-label="Open original">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}
