// @vitest-environment node
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.ALLOW_PRIVATE_NETWORKS = '1';

const { fromProxyPath, rewriteM3u8, rewriteMpd, toProxyPath } = await import('../server/manifest.js');
const { sniffHtml } = await import('../server/sniff.js');
const { decodeToken, encodeToken } = await import('../server/token.js');
const { isPrivateAddress } = await import('../server/netguard.js');
const { createApp } = await import('../server/index.js');
const { encodeHeaderToken, EMPTY_HEADERS } = await import('../src/lib/proxy.ts');

describe('proxy path mapping', () => {
  it('round-trips URLs with ports and queries', () => {
    const url = 'https://cdn.example.com:8443/path/to/master.m3u8?token=a%2Fb&x=1';
    const path = toProxyPath(url, 'TOK');
    expect(path).toBe('/api/p/TOK/https/cdn.example.com:8443/path/to/master.m3u8?token=a%2Fb&x=1');
    expect(fromProxyPath(path)).toEqual({ token: 'TOK', url });
  });
  it('rejects malformed paths', () => {
    expect(fromProxyPath('/api/p/TOK/ftp/host/x')).toBeNull();
    expect(fromProxyPath('/other')).toBeNull();
  });
});

describe('header tokens', () => {
  it('decodes tokens produced by the browser client', () => {
    const token = encodeHeaderToken({ ...EMPTY_HEADERS, referer: 'https://site.com/ü', userAgent: 'UA', extra: [{ name: 'X-Test', value: '1' }] });
    expect(decodeToken(token)).toEqual({ referer: 'https://site.com/ü', 'user-agent': 'UA', 'x-test': '1' });
    expect(encodeToken({})).toBe('_');
  });
  it('drops hop-by-hop headers and CRLF injection', () => {
    expect(encodeToken({ host: 'evil', connection: 'close' })).toBe('_');
    expect(decodeToken(encodeToken({ referer: 'a\r\nX-Evil: 1' }))).toEqual({ referer: 'aX-Evil: 1' });
  });
});

describe('manifest rewriting', () => {
  it('rewrites every HLS URI, including attributes and absolute links', () => {
    const playlist = ['#EXTM3U', '#EXT-X-KEY:METHOD=AES-128,URI="keys/k1.bin"', '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",URI="audio/en.m3u8"', '#EXT-X-STREAM-INF:BANDWIDTH=1', 'video/720.m3u8', 'https://other.cdn/seg.ts', '#EXT-X-MAP:URI="data:application/octet-stream;base64,AA=="'].join('\n');
    const out = rewriteM3u8(playlist, 'https://cdn.example.com/hls/master.m3u8', 'T');
    expect(out).toContain('URI="/api/p/T/https/cdn.example.com/hls/keys/k1.bin"');
    expect(out).toContain('URI="/api/p/T/https/cdn.example.com/hls/audio/en.m3u8"');
    expect(out).toContain('\n/api/p/T/https/cdn.example.com/hls/video/720.m3u8\n');
    expect(out).toContain('\n/api/p/T/https/other.cdn/seg.ts\n');
    expect(out).toContain('URI="data:application/octet-stream;base64,AA=="');
  });

  it('injects a proxied BaseURL into DASH manifests and proxies absolute references', () => {
    const mpd = `<?xml version="1.0"?><MPD xmlns="urn:mpeg:dash:schema:mpd:2011"><Period><AdaptationSet><SegmentTemplate media="chunk-$Number$.m4s" initialization="https://init.cdn/init.mp4"/></AdaptationSet></Period></MPD>`;
    const out = rewriteMpd(mpd, 'https://cdn.example.com/dash/redirected/manifest.mpd', 'T');
    expect(out).toContain('<BaseURL>/api/p/T/https/cdn.example.com/dash/redirected/</BaseURL>');
    expect(out).toContain('media="chunk-$Number$.m4s"');
    expect(out).toContain('initialization="/api/p/T/https/init.cdn/init.mp4"');
  });

  it('resolves an existing MPD-level relative BaseURL', () => {
    const mpd = '<MPD><BaseURL>media/</BaseURL><Period><AdaptationSet><BaseURL>https://abs.cdn/x/</BaseURL></AdaptationSet></Period></MPD>';
    const out = rewriteMpd(mpd, 'https://cdn.example.com/a/manifest.mpd', 'T');
    expect(out).toContain('<BaseURL>/api/p/T/https/cdn.example.com/a/media/</BaseURL>');
    expect(out).toContain('<BaseURL>/api/p/T/https/abs.cdn/x/</BaseURL>');
  });
});

