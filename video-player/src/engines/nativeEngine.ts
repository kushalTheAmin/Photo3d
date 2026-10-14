import type { AudioTrackInfo, QualityLevel, SubtitleTrackInfo } from '../lib/types';
import type { EngineCallbacks, PlaybackEngine } from './types';

/** Tracks created by the subtitle uploader; engines must not list or toggle them. */
export const uploadedTracks = new WeakSet<TextTrack>();

interface NativeAudioTrack {
  id: string;
  label: string;
  language: string;
  enabled: boolean;
}

interface AudioTrackListLike {
  length: number;
  [index: number]: NativeAudioTrack;
}

function needsCorsAttempt(url: string): boolean {
  if (url.startsWith('blob:') || url.startsWith('data:')) return false;
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Plain <video src>. Tries crossOrigin="anonymous" first so Web Audio (volume
 * boost) can read the samples; if the server has no CORS headers it silently
 * retries without, trading boost for playback.
 */
export class NativeEngine implements PlaybackEngine {
  readonly name = 'native' as const;
  private needsCors = false;
  private retriedWithoutCors = false;
  private hasMetadata = false;
  private url = '';
  private startAt = 0;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly callbacks: EngineCallbacks,
  ) {}

  private readonly cleanups: (() => void)[] = [];

  private on(target: EventTarget | undefined, type: string, listener: EventListener) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, listener);
    this.cleanups.push(() => target.removeEventListener(type, listener));
  }

  load(url: string, startAt = 0): void {
    this.url = url;
    this.startAt = startAt;
    this.needsCors = needsCorsAttempt(url);
    if (this.needsCors) this.video.crossOrigin = 'anonymous';
    else this.video.removeAttribute('crossorigin');

    this.on(this.video, 'loadedmetadata', () => {
      this.hasMetadata = true;
      if (this.startAt > 0 && this.startAt < (this.video.duration || Infinity)) this.video.currentTime = this.startAt;
      this.callbacks.onTracksChanged();
    });
    this.on(this.video, 'error', () => this.handleError());
    const onTracks = () => this.callbacks.onTracksChanged();
    this.on(this.video.textTracks, 'addtrack', onTracks);
    this.on(this.video.textTracks, 'removetrack', onTracks);
    this.on(this.audioList() as unknown as EventTarget | undefined, 'addtrack', onTracks);
    this.video.src = url;
  }

  private handleError() {
    const mediaError = this.video.error;
    if (!this.hasMetadata && this.video.crossOrigin === 'anonymous' && !this.retriedWithoutCors) {
      this.retriedWithoutCors = true;
      this.video.removeAttribute('crossorigin');
      this.video.src = this.url;
      this.video.load();
      return;
    }
    const code = mediaError?.code ?? 0;
    this.callbacks.onError({
      kind: code === 3 ? 'codec' : code === 2 ? 'network' : 'media',
      mediaErrorCode: code,
      detail: mediaError?.message || ['', 'Aborted', 'Network error', 'Decode error', 'Source not supported'][code] || 'Unknown media error',
    });
  }

  destroy(): void {
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.video.removeAttribute('src');
    this.video.load();
  }

  /**
   * Derived from live element state (not a flag set in our own listener) so it
   * is already correct inside any other loadedmetadata handler.
   */
  isAudioGraphSafe(): boolean {
    if (!this.needsCors) return true;
    return this.video.crossOrigin === 'anonymous' && this.video.readyState >= HTMLMediaElement.HAVE_METADATA;
  }

  getQualities(): QualityLevel[] {
    return [];
  }
  getQuality(): number {
    return -1;
  }
  getActiveQualityLabel(): string | null {
    return this.video.videoHeight ? `${this.video.videoHeight}p` : null;
  }
  setQuality(): void {}

  private audioList(): AudioTrackListLike | undefined {
    return (this.video as HTMLVideoElement & { audioTracks?: AudioTrackListLike }).audioTracks;
  }

  getAudioTracks(): AudioTrackInfo[] {
    const list = this.audioList();
    if (!list || list.length < 2) return [];
    const result: AudioTrackInfo[] = [];
    for (let i = 0; i < list.length; i += 1) result.push({ id: i, label: list[i].label || list[i].language || `Track ${i + 1}`, lang: list[i].language });
    return result;
  }
  getAudioTrack(): number {
    const list = this.audioList();
    if (!list) return -1;
    for (let i = 0; i < list.length; i += 1) if (list[i].enabled) return i;
    return -1;
  }
  setAudioTrack(id: number): void {
    const list = this.audioList();
    if (!list) return;
    for (let i = 0; i < list.length; i += 1) list[i].enabled = i === id;
    this.callbacks.onTracksChanged();
  }

  private streamTextTracks(): TextTrack[] {
    return Array.from(this.video.textTracks).filter((track) => !uploadedTracks.has(track) && (track.kind === 'subtitles' || track.kind === 'captions'));
  }
  getSubtitleTracks(): SubtitleTrackInfo[] {
    return this.streamTextTracks().map((track, index) => ({ id: `n${index}`, label: track.label || track.language || `Track ${index + 1}`, lang: track.language, origin: 'stream' }));
  }
  getSubtitleTrack(): string | null {
    const index = this.streamTextTracks().findIndex((track) => track.mode === 'showing');
    return index === -1 ? null : `n${index}`;
  }
  setSubtitleTrack(id: string | null): void {
    this.streamTextTracks().forEach((track, index) => {
      track.mode = `n${index}` === id ? 'showing' : 'disabled';
    });
    this.callbacks.onTracksChanged();
  }
}
