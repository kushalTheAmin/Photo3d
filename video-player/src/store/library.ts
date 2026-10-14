import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../lib/format';
import type { PlayerMode } from '../lib/types';

export interface HistoryEntry {
  url: string;
  title: string;
  mode: PlayerMode;
  position: number;
  duration: number;
  updatedAt: number;
  playCount: number;
  thumbnail?: string;
}

export interface PlaylistItem {
  id: string;
  url: string;
  title: string;
  mode: PlayerMode;
  addedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: number;
}

export interface Settings {
  autoResume: boolean;
  autoProxyOnFailure: boolean;
  proxyBase: string;
  volume: number;
  muted: boolean;
  speed: number;
  autoAdvance: boolean;
}

export const BOOKMARKS_ID = 'bookmarks';
const MAX_HISTORY = 300;

interface LibraryState {
  history: HistoryEntry[];
  playlists: Playlist[];
  settings: Settings;
  recordPlay: (entry: Pick<HistoryEntry, 'url' | 'title' | 'mode'> & { thumbnail?: string }) => void;
  updateProgress: (url: string, position: number, duration: number) => void;
  updateHistoryMeta: (url: string, meta: Partial<Pick<HistoryEntry, 'title' | 'thumbnail'>>) => void;
  removeHistory: (url: string) => void;
  clearHistory: () => void;
  getResumePosition: (url: string) => number;
  createPlaylist: (name: string) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, item: Omit<PlaylistItem, 'id' | 'addedAt'>) => void;
  removeFromPlaylist: (playlistId: string, itemId: string) => void;
  moveInPlaylist: (playlistId: string, itemId: string, direction: -1 | 1) => void;
  isBookmarked: (url: string) => boolean;
  toggleBookmark: (item: Omit<PlaylistItem, 'id' | 'addedAt'>) => boolean;
  importLibrary: (data: { history?: HistoryEntry[]; playlists?: Playlist[] }) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const DEFAULT_SETTINGS: Settings = {
  autoResume: true,
  autoProxyOnFailure: false,
  proxyBase: (import.meta.env.VITE_PROXY_BASE as string | undefined) ?? '/api',
  volume: 1,
  muted: false,
  speed: 1,
  autoAdvance: true,
};

const defaultPlaylists = (): Playlist[] => [{ id: BOOKMARKS_ID, name: 'Bookmarks', items: [], createdAt: Date.now() }];

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      history: [],
      playlists: defaultPlaylists(),
      settings: DEFAULT_SETTINGS,

      recordPlay: ({ url, title, mode, thumbnail }) =>
        set((state) => {
          const existing = state.history.find((entry) => entry.url === url);
          const entry: HistoryEntry = existing
            ? { ...existing, title: title || existing.title, mode, updatedAt: Date.now(), playCount: existing.playCount + 1, thumbnail: thumbnail ?? existing.thumbnail }
            : { url, title, mode, position: 0, duration: 0, updatedAt: Date.now(), playCount: 1, thumbnail };
          return { history: [entry, ...state.history.filter((item) => item.url !== url)].slice(0, MAX_HISTORY) };
        }),

      updateProgress: (url, position, duration) =>
        set((state) => ({
          history: state.history.map((entry) => (entry.url === url ? { ...entry, position, duration: duration || entry.duration, updatedAt: Date.now() } : entry)),
        })),

      updateHistoryMeta: (url, meta) =>
        set((state) => ({
          history: state.history.map((entry) =>
            entry.url === url ? { ...entry, title: meta.title || entry.title, thumbnail: meta.thumbnail ?? entry.thumbnail } : entry,
          ),
          playlists: meta.title
            ? state.playlists.map((playlist) => ({
                ...playlist,
                items: playlist.items.map((item) => (item.url === url && item.title === url ? { ...item, title: meta.title as string } : item)),
              }))
            : state.playlists,
        })),

      removeHistory: (url) => set((state) => ({ history: state.history.filter((entry) => entry.url !== url) })),
      clearHistory: () => set({ history: [] }),

      getResumePosition: (url) => {
        const entry = get().history.find((item) => item.url === url);
        if (!entry || entry.position < 5) return 0;
        if (entry.duration && entry.position > entry.duration - 10) return 0;
        return entry.position;
      },

      createPlaylist: (name) => {
        const id = uid();
        set((state) => ({ playlists: [...state.playlists, { id, name: name.trim() || 'Untitled playlist', items: [], createdAt: Date.now() }] }));
        return id;
      },
      renamePlaylist: (id, name) =>
        set((state) => ({ playlists: state.playlists.map((playlist) => (playlist.id === id ? { ...playlist, name: name.trim() || playlist.name } : playlist)) })),
      deletePlaylist: (id) => set((state) => ({ playlists: id === BOOKMARKS_ID ? state.playlists : state.playlists.filter((playlist) => playlist.id !== id) })),
      addToPlaylist: (playlistId, item) =>
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === playlistId && !playlist.items.some((existing) => existing.url === item.url)
              ? { ...playlist, items: [...playlist.items, { ...item, id: uid(), addedAt: Date.now() }] }
              : playlist,
          ),
        })),
      removeFromPlaylist: (playlistId, itemId) =>
        set((state) => ({
          playlists: state.playlists.map((playlist) => (playlist.id === playlistId ? { ...playlist, items: playlist.items.filter((item) => item.id !== itemId) } : playlist)),
        })),
      moveInPlaylist: (playlistId, itemId, direction) =>
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist;
            const index = playlist.items.findIndex((item) => item.id === itemId);
            const target = index + direction;
            if (index === -1 || target < 0 || target >= playlist.items.length) return playlist;
            const items = [...playlist.items];
            [items[index], items[target]] = [items[target], items[index]];
            return { ...playlist, items };
          }),
        })),
      isBookmarked: (url) => get().playlists.find((playlist) => playlist.id === BOOKMARKS_ID)?.items.some((item) => item.url === url) ?? false,
      toggleBookmark: (item) => {
        const bookmarks = get().playlists.find((playlist) => playlist.id === BOOKMARKS_ID);
        const existing = bookmarks?.items.find((entry) => entry.url === item.url);
        if (existing) {
          get().removeFromPlaylist(BOOKMARKS_ID, existing.id);
          return false;
        }
        get().addToPlaylist(BOOKMARKS_ID, item);
        return true;
      },
      importLibrary: (data) =>
        set((state) => {
          const history = Array.isArray(data.history) ? data.history.filter((entry) => typeof entry?.url === 'string') : [];
          const merged = [...state.history];
          for (const entry of history) if (!merged.some((existing) => existing.url === entry.url)) merged.push(entry);
          const playlists = [...state.playlists];
          for (const playlist of Array.isArray(data.playlists) ? data.playlists : []) {
            if (!playlist?.id || !Array.isArray(playlist.items)) continue;
            const target = playlists.find((existing) => existing.id === playlist.id);
            if (target) {
              const items = [...target.items];
              for (const item of playlist.items) if (!items.some((existing) => existing.url === item.url)) items.push(item);
              playlists[playlists.indexOf(target)] = { ...target, items };
            } else playlists.push(playlist);
          }
          return { history: merged.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_HISTORY), playlists };
        }),
      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
    }),
    {
      name: 'uvp-library-v1',
      version: 1,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<LibraryState>;
        const playlists = saved.playlists?.length ? saved.playlists : current.playlists;
        return {
          ...current,
          ...saved,
          playlists: playlists.some((playlist) => playlist.id === BOOKMARKS_ID) ? playlists : [...defaultPlaylists(), ...playlists],
          settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
        };
      },
    },
  ),
);
