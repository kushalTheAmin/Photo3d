import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { playNextInPlaylist } from '../lib/controller';
import { buildEmbedUrl, PLATFORM_LABEL, supportsPositionTracking } from '../lib/platforms';
import type { Source } from '../lib/types';
import { useLibrary } from '../store/library';
import { useSession } from '../store/session';

const PLATFORM_ORIGINS: Record<string, RegExp> = {
  youtube: /^https:\/\/(www\.)?youtube(-nocookie)?\.com$/,
  vimeo: /^https:\/\/player\.vimeo\.com$/,
};

/**
 * Clean platform embed. YouTube and Vimeo expose a postMessage API, which we
 * use to remember the playback position (resume) and detect the end (playlists).
 */
export function EmbedPlayer({ source }: { source: Source }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const theater = useSession((state) => state.theater);
  const embed = source.embed;
  const src = useMemo(
    () => (embed ? buildEmbedUrl(embed, { parentHost: window.location.hostname, origin: window.location.origin, startAt: source.startAt }) : ''),
    // Only rebuild on a new load; startAt changes must not reload the iframe.
    [source.loadId],
  );

  useEffect(() => {
    if (!embed || !supportsPositionTracking(embed)) return undefined;
    const originPattern = PLATFORM_ORIGINS[embed.platform];
    let lastSaved = 0;
    let duration = 0;

    const save = (position: number) => {
      if (!duration || Math.abs(position - lastSaved) < 5) return;
      lastSaved = position;
      useLibrary.getState().updateProgress(source.url, position, duration);
    };

    const subscribe = () => {
      const frame = iframeRef.current?.contentWindow;
      if (!frame) return;
      if (embed.platform === 'youtube') {
        frame.postMessage(JSON.stringify({ event: 'listening', id: source.loadId, channel: 'widget' }), '*');
      } else {
        for (const value of ['timeupdate', 'ended']) frame.postMessage(JSON.stringify({ method: 'addEventListener', value }), '*');
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || !originPattern.test(event.origin)) return;
      let data: Record<string, unknown>;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (embed.platform === 'youtube') {
        const info = data.info as { currentTime?: number; duration?: number; playerState?: number } | undefined;
        if (data.event === 'onReady') subscribe();
        if (!info) return;
        if (typeof info.duration === 'number' && info.duration > 0) duration = info.duration;
        if (typeof info.currentTime === 'number') save(info.currentTime);
        if (info.playerState === 0) {
          useLibrary.getState().updateProgress(source.url, duration, duration);
          playNextInPlaylist();
        }
      } else {
        if (data.event === 'ready') subscribe();
        const payload = data.data as { seconds?: number; duration?: number } | undefined;
        if (data.event === 'timeupdate' && payload) {
          if (payload.duration) duration = payload.duration;
          if (typeof payload.seconds === 'number') save(payload.seconds);
        }
        if (data.event === 'ended') {
          useLibrary.getState().updateProgress(source.url, duration, duration);
          playNextInPlaylist();
        }
      }
    };

    window.addEventListener('message', onMessage);
    const frame = iframeRef.current;
    frame?.addEventListener('load', subscribe);
    const retry = window.setInterval(subscribe, 2500);
    const stopRetry = window.setTimeout(() => window.clearInterval(retry), 12000);
    return () => {
      window.removeEventListener('message', onMessage);
      frame?.removeEventListener('load', subscribe);
      window.clearInterval(retry);
      window.clearTimeout(stopRetry);
    };
  }, [embed, source.loadId, source.url]);

  if (!embed) return null;

  return (
    <div className="space-y-2">
      <div className={`relative w-full overflow-hidden bg-black ${theater ? 'h-[calc(100vh-8.5rem)] min-h-[320px]' : 'aspect-video max-h-[75vh] rounded-xl'}`}>
        <iframe
          key={source.loadId}
          ref={iframeRef}
          src={src}
          title={source.title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
        />
      </div>
      <div className="flex items-center justify-between px-1 text-xs text-white/40">
        <span>
          {PLATFORM_LABEL[embed.platform]} embed · popups and redirects blocked by sandbox
          {supportsPositionTracking(embed) ? ' · position is remembered' : ''}
        </span>
        <a href={embed.watchUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white/80">
          Open on {PLATFORM_LABEL[embed.platform]} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