describe('static sniffer', () => {
  it('finds video tags, og:video, JSON-escaped URLs and platform iframes', () => {
    const html = `
      <meta property="og:video" content="https://cdn.site.com/og.mp4">
      <video src="/media/clip.webm"></video>
      <script>var cfg = {"hls":"https:\\/\\/stream.site.com\\/live\\/index.m3u8?sig=1"};</script>
      <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
      <a href="/notvideo.html">x</a>`;
    const found = sniffHtml(html, 'https://site.com/watch/1');
    const urls = found.map((item) => `${item.kind} ${item.url}`);
    expect(urls).toContain('hls https://stream.site.com/live/index.m3u8?sig=1');
    expect(urls).toContain('video https://cdn.site.com/og.mp4');
    expect(urls).toContain('video https://site.com/media/clip.webm');
    expect(urls).toContain('embed https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(found[0].kind).toBe('hls');
  });
});

describe('network guard', () => {
  it('classifies private addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1']) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('proxy server (integration)', () => {
  let upstream;
  let proxy;
  let upstreamBase;
  let proxyBase;
  const seen = [];

  beforeAll(async () => {
    upstream = http.createServer((req, res) => {
      seen.push({ url: req.url, referer: req.headers.referer, ua: req.headers['user-agent'], range: req.headers.range });
      if (req.url === '/hls/master.m3u8') {
        res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl' });
        res.end('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nlow/index.m3u8\n');
      } else if (req.url === '/plain/list') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('#EXTM3U\n#EXTINF:4,\nseg0.ts\n');
      } else if (req.url === '/redirect') {
        res.writeHead(302, { location: '/hls/master.m3u8' });
        res.end();
      } else if (req.url === '/video.mp4') {
        const body = Buffer.alloc(1000, 7);
        if (req.headers.range) {
          res.writeHead(206, { 'content-type': 'video/mp4', 'content-range': 'bytes 0-9/1000', 'content-length': 10, 'accept-ranges': 'bytes' });
          res.end(body.subarray(0, 10));
        } else {
          res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': body.length });
          res.end(body);
        }
      } else if (req.url === '/protected.mp4') {
        res.writeHead(req.headers.referer === 'https://allowed.site/' ? 200 : 403, { 'content-type': 'text/plain' });
        res.end(req.headers.referer === 'https://allowed.site/' ? 'ok' : 'Forbidden');
      } else if (req.url === '/page') {
        res.writeHead(200, { 'content-type': 'text/html', 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'" });
        res.end('<html><head><title>Demo Page</title></head><body><video src="movie.mp4"></video></body></html>');
      } else {
        res.writeHead(404);
        res.end('nope');
      }
    });
    await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    upstreamBase = `http://127.0.0.1:${upstream.address().port}`;
    proxy = createApp({ serveStatic: false }).listen(0, '127.0.0.1');
    await new Promise((resolve) => proxy.once('listening', resolve));
    proxyBase = `http://127.0.0.1:${proxy.address().port}`;
  });

  afterAll(() => {
    upstream?.close();
    proxy?.close();
  });

  const proxied = (path, token = '_') => `${proxyBase}/api/p/${token}/http/127.0.0.1:${upstream.address().port}${path}`;

  it('rewrites HLS playlists and adds CORS headers', async () => {
    const response = await fetch(proxied('/hls/master.m3u8'));
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    const text = await response.text();
    expect(text).toContain(`/api/p/_/http/127.0.0.1:${upstream.address().port}/hls/low/index.m3u8`);
  });

  it('detects playlists served as text/plain and follows redirects', async () => {
    expect(await (await fetch(proxied('/plain/list'))).text()).toContain('/plain/seg0.ts');
    const redirected = await fetch(proxied('/redirect'));
    expect(redirected.headers.get('x-upstream-url')).toBe(`${upstreamBase}/hls/master.m3u8`);
    expect(await redirected.text()).toContain('/hls/low/index.m3u8');
  });

  it('forwards Range requests for seeking', async () => {
    const response = await fetch(proxied('/video.mp4'), { headers: { range: 'bytes=0-9' } });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-9/1000');
    expect((await response.arrayBuffer()).byteLength).toBe(10);
  });

  it('applies custom headers from the token', async () => {
    expect((await fetch(proxied('/protected.mp4'))).status).toBe(403);
    const token = encodeToken({ referer: 'https://allowed.site/', 'user-agent': 'TestAgent/1.0' });
    const response = await fetch(proxied('/protected.mp4', token));
    expect(response.status).toBe(200);
    expect(seen.at(-1)).toMatchObject({ referer: 'https://allowed.site/', ua: 'TestAgent/1.0' });
  });

  it('probes status and content type', async () => {
    const ok = await (await fetch(`${proxyBase}/api/probe?url=${encodeURIComponent(`${upstreamBase}/hls/master.m3u8`)}`)).json();
    expect(ok).toMatchObject({ ok: true, status: 200, kind: 'hls' });
    const forbidden = await (await fetch(`${proxyBase}/api/probe?url=${encodeURIComponent(`${upstreamBase}/protected.mp4`)}`)).json();
    expect(forbidden).toMatchObject({ ok: false, status: 403 });
    const html = await (await fetch(`${proxyBase}/api/probe?url=${encodeURIComponent(`${upstreamBase}/page`)}`)).json();
    expect(html.kind).toBe('html');
  });

  it('serves pages sandboxed with the sniffer injected and frame blockers removed', async () => {
    const response = await fetch(`${proxyBase}/api/page?url=${encodeURIComponent(`${upstreamBase}/page`)}`);
    expect(response.headers.get('x-frame-options')).toBeNull();
    expect(response.headers.get('content-security-policy')).toMatch(/^sandbox allow-scripts/);
    const html = await response.text();
    expect(html).toContain(`<base href="${upstreamBase}/page">`);
    expect(html).toContain('__uvpSnifferInstalled');
  });

  it('sniffs pages server-side', async () => {
    const result = await (await fetch(`${proxyBase}/api/sniff?url=${encodeURIComponent(`${upstreamBase}/page`)}`)).json();
    expect(result.title).toBe('Demo Page');
    expect(result.candidates).toEqual([{ url: `${upstreamBase}/movie.mp4`, kind: 'video', source: '<video> tag' }]);
  });

  it('rejects non-http schemes', async () => {
    const result = await (await fetch(`${proxyBase}/api/probe?url=${encodeURIComponent('file:///etc/passwd')}`)).json();
    expect(result).toMatchObject({ ok: false, error: 'bad-url' });
  });
});
