import { describe, expect, it } from 'vitest';
import { detectFromUrl, detectSource, normalizeInput } from '../src/lib/detect';
import { buildEmbedUrl, parsePlatformUrl, parseTimestamp } from '../src/lib/platforms';

describe('normalizeInput', () => {
  it('keeps full URLs and adds https to bare domains', () => {
    expect(normalizeInput('  https://example.com/a.mp4 ')).toBe('https://example.com/a.mp4');
    expect(normalizeInput('example.com/video')).toBe('https://example.com/video');
    expect(normalizeInput('//cdn.example.com/x.m3u8')).toBe('https://cdn.example.com/x.m3u8');
  });
  it('extracts a link from surrounding text and trims punctuation', () => {
    expect(normalizeInput('check this out: https://youtu.be/dQw4w9WgXcQ!')).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(normalizeInput('(see https://en.wikipedia.org/wiki/Foo_(bar))')).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
  });
  it('rejects non-links', () => {
    expect(normalizeInput('hello world')).toBeNull();
    expect(normalizeInput('javascript:alert(1)')).toBeNull();
    expect(normalizeInput('')).toBeNull();
  });
});

describe('detectFromUrl', () => {
  it('routes by extension', () => {
    expect(detectFromUrl('https://a.com/live/master.m3u8?token=1')?.mode).toBe('hls');
    expect(detectFromUrl('https://a.com/manifest.mpd')?.mode).toBe('dash');
    for (const ext of ['mp4', 'webm', 'ogg', 'mov', 'mkv']) expect(detectFromUrl(`https://a.com/v.${ext}`)?.mode).toBe('direct');
    expect(detectFromUrl('https://a.com/watch?id=3')).toBeNull();
  });
  it('routes platforms to embed', () => {
    expect(detectFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.mode).toBe('embed');
  });
});

describe('detectSource', () => {
  it('honours manual override without probing', async () => {
    let probed = false;
    const result = await detectSource('https://a.com/x', 'hls', async () => {
      probed = true;
      return null;
    });
    expect(result.mode).toBe('hls');
    expect(probed).toBe(false);
  });
  it('uses MIME type from the probe', async () => {
    const result = await detectSource('https://a.com/stream?id=1', 'auto', async () => ({ ok: true, status: 200, kind: 'hls', contentType: 'application/vnd.apple.mpegurl' }));
    expect(result.mode).toBe('hls');
  });
  it('falls back to the web view for HTML', async () => {
    const result = await detectSource('https://a.com/page', 'auto', async () => ({ ok: true, status: 200, kind: 'html', contentType: 'text/html' }));
    expect(result.mode).toBe('web');
  });
});

describe('platform parsing', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s', 'dQw4w9WgXcQ', 90],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'dQw4w9WgXcQ', 42],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ', undefined],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ?start=10', 'dQw4w9WgXcQ', 10],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ', undefined],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', undefined],
  ])('YouTube %s', (url, id, start) => {
    const info = parsePlatformUrl(url);
    expect(info?.platform).toBe('youtube');
    expect(info?.id).toBe(id);
    expect(info?.startSeconds).toBe(start);
  });

  it('parses YouTube playlists', () => {
    const info = parsePlatformUrl('https://www.youtube.com/playlist?list=PL123abc');
    expect(info).toMatchObject({ platform: 'youtube', variant: 'playlist', id: 'PL123abc' });
  });

  it('parses Vimeo including unlisted hashes', () => {
    expect(parsePlatformUrl('https://vimeo.com/76979871')).toMatchObject({ platform: 'vimeo', id: '76979871' });
    expect(parsePlatformUrl('https://vimeo.com/channels/staffpicks/76979871')).toMatchObject({ id: '76979871' });
    expect(parsePlatformUrl('https://vimeo.com/76979871/abcdef1234')?.extra).toEqual({ h: 'abcdef1234' });
    expect(parsePlatformUrl('https://player.vimeo.com/video/76979871?h=ff00ff')?.extra).toEqual({ h: 'ff00ff' });
  });

  it('parses Twitch channels, VODs and clips', () => {
    expect(parsePlatformUrl('https://www.twitch.tv/shroud')).toMatchObject({ variant: 'channel', id: 'shroud' });
    expect(parsePlatformUrl('https://www.twitch.tv/videos/123456789?t=1h2m3s')).toMatchObject({ variant: 'video', id: '123456789', startSeconds: 3723 });
    expect(parsePlatformUrl('https://clips.twitch.tv/FunnyClipSlug')).toMatchObject({ variant: 'clip', id: 'FunnyClipSlug' });
    expect(parsePlatformUrl('https://www.twitch.tv/shroud/clip/AnotherClip-abc')).toMatchObject({ variant: 'clip', id: 'AnotherClip-abc' });
    expect(parsePlatformUrl('https://www.twitch.tv/directory')).toBeNull();
  });

  it('parses Dailymotion and Streamable', () => {
    expect(parsePlatformUrl('https://www.dailymotion.com/video/x8abcd1_some-title')).toMatchObject({ platform: 'dailymotion', id: 'x8abcd1' });
    expect(parsePlatformUrl('https://dai.ly/x8abcd1')).toMatchObject({ platform: 'dailymotion', id: 'x8abcd1' });
    expect(parsePlatformUrl('https://streamable.com/moo')).toMatchObject({ platform: 'streamable', id: 'moo' });
    expect(parsePlatformUrl('https://streamable.com/e/moo')).toMatchObject({ platform: 'streamable', id: 'moo' });
  });

  it('builds clean embed URLs', () => {
    const opts = { parentHost: 'localhost', origin: 'http://localhost:5173' };
    const yt = buildEmbedUrl(parsePlatformUrl('https://youtu.be/dQw4w9WgXcQ')!, { ...opts, startAt: 75 });
    expect(yt).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(yt).toContain('start=75');
    expect(yt).toContain('enablejsapi=1');
    expect(buildEmbedUrl(parsePlatformUrl('https://www.twitch.tv/shroud')!, opts)).toContain('parent=localhost');
    expect(buildEmbedUrl(parsePlatformUrl('https://vimeo.com/1/abcdef12')!, { ...opts, startAt: 30 })).toMatch(/player\.vimeo\.com\/video\/1\?.*h=abcdef12.*#t=30s$/);
  });

  it('parses timestamps', () => {
    expect(parseTimestamp('90')).toBe(90);
    expect(parseTimestamp('1h2m3s')).toBe(3723);
    expect(parseTimestamp('2m')).toBe(120);
    expect(parseTimestamp('1:02:03')).toBe(3723);
    expect(parseTimestamp('nope')).toBeUndefined();
  });
});

describe('detectSource without a server', () => {
  it('opens unknown links in the direct iframe instead of the proxied browser', async () => {
    expect((await detectSource('https://a.com/page', 'auto', async () => null, 'web-direct')).mode).toBe('web-direct');
    expect((await detectSource('https://a.com/page', 'web', async () => null, 'web-direct')).mode).toBe('web-direct');
    expect((await detectSource('https://a.com/v.m3u8', 'auto', async () => null, 'web-direct')).mode).toBe('hls');
  });
});
