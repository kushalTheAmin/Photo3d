import type { PlayerMode } from '../lib/types';
import { NativeEngine } from './nativeEngine';
import type { EngineCallbacks, PlaybackEngine } from './types';

export type EngineResult = PlaybackEngine | { unsupported: string };

/**
 * Picks the engine for a mode. hls.js and dash.js are loaded on demand so a
 * plain MP4 never downloads ~1 MB of streaming code. HLS falls back to Safari's
 * native support; DASH needs MSE and has no native fallback.
 */
export async function createEngine(mode: PlayerMode, video: HTMLVideoElement, callbacks: EngineCallbacks): Promise<EngineResult> {
  if (mode === 'hls') {
    const { HlsEngine } = await import('./hlsEngine');
    if (HlsEngine.isSupported()) return new HlsEngine(video, callbacks);
    if (video.canPlayType('application/vnd.apple.mpegurl')) return new NativeEngine(video, callbacks);
    return { unsupported: 'This browser supports neither Media Source Extensions nor native HLS.' };
  }
  if (mode === 'dash') {
    const { DashEngine } = await import('./dashEngine');
    if (DashEngine.isSupported()) return new DashEngine(video, callbacks);
    return { unsupported: 'MPEG-DASH needs Media Source Extensions, which this browser (e.g. iOS Safari) does not provide.' };
  }
  return new NativeEngine(video, callbacks);
}
