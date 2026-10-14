import { CircleCheck, CircleX, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { checkProxyHealth } from '../lib/api';
import { reopenCurrent } from '../lib/controller';
import { MODE_LABEL } from '../lib/detect';
import { EMPTY_HEADERS, hasCustomHeaders } from '../lib/proxy';
import type { ModeOverride, StreamHeaders } from '../lib/types';
import { useLibrary } from '../store/library';
import { useSession } from '../store/session';

const USER_AGENTS: { label: string; value: string }[] = [
  { label: 'Default (desktop Chrome)', value: '' },
  { label: 'Safari · iPhone', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1' },
  { label: 'Chrome · Android', value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' },
  { label: 'Firefox · Windows', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0' },
  { label: 'Smart TV (Tizen)', value: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36' },
  { label: 'VLC', value: 'VLC/3.0.21 LibVLC/3.0.21' },
];

const MODES: ModeOverride[] = ['auto', 'direct', 'hls', 'dash', 'embed', 'web', 'web-direct'];

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-xs font-medium text-white/70">
        {label}
        {hint && <span className="font-normal text-white/35">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-white/5" role="switch" aria-checked={checked}>
      <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${checked ? 'bg-accent' : 'bg-white/15'}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : ''}`} />
      </span>
      <span>
        <span className="block text-sm text-white">{label}</span>
        <span className="block text-xs text-white/45">{description}</span>
      </span>
    </button>
  );
}

const inputClass = 'w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-xs text-white placeholder:text-white/25 outline-none focus:border-accent/60';

export function AdvancedOptions() {
  const open = useSession((state) => state.advancedOpen);
  const headers = useSession((state) => state.headers);
  const forceProxy = useSession((state) => state.forceProxy);
  const modeOverride = useSession((state) => state.modeOverride);
  const source = useSession((state) => state.source);
  const proxyOnline = useSession((state) => state.proxyOnline);
  const set = useSession((state) => state.set);
  const settings = useLibrary((state) => state.settings);
  const updateSettings = useLibrary((state) => state.updateSettings);
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    set({ proxyOnline: await checkProxyHealth(settings.proxyBase) });
    setChecking(false);
  };

  useEffect(() => {
    if (open) void recheck();
    // Re-check whenever the drawer opens or the proxy base changes.
  }, [open, settings.proxyBase]);

  if (!open) return null;

  const patch = (update: Partial<StreamHeaders>) => set({ headers: { ...headers, ...update } });
  const customActive = hasCustomHeaders(headers);
  const presetValue = USER_AGENTS.find((ua) => ua.value === headers.userAgent)?.value ?? 'custom';

  return (
    <section className="z-20 max-h-[70vh] animate-slide-up overflow-y-auto border-b border-white/5 bg-cinema-850/95 backdrop-blur" aria-label="Advanced stream options">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Custom request headers</h2>
            <span className="text-xs text-white/40">Applied server-side through the proxy — browsers cannot set these</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Referer" hint="beats hotlink protection">
              <input className={inputClass} value={headers.referer} onChange={(event) => patch({ referer: event.target.value })} placeholder="https://site-hosting-the-player.com/watch/123" />
            </Field>
            <Field label="Origin">
              <input className={inputClass} value={headers.origin} onChange={(event) => patch({ origin: event.target.value })} placeholder="https://site-hosting-the-player.com" />
            </Field>
            <Field label="User-Agent">
              <div className="flex gap-1.5">
                <select
                  className={`${inputClass} w-40 shrink-0 font-sans`}
                  value={presetValue}
                  onChange={(event) => event.target.value !== 'custom' && patch({ userAgent: event.target.value })}
                  aria-label="User-Agent preset"
                >
                  {USER_AGENTS.map((ua) => (
                    <option key={ua.label} value={ua.value}>
                      {ua.label}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                <input className={inputClass} value={headers.userAgent} onChange={(event) => patch({ userAgent: event.target.value })} placeholder="Custom User-Agent string" />
              </div>
            </Field>
            <Field label="Authorization">
              <input className={inputClass} value={headers.authorization} onChange={(event) => patch({ authorization: event.target.value })} placeholder="Bearer eyJhbGciOi…" type="password" autoComplete="off" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Cookie" hint="kept in memory only — never saved">
                <input className={inputClass} value={headers.cookie} onChange={(event) => patch({ cookie: event.target.value })} placeholder="session=abc123; cf_clearance=…" type="password" autoComplete="off" />
              </Field>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {headers.extra.map((header, index) => (
              <div key={index} className="flex gap-1.5">
                <input
                  className={`${inputClass} w-40`}
                  value={header.name}
                  placeholder="X-Header-Name"
                  onChange={(event) => patch({ extra: headers.extra.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)) })}
                  aria-label="Header name"
                />
                <input
                  className={inputClass}
                  value={header.value}
                  placeholder="value"
                  onChange={(event) => patch({ extra: headers.extra.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)) })}
                  aria-label="Header value"
                />
                <button type="button" onClick={() => patch({ extra: headers.extra.filter((_, i) => i !== index) })} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Remove header">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => patch({ extra: [...headers.extra, { name: '', value: '' }] })} className="flex items-center gap-1 text-xs text-accent-soft hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add custom header
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {source && !source.local && (
              <button type="button" onClick={() => reopenCurrent({ headers, useProxy: forceProxy || customActive })} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-soft">
                <RefreshCw className="h-4 w-4" /> Apply &amp; reload current
              </button>
            )}
            <button type="button" onClick={() => set({ headers: EMPTY_HEADERS })} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20">
              Clear headers
            </button>
          </div>
        </div>

        <div className="space-y-1 lg:border-l lg:border-white/5 lg:pl-6">
          <h2 className="mb-2 text-sm font-semibold text-white">Playback &amp; network</h2>
          <Field label="Player mode override">
            <select className={`${inputClass} font-sans`} value={modeOverride} onChange={(event) => set({ modeOverride: event.target.value as ModeOverride })}>
              {MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === 'auto' ? 'Auto-detect (extension → domain → MIME)' : MODE_LABEL[mode]}
                </option>
              ))}
            </select>
          </Field>
          <div className="pt-2" />
          <Toggle checked={forceProxy} onChange={(value) => set({ forceProxy: value })} label="Always route through CORS proxy" description="Fixes CORS / mixed-content blocks and unlocks 200% volume boost. Enabled automatically when headers are set." />
          <Toggle checked={settings.autoProxyOnFailure} onChange={(value) => updateSettings({ autoProxyOnFailure: value })} label="Auto-retry via proxy on failure" description="When a stream is CORS-blocked, silently retry through the proxy." />
          <Toggle checked={settings.autoResume} onChange={(value) => updateSettings({ autoResume: value })} label="Resume where I left off" description="Remember the timestamp of every link in history." />
          <Toggle checked={settings.autoAdvance} onChange={(value) => updateSettings({ autoAdvance: value })} label="Auto-advance playlists" description="Play the next playlist item when one finishes." />
          <div className="pt-2">
            <Field label="Proxy endpoint" hint="default /api">
              <div className="flex items-center gap-2">
                <input className={inputClass} value={settings.proxyBase} onChange={(event) => updateSettings({ proxyBase: event.target.value || '/api' })} placeholder="/api or https://my-proxy.example.com/api" />
                <button type="button" onClick={() => void recheck()} className="flex shrink-0 items-center gap-1 text-xs" title="Check proxy health">
                  {checking ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                  ) : proxyOnline ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CircleCheck className="h-4 w-4" /> online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-accent-soft">
                      <CircleX className="h-4 w-4" /> offline
                    </span>
                  )}
                </button>
              </div>
            </Field>
          </div>
        </div>
      </div>
    </section>
  );
}
