import type { AudioTrackInfo, EngineError, QualityLevel, SubtitleTrackInfo } from '../lib/types';

export interface EngineCallbacks {
  /** Quality / audio / subtitle lists or the active selection changed. */
  onTracksChanged: () => void;
  /** A fatal, unrecoverable error. */
  onError: (error: EngineError) => void;
}

export interface PlaybackEngine {
  readonly name: 'native' | 'hls' | 'dash';
  load(url: string, startAt?: number): void;
  destroy(): void;
  /** True when the media is readable by Web Audio (CORS-clean), enabling volume boost. */
  isAudioGraphSafe(): boolean;
  getQualities(): QualityLevel[];
  /** -1 means automatic (ABR). */
  getQuality(): number;
  /** Human label of what ABR is currently playing, e.g. "720p". */
  getActiveQualityLabel(): string | null;
  setQuality(id: number): void;
  getAudioTracks(): AudioTrackInfo[];
  getAudioTrack(): number;
  setAudioTrack(id: number): void;
  getSubtitleTracks(): SubtitleTrackInfo[];
  getSubtitleTrack(): string | null;
  setSubtitleTrack(id: string | null): void;
}

export function qualityLabel(height: number | undefined, bitrate: number | undefined, duplicateHeight: boolean): string {
  const resolution = height ? `${height}p` : 'Audio';
  if (!bitrate) return resolution;
  const rate = bitrate >= 1_000_000 ? `${(bitrate / 1_000_000).toFixed(1)} Mbps` : `${Math.round(bitrate / 1000)} kbps`;
  return duplicateHeight || !height ? `${resolution} · ${rate}` : `${resolution} (${rate})`;
}

export function sortedQualities(levels: { id: number; height?: number; bitrate?: number }[]): QualityLevel[] {
  const heightCounts = new Map<number, number>();
  for (const level of levels) if (level.height) heightCounts.set(level.height, (heightCounts.get(level.height) ?? 0) + 1);
  return levels
    .map((level) => ({
      id: level.id,
      height: level.height,
      bitrate: level.bitrate,
      label: qualityLabel(level.height, level.bitrate, (heightCounts.get(level.height ?? 0) ?? 0) > 1),
    }))
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bitrate ?? 0) - (a.bitrate ?? 0));
}
