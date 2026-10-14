import { ArrowDown, ArrowUp, Bookmark, BookmarkCheck, Download, Film, Globe, ListPlus, Pencil, Play, Plus, Radio, Search, Trash2, Tv, Upload, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { openUrl } from '../lib/controller';
import { formatRelative, formatTime, hostOf } from '../lib/format';
import type { PlayerMode } from '../lib/types';
import { BOOKMARKS_ID, useLibrary, type HistoryEntry } from '../store/library';
import { useSession } from '../store/session';

const MODE_ICON: Record<PlayerMode, typeof Film> = {
  direct: Film,
  hls: Radio,
  dash: Radio,
  embed: Tv,
  web: Globe,
  'web-direct': Globe,
};

function AddToPlaylistMenu({ entry, onClose }: { entry: { url: string; title: string; mode: PlayerMode }; onClose: () => void }) {
  const playlists = useLibrary((state) => state.playlists);
  const addToPlaylist = useLibrary((state) => state.addToPlaylist);
  const createPlaylist = useLibrary((state) => state.createPlaylist);
  const toast = useSession((state) => state.toast);
  const [name, setName] = useState('');
  return (
    <div className="absolute right-2 top-9 z-30 w-56 animate-slide-up rounded-lg border border-white/10 bg-cinema-800 p-1.5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      {playlists.map((playlist) => (
        <button
          key={playlist.id}
          type="button"
          className="block w-full truncate rounded px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/10"
          onClick={() => {
            addToPlaylist(playlist.id, entry);
            toast(`Added to "${playlist.name}"`, 'success');
            onClose();
          }}
        >
          {playlist.name} <span className="text-white/35">({playlist.items.length})</span>
        </button>
      ))}
      <form
        className="mt-1 flex gap-1 border-t border-white/10 pt-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          const id = createPlaylist(name);
          addToPlaylist(id, entry);
          toast(`Created "${name.trim()}"`, 'success');
          onClose();
        }}
      >
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New playlist…" className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1 text-xs text-white outline-none" autoFocus />
        <button type="submit" className="rounded bg-accent px-2 text-xs text-white" aria-label="Create playlist">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

function HistoryItem({ entry, active }: { entry: HistoryEntry; active: boolean }) {
  const [menu, setMenu] = useState(false);
  const removeHistory = useLibrary((state) => state.removeHistory);
  const toggleBookmark = useLibrary((state) => state.toggleBookmark);
  const bookmarked = useLibrary((state) => state.playlists.find((playlist) => playlist.id === BOOKMARKS_ID)?.items.some((item) => item.url === entry.url) ?? false);
  const Icon = MODE_ICON[entry.mode] ?? Film;
  const progress = entry.duration > 0 ? Math.min(100, (entry.position / entry.duration) * 100) : 0;

  return (
    <li className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => void openUrl(entry.url, { mode: entry.mode })}
        onKeyDown={(event) => event.key === 'Enter' && void openUrl(entry.url, { mode: entry.mode })}
        className={`group flex cursor-pointer gap-3 rounded-lg p-2 transition hover:bg-white/5 ${active ? 'bg-white/[0.07] ring-1 ring-accent/40' : ''}`}
      >
        <div className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-cinema-700">
          {entry.thumbnail ? <img src={entry.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <Icon className="h-5 w-5 text-white/30" />}
          {progress > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20">
              <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-medium leading-snug text-white/90" title={entry.title}>
            {entry.title}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-white/40">
            {hostOf(entry.url)} · {formatRelative(entry.updatedAt)}
            {entry.position > 5 && entry.duration > 0 ? ` · ${formatTime(entry.position)}` : ''}
          </p>
        </div>
        <div className="absolute right-1 top-1 hidden gap-0.5 rounded-md bg-cinema-800/95 p-0.5 group-hover:flex" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => toggleBookmark({ url: entry.url, title: entry.title, mode: entry.mode })} className="rounded p-1 text-white/60 hover:text-white" aria-label="Bookmark">
            {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5 text-accent-soft" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => setMenu((value) => !value)} className="rounded p-1 text-white/60 hover:text-white" aria-label="Add to playlist">
            <ListPlus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => removeHistory(entry.url)} className="rounded p-1 text-white/60 hover:text-white" aria-label="Remove from history">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {menu && <AddToPlaylistMenu entry={entry} onClose={() => setMenu(false)} />}
    </li>
  );
}

function HistoryTab() {
  const history = useLibrary((state) => state.history);
  const clearHistory = useLibrary((state) => state.clearHistory);
  const activeUrl = useSession((state) => state.source?.url);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return history;
    return history.filter((entry) => entry.title.toLowerCase().includes(needle) || entry.url.toLowerCase().includes(needle));
  }, [history, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 pb-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-black/30 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-white/40" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search history" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30" />
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => window.confirm('Clear the entire watch history?') && clearHistory()}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
            title="Clear history"
            aria-label="Clear history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-3">
        {filtered.length === 0 && <li className="px-3 py-8 text-center text-xs text-white/35">{history.length ? 'No matches.' : 'Links you play show up here, with resume positions.'}</li>}
        {filtered.map((entry) => (
          <HistoryItem key={entry.url} entry={entry} active={entry.url === activeUrl} />
        ))}
      </ul>
    </div>
  );
}

