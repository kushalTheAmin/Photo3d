import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/lib/diagnostics';
import { EMPTY_HEADERS } from '../src/lib/proxy';
import type { Source } from '../src/lib/types';

const base: Source = { loadId: '1', url: 'https://cdn.example.com/master.m3u8', mode: 'hls', title: 't', useProxy: false, headers: EMPTY_HEADERS, detectReason: '' };

describe('diagnose', () => {
  it('detects CORS when the server is reachable but the browser could not read it', () => {
    const d = diagnose(base, { kind: 'network', httpStatus: 0, detail: 'manifestLoadError' }, { ok: true, status: 200, kind: 'hls', corsAllowed: false }, true);
    expect(d.code).toBe('cors');
    expect(d.actions[0]).toBe('enable-proxy');
  });

  it('recognises expired signed tokens', () => {
    const d = diagnose({ ...base, url: 'https://cdn.example.com/v.m3u8?token=abc&expires=1', pageUrl: 'https://site.com/watch' }, { kind: 'network', httpStatus: 403, detail: '' }, { ok: false, status: 403 }, true);
    expect(d.code).toBe('token-expired');
    expect(d.actions).toContain('reextract');
  });

  it('suggests a Referer for plain 403s', () => {
    const d = diagnose({ ...base, pageUrl: 'https://site.com/watch' }, { kind: 'network', detail: '' }, { ok: false, status: 403 }, true);
    expect(d.code).toBe('forbidden');
    expect(d.actions[0]).toBe('proxy-with-referer');
  });

  it('flags geo blocks', () => {
    expect(diagnose(base, { kind: 'network', detail: '' }, { ok: false, status: 451 }, true).code).toBe('geo');
    expect(diagnose(base, { kind: 'network', detail: '' }, { ok: false, status: 403, geoHint: true }, true).code).toBe('geo');
  });

  it('reports unsupported codecs and containers', () => {
    expect(diagnose(base, { kind: 'codec', detail: 'bufferAddCodecError' }, { ok: true, status: 200, kind: 'hls' }, true).code).toBe('codec');
    const mkv = diagnose({ ...base, mode: 'direct', url: 'https://a.com/movie.mkv' }, { kind: 'media', mediaErrorCode: 4, detail: '' }, { ok: true, status: 200, kind: 'video' }, true);
    expect(mkv.code).toBe('container');
  });

  it('notices when the proxy itself is down', () => {
    expect(diagnose({ ...base, useProxy: true }, { kind: 'network', detail: '' }, null, false).code).toBe('proxy-unavailable');
  });

  it('suggests switching engines when the MIME type disagrees', () => {
    const d = diagnose({ ...base, mode: 'direct', url: 'https://a.com/stream' }, { kind: 'media', mediaErrorCode: 4, detail: '' }, { ok: true, status: 200, kind: 'hls' }, true);
    expect(d.code).toBe('wrong-engine');
    expect(d.actions).toContain('switch-hls');
  });

  it('points webpages to the sniffer', () => {
    const d = diagnose({ ...base, mode: 'direct' }, { kind: 'media', mediaErrorCode: 4, detail: '' }, { ok: true, status: 200, kind: 'html' }, true);
    expect(d.code).toBe('webpage');
  });
});
