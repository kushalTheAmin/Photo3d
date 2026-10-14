import Hls, { ErrorDetails, ErrorTypes, Events, type ErrorData } from 'hls.js';
import type { AudioTrackInfo, QualityLevel, SubtitleTrackInfo } from '../lib/types';
import { sortedQualities, type EngineCallbacks, type PlaybackEngine } from './types';

const CODEC_ERRORS = new Set<string>([
  ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
  ErrorDetails.BUFFER_ADD_CODEC_ERROR,
  ErrorDetails.BUFFER_INCOMPATIBLE_CODECS_ERROR,
]);

export class HlsEngine implements PlaybackEngine {
  readonly name = 'hls' as const;
  private hls: Hls | null = null;
  private mediaRecoveries = 0;
  private networkRecoveries = 0;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly callbacks: EngineCallbacks,
  ) {}

  static isSupported(): boolean {
    return Hls.isSupported();
  }

  load(url: string, startAt = 0): void {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
      startPosition: startAt > 0 ? startAt : -1,
      capLevelToPlayerSize: false,
      renderTextTracksNatively: true,
    });
    this.hls = hls;
    const changed = () => this.callbacks.onTracksChanged();
    hls.on(Events.MANIFEST_PARSED, () => {
      this.networkRecoveries = 0;
      changed();
    });
    hls.on(Events.LEVEL_SWITCHED, changed);
    hls.on(Events.AUDIO_TRACKS_UPDATED, changed);
    hls.on(Events.AUDIO_TRACK_SWITCHED, changed);
    hls.on(Events.SUBTITLE_TRACKS_UPDATED, changed);
    hls.on(Events.SUBTITLE_TRACK_SWITCH, changed);
    hls.on(Events.FRAG_BUFFERED, () => {
      this.mediaRecoveries = 0;
    });
    hls.on(Events.ERROR, (_event, data) => this.handleError(data));
    hls.loadSource(url);
    hls.attachMedia(this.video);
  }

  private handleError(data: ErrorData) {
    const hls = this.hls;
    if (!hls) return;
    if (CODEC_ERRORS.has(data.details)) {
      this.callbacks.onError({ kind: 'codec', detail: `${data.details}${data.error?.message ? `: ${data.error.message}` : ''}` });
      hls.destroy();
      this.hls = null;
      return;
    }
    if (!data.fatal) return;
    const status = data.response?.code;
    switch (data.type) {
      case ErrorTypes.NETWORK_ERROR: {
        const isManifest = data.details === ErrorDetails.MANIFEST_LOAD_ERROR || data.details === ErrorDetails.MANIFEST_LOAD_TIMEOUT || data.details === ErrorDetails.MANIFEST_PARSING_ERROR;
        if (!isManifest && this.networkRecoveries < 2 && status !== 403 && status !== 404) {
          this.networkRecoveries += 1;
          hls.startLoad();
          return;
        }
        this.callbacks.onError({
          kind: data.details === ErrorDetails.MANIFEST_PARSING_ERROR ? 'manifest' : 'network',
          httpStatus: status,
          detail: `${data.details}${status !== undefined ? ` (HTTP ${status})` : ''}`,
        });
        break;
      }
      case ErrorTypes.MEDIA_ERROR:
        if (this.mediaRecoveries === 0) {
          this.mediaRecoveries += 1;
          hls.recoverMediaError();
          return;
        }
        if (this.mediaRecoveries === 1) {
          this.mediaRecoveries += 1;
          hls.swapAudioCodec();
          hls.recoverMediaError();
          return;
        }
        this.callbacks.onError({ kind: 'codec', mediaErrorCode: this.video.error?.code, detail: data.details });
        break;
      case ErrorTypes.KEY_SYSTEM_ERROR:
        this.callbacks.onError({ kind: 'drm', detail: data.details });
        break;
      default:
        this.callbacks.onError({ kind: 'unknown', detail: data.details });
    }
  }

  destroy(): void {
    this.hls?.destroy();
    this.hls = null;
  }

  isAudioGraphSafe(): boolean {
    return true;
  }

  getQualities(): QualityLevel[] {
    if (!this.hls) return [];
    return sortedQualities(this.hls.levels.map((level, id) => ({ id, height: level.height || undefined, bitrate: level.bitrate })));
  }
  getQuality(): number {
    if (!this.hls) return -1;
    return this.hls.autoLevelEnabled ? -1 : this.hls.currentLevel;
  }
  getActiveQualityLabel(): string | null {
    if (!this.hls) return null;
    const level = this.hls.levels[this.hls.currentLevel];
    return level?.height ? `${level.height}p` : null;
  }
  setQuality(id: number): void {
    if (!this.hls) return;
    this.hls.currentLevel = id;
    this.callbacks.onTracksChanged();
  }

  getAudioTracks(): AudioTrackInfo[] {
    if (!this.hls || this.hls.audioTracks.length < 2) return [];
    return this.hls.audioTracks.map((track, id) => ({ id, label: track.name || track.lang || `Track ${id + 1}`, lang: track.lang }));
  }
  getAudioTrack(): number {
    return this.hls?.audioTrack ?? -1;
  }
  setAudioTrack(id: number): void {
    if (this.hls) this.hls.audioTrack = id;
  }

  getSubtitleTracks(): SubtitleTrackInfo[] {
    if (!this.hls) return [];
    return this.hls.subtitleTracks.map((track, index) => ({ id: `h${index}`, label: track.name || track.lang || `Track ${index + 1}`, lang: track.lang, origin: 'stream' }));
  }
  getSubtitleTrack(): string | null {
    if (!this.hls || this.hls.subtitleTrack < 0 || !this.hls.subtitleDisplay) return null;
    return `h${this.hls.subtitleTrack}`;
  }
  setSubtitleTrack(id: string | null): void {
    if (!this.hls) return;
    const index = id ? Number(id.slice(1)) : -1;
    this.hls.subtitleDisplay = index >= 0;
    this.hls.subtitleTrack = index;
    this.callbacks.onTracksChanged();
  }
}