function PlaylistsTab() {
  const playlists = useLibrary((state) => state.playlists);
  const createPlaylist = useLibrary((state) => state.createPlaylist);
  const renamePlaylist = useLibrary((state) => state.renamePlaylist);
  const deletePlaylist = useLibrary((state) => state.deletePlaylist);
  const addToPlaylist = useLibrary((state) => state.addToPlaylist);
  const removeFromPlaylist = useLibrary((state) => state.removeFromPlaylist);
  const moveInPlaylist = useLibrary((state) => state.moveInPlaylist);
  const source = useSession((state) => state.source);
  const toast = useSession((state) => state.toast);
  const [expanded, setExpanded] = useState<string>(BOOKMARKS_ID);
  const [newName, setNewName] = useState('');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form
        className="flex gap-1.5 px-3 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!newName.trim()) return;
          setExpanded(createPlaylist(newName));
          setNewName('');
        }}
      >
        <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="New playlist name" className="min-w-0 flex-1 rounded-lg bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/30" />
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs text-white hover:bg-white/20">
          <Plus className="h-3.5 w-3.5" /> Create
        </button>
      </form>
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
        {playlists.map((playlist) => {
          const open = expanded === playlist.id;
          return (
            <div key={playlist.id} className="rounded-lg border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-1 px-2 py-1.5">
                <button type="button" onClick={() => setExpanded(open ? '' : playlist.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {playlist.id === BOOKMARKS_ID ? <Bookmark className="h-3.5 w-3.5 shrink-0 text-accent-soft" /> : <ListPlus className="h-3.5 w-3.5 shrink-0 text-white/50" />}
                  <span className="truncate text-xs font-semibold text-white/90">{playlist.name}</span>
                  <span className="text-[11px] text-white/35">{playlist.items.length}</span>
                </button>
                {playlist.items.length > 0 && (
                  <button type="button" onClick={() => void openUrl(playlist.items[0].url, { mode: playlist.items[0].mode, playlistId: playlist.id, title: playlist.items[0].title, startAt: 0 })} className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white" title="Play all" aria-label="Play all">
                    <Play className="h-3.5 w-3.5" />
                  </button>
                )}
                {source && !source.local && (
                  <button
                    type="button"
                    onClick={() => {
                      addToPlaylist(playlist.id, { url: source.url, title: source.title, mode: source.mode });
                      toast(`Added to "${playlist.name}"`, 'success');
                    }}
                    className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
                    title="Add current video"
                    aria-label="Add current video"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
                {playlist.id !== BOOKMARKS_ID && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const name = window.prompt('Rename playlist', playlist.name);
                        if (name) renamePlaylist(playlist.id, name);
                      }}
                      className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
                      aria-label="Rename playlist"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => window.confirm(`Delete "${playlist.name}"?`) && deletePlaylist(playlist.id)} className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Delete playlist">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
              {open && (
                <ul className="border-t border-white/5 py-1">
                  {playlist.items.length === 0 && <li className="px-3 py-3 text-center text-[11px] text-white/35">Empty — use + to add the current video.</li>}
                  {playlist.items.map((item, index) => (
                    <li key={item.id} className={`group flex items-center gap-2 px-2 py-1 hover:bg-white/5 ${source?.url === item.url ? 'bg-white/[0.06]' : ''}`}>
                      <span className="w-4 text-right font-mono text-[10px] text-white/30">{index + 1}</span>
                      <button type="button" onClick={() => void openUrl(item.url, { mode: item.mode, playlistId: playlist.id, title: item.title })} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-xs text-white/85">{item.title}</p>
                        <p className="truncate text-[10px] text-white/35">{hostOf(item.url)}</p>
                      </button>
                      <div className="hidden gap-0.5 group-hover:flex">
                        <button type="button" disabled={index === 0} onClick={() => moveInPlaylist(playlist.id, item.id, -1)} className="rounded p-0.5 text-white/50 hover:text-white disabled:opacity-20" aria-label="Move up">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button type="button" disabled={index === playlist.items.length - 1} onClick={() => moveInPlaylist(playlist.id, item.id, 1)} className="rounded p-0.5 text-white/50 hover:text-white disabled:opacity-20" aria-label="Move down">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => removeFromPlaylist(playlist.id, item.id)} className="rounded p-0.5 text-white/50 hover:text-white" aria-label="Remove">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LibraryTransfer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const importLibrary = useLibrary((state) => state.importLibrary);
  const toast = useSession((state) => state.toast);

  const exportLibrary = () => {
    const { history, playlists } = useLibrary.getState();
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), history, playlists }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `universal-play-library-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="flex gap-1 border-t border-white/5 px-3 py-2">
      <button type="button" onClick={exportLibrary} className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] text-white/50 hover:bg-white/5 hover:text-white">
        <Download className="h-3 w-3" /> Export
      </button>
      <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] text-white/50 hover:bg-white/5 hover:text-white">
        <Upload className="h-3 w-3" /> Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            importLibrary(JSON.parse(await file.text()));
            toast('Library imported', 'success');
          } catch {
            toast('That file is not a valid library export.', 'error');
          }
        }}
      />
    </div>
  );
}

export function Sidebar() {
  const tab = useSession((state) => state.sidebarTab);
  const set = useSession((state) => state.set);
  const historyCount = useLibrary((state) => state.history.length);

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => set({ sidebarOpen: false })} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-80 max-w-[85vw] flex-col border-l border-white/5 bg-cinema-900 pt-3 lg:static lg:z-auto lg:max-w-none" aria-label="Library">
        <div className="mb-3 flex items-center gap-1 px-3">
          {(['history', 'playlists'] as const).map((id) => (
            <button key={id} type="button" onClick={() => set({ sidebarTab: id })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${tab === id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}>
              {id === 'history' ? `History${historyCount ? ` · ${historyCount}` : ''}` : 'Playlists'}
            </button>
          ))}
          <button type="button" onClick={() => set({ sidebarOpen: false })} className="ml-auto rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </button>
        </div>
        {tab === 'history' ? <HistoryTab /> : <PlaylistsTab />}
        <LibraryTransfer />
      </aside>
    </>
  );
}
