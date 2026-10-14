import { create } from 'zustand';
import { uid } from '../lib/format';
import { EMPTY_HEADERS } from '../lib/proxy';
import type { ModeOverride, SniffCandidate, Source, StreamHeaders } from '../lib/types';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

export interface SniffState {
  pageUrl: string;
  title: string;
  items: (SniffCandidate & { foundAt: number })[];
  scanning: boolean;
  panelOpen: boolean;
  mseVideoCount: number;
  serverError?: string;
}

export type SidebarTab = 'history' | 'playlists';

interface SessionState {
  source: Source | null;
  detecting: boolean;
  inputValue: string;
  modeOverride: ModeOverride;
  headers: StreamHeaders;
  forceProxy: boolean;
  advancedOpen: boolean;
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  theater: boolean;
  shortcutsOpen: boolean;
  proxyOnline: boolean | null;
  pendingSubtitle: File | null;
  sniff: SniffState;
  toasts: Toast[];
  set: (patch: Partial<Omit<SessionState, 'set' | 'toast' | 'dismissToast' | 'addSniffItems' | 'resetSniff' | 'updateSource'>>) => void;
  updateSource: (patch: Partial<Source>) => void;
  toast: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: (id: string) => void;
  addSniffItems: (items: SniffCandidate[]) => number;
  resetSniff: (pageUrl: string) => void;
}

const initialSniff = (pageUrl = ''): SniffState => ({ pageUrl, title: '', items: [], scanning: false, panelOpen: false, mseVideoCount: 0 });

const isWide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches;

export const useSession = create<SessionState>()((set, get) => ({
  source: null,
  detecting: false,
  inputValue: '',
  modeOverride: 'auto',
  headers: EMPTY_HEADERS,
  forceProxy: false,
  advancedOpen: false,
  sidebarOpen: Boolean(isWide),
  sidebarTab: 'history',
  theater: false,
  shortcutsOpen: false,
  proxyOnline: null,
  pendingSubtitle: null,
  sniff: initialSniff(),
  toasts: [],

  set: (patch) => set(patch),
  updateSource: (patch) => set((state) => (state.source ? { source: { ...state.source, ...patch } } : {})),

  toast: (message, tone = 'info', action) => {
    const id = uid();
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, tone, action }] }));
    window.setTimeout(() => get().dismissToast(id), action ? 7000 : 4000);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  addSniffItems: (items) => {
    let added = 0;
    set((state) => {
      const known = new Set(state.sniff.items.map((item) => item.url));
      const fresh = items.filter((item) => {
        if (known.has(item.url)) return false;
        known.add(item.url);
        return true;
      });
      added = fresh.length;
      if (!fresh.length) return {};
      const priority = { hls: 0, dash: 1, video: 2, embed: 3 } as const;
      const merged = [...state.sniff.items, ...fresh.map((item) => ({ ...item, foundAt: Date.now() }))].sort((a, b) => priority[a.kind] - priority[b.kind] || a.foundAt - b.foundAt);
      return { sniff: { ...state.sniff, items: merged } };
    });
    return added;
  },
  resetSniff: (pageUrl) => set({ sniff: initialSniff(pageUrl) }),
}));
