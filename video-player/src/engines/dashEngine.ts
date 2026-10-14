import dashjs from 'dashjs';
import type { AudioTrackInfo, EngineErrorKind, QualityLevel, SubtitleTrackInfo } from '../lib/types';
import { sortedQualities, type EngineCallbacks, type PlaybackEngine } from './types';

type DashPlayer = dashjs.MediaPlayerClass;

function classifyDashError(code: number | null | undefined): EngineErrorKind {
  if (code === null || code === undefined) return 'unknown';
  if (code >= 100 && code < 200) return 'drm';
  if (code === 10 || code === 31 || code === 32 || code === 34) return 'manifest';
  if (code === 11 || code === 12 || code === 17 || code === 25 || code === 26 || code === 27 || code === 28 || code === 29) return 'network';
  if (code === 20 || code === 23 || code === 35 || code === 201) return 'codec';
  return 'unknown';
}

function extractStatus(error: unknown): number | undefined {
  const data = (error as { data?: { request?: { status?: number }; response?: { status?: number } } })?.data;
  const status = data?.request?.status ?? data?.response?.status;
  return typeof status === 'number' && status > 0 ? status : undefined;
}

export class DashEngine implements PlaybackEngine {
  readonly name = 'dash' as const;
  private player: DashPlayer | null = null;
  private textIndex = -1;
  private reportedError = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly callbacks: EngineCallbacks,
  ) {}

  static isSupported(): boolean {
    return dashjs.supportsMediaSource();
  }

  load(url: string, startAt = 0): void {
    const player = dashjs.MediaPlayer().create();
    this.player = player;
    // logLevel 3 = LOG_LEVEL_WARNING (a const enum the typings do not export).
    player.updateSettings({
      debug: { logLevel: 3 },
      streaming: {
        abr: { autoSwitchBitrate: { video: true, audio: true } },
        buffer: { fastSwitchEnabled: true },
        text: { defaultEnabled: false },
      },
    } as Parameters<DashPlayer['updateSettings']>[0]);
    const events = dashjs.MediaPlayer.events;
    const changed = () => this.callbacks.onTracksChanged();
    player.on(events.STREAM_INITIALIZED, changed);
    player.on(events.QUALITY_CHANGE_RENDERED, changed);
    player.on(events.TRACK_CHANGE_RENDERED, changed);
    player.on(events.TEXT_TRACKS_ADDED, changed);
    player.on(events.ERROR, (event) => {
      const error = (event as unknown as { error: { code?: number; message?: string } | string }).error;
      if (typeof error === 'string') return;
      const kind = classifyDashError(error?.code);
      this.fail({ kind, httpStatus: extractStatus(error), detail: `dash.js error ${error?.code ?? '?'}: ${error?.message ?? 'unknown'}` });
    });
    player.on(events.PLAYBACK_ERROR, () => {
      const code = this.video.error?.code;
      this.fail({ kind: code === 3 || code === 4 ? 'codec' : 'media', mediaErrorCode: code, detail: this.video.error?.message || 'Playback error' });
    });
    player.initialize(this.video, url, true, startAt > 0 ? startAt : undefined);
  }

  private fail(error: Parameters<EngineCallbacks['onError']>[0]) {
    if (this.reportedError) return;
    this.reportedError = true;
    this.callbacks.onError(error);
  }

  destroy(): void {
    try {
      this.player?.reset();
    } catch {
      /* already torn down */
    }
    this.player = null;
  }

  isAudioGraphSafe(): boolean {
    return true;
  }

  private autoEnabled(): boolean {
    const settings = this.player?.getSettings();
    return settings?.streaming?.abr?.autoSwitchBitrate?.video !== false;
  }

  getQualities(): QualityLevel[] {
    if (!this.player) return [];
    try {
      return sortedQualities(this.player.getBitrateInfoListFor('video').map((info) => ({ id: info.qualityIndex, height: info.height || undefined, bitrate: info.bitrate })));
    } catch {
      return [];
    }
  }
  getQuality(): number {
    if (!this.player || this.autoEnabled()) return -1;
    return this.player.getQualityFor('video');
  }
  getActiveQualityLabel(): string | null {
    if (!this.player) return null;
    try {
      const index = this.player.getQualityFor('video');
      const info = this.player.getBitrateInfoListFor('video').find((entry) => entry.qualityIndex === index);
      return info?.height ? `${info.height}p` : null;
    } catch {
      return null;
    }
  }
  setQuality(id: number): void {
    if (!this.player) return;
    if (id < 0) {
      this.player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
    } else {
      this.player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
      this.player.setQualityFor('video', id, true);
    }
    this.callbacks.onTracksChanged();
  }

  private audioTracks() {
    try {
      return this.player?.getTracksFor('audio') ?? [];
    } catch {
      return [];
    }
  }
  getAudioTracks(): AudioTrackInfo[] {
    const tracks = this.audioTracks();
    if (tracks.length < 2) return [];
    return tracks.map((track, id) => ({ id, label: track.labels?.[0]?.text || track.lang || `Track ${id + 1}`, lang: track.lang ?? undefined }));
  }
  getAudioTrack(): number {
    const current = this.player?.getCurrentTrackFor('audio');
    if (!current) return -1;
    return this.audioTracks().findIndex((track) => track.id === current.id && track.index === current.index);
  }
  setAudioTrack(id: number): void {
    const track = this.audioTracks()[id];
    if (track && this.player) this.player.setCurrentTrack(track);
  }

  getSubtitleTracks(): SubtitleTrackInfo[] {
    if (!this.player) return [];
    try {
      return this.player.getTracksFor('text').map((track, index) => ({
        id: `d${index}`,
        label: track.labels?.[0]?.text || track.lang || `Track ${index + 1}`,
        lang: track.lang ?? undefined,
        origin: 'stream',
      }));
    } catch {
      return [];
    }
  }
  getSubtitleTrack(): string | null {
    if (!this.player) return null;
    const index = this.player.getCurrentTextTrackIndex?.() ?? this.textIndex;
    return index >= 0 ? `d${index}` : null;
  }
  setSubtitleTrack(id: string | null): void {
    if (!this.player) return;
    const index = id ? Number(id.slice(1)) : -1;
    this.textIndex = index;
    this.player.enableText(index >= 0);
    this.player.setTextTrack(index);
    this.callbacks.onTracksChanged();
  }
}
