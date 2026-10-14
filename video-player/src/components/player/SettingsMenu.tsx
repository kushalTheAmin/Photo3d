import { Check, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import type { AspectMode, AudioTrackInfo, QualityLevel, SubtitleTrackInfo } from '../../lib/types';

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const ASPECTS: { id: AspectMode; label: string }[] = [
  { id: 'fit', label: 'Fit' },
  { id: 'fill', label: 'Fill / Crop' },
  { id: '16:9', label: '16:9' },
  { id: '4:3', label: '4:3' },
];

type Page = 'main' | 'quality' | 'audio' | 'subtitles' | 'speed' | 'aspect';

export interface SettingsMenuProps {
  qualities: QualityLevel[];
  quality: number;
  activeQualityLabel: string | null;
  onQuality: (id: number) => void;
  audioTracks: AudioTrackInfo[];
  audioTrack: number;
  onAudioTrack: (id: number) => void;
  subtitles: SubtitleTrackInfo[];
  subtitle: string | null;
  onSubtitle: (id: string | null) => void;
  onUploadSubtitle: (file: File) => void;
  subtitleOffset: number;
  onSubtitleOffset: (offset: number) => void;
  speed: number;
  onSpeed: (speed: number) => void;
  aspect: AspectMode;
  onAspect: (aspect: AspectMode) => void;
}

function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-6 rounded-md px-3 py-2 text-left text-sm hover:bg-white/10">
      <span className="text-white/90">{label}</span>
      <span className="flex items-center gap-1 truncate text-white/60">
        <span className="max-w-[9rem] truncate">{value}</span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </span>
    </button>
  );
}

function Option({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm hover:bg-white/10 ${selected ? 'text-white' : 'text-white/75'}`}>
      <Check className={`h-4 w-4 shrink-0 ${selected ? 'text-accent' : 'invisible'}`} />
      <span className="truncate">{children}</span>
    </button>
  );
}

function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div>
      <button type="button" onClick={onBack} className="mb-1 flex w-full items-center gap-1 border-b border-white/10 px-2 pb-2 text-sm font-medium text-white">
        <ChevronLeft className="h-4 w-4" />
        {title}
      </button>
      <div className="max-h-64 overflow-y-auto">{children}</div>
    </div>
  );
}

export function SettingsMenu(props: SettingsMenuProps) {
  const [page, setPage] = useState<Page>('main');
  const fileRef = useRef<HTMLInputElement>(null);
  const back = () => setPage('main');

  const qualityValue = props.quality === -1 ? `Auto${props.activeQualityLabel ? ` (${props.activeQualityLabel})` : ''}` : props.qualities.find((q) => q.id === props.quality)?.label ?? 'Auto';
  const subtitleValue = props.subtitle ? props.subtitles.find((track) => track.id === props.subtitle)?.label ?? 'On' : 'Off';
  const audioValue = props.audioTracks.find((track) => track.id === props.audioTrack)?.label ?? 'Default';
  const uploadedActive = props.subtitles.find((track) => track.id === props.subtitle)?.origin === 'upload';

  return (
    <div className="w-72 animate-slide-up rounded-xl border border-white/10 bg-cinema-900/95 p-1.5 shadow-2xl backdrop-blur" onClick={(event) => event.stopPropagation()}>
      {page === 'main' && (
        <div>
          {props.qualities.length > 0 && <Row label="Quality" value={qualityValue} onClick={() => setPage('quality')} />}
          {props.audioTracks.length > 0 && <Row label="Audio track" value={audioValue} onClick={() => setPage('audio')} />}
          <Row label="Subtitles" value={subtitleValue} onClick={() => setPage('subtitles')} />
          <Row label="Speed" value={props.speed === 1 ? 'Normal' : `${props.speed}x`} onClick={() => setPage('speed')} />
          <Row label="Aspect ratio" value={ASPECTS.find((a) => a.id === props.aspect)?.label ?? 'Fit'} onClick={() => setPage('aspect')} />
        </div>
      )}
      {page === 'quality' && (
        <SubPage title="Quality / bitrate" onBack={back}>
          <Option selected={props.quality === -1} onClick={() => props.onQuality(-1)}>
            Auto{props.activeQualityLabel ? ` · now ${props.activeQualityLabel}` : ''}
          </Option>
          {props.qualities.map((level) => (
            <Option key={level.id} selected={props.quality === level.id} onClick={() => props.onQuality(level.id)}>
              {level.label}
            </Option>
          ))}
        </SubPage>
      )}
      {page === 'audio' && (
        <SubPage title="Audio track" onBack={back}>
          {props.audioTracks.map((track) => (
            <Option key={track.id} selected={props.audioTrack === track.id} onClick={() => props.onAudioTrack(track.id)}>
              {track.label}
              {track.lang && track.lang !== track.label ? <span className="ml-1 text-white/40">({track.lang})</span> : null}
            </Option>
          ))}
        </SubPage>
      )}
      {page === 'subtitles' && (
        <SubPage title="Subtitles / CC" onBack={back}>
          <Option selected={props.subtitle === null} onClick={() => props.onSubtitle(null)}>
            Off
          </Option>
          {props.subtitles.map((track) => (
            <Option key={track.id} selected={props.subtitle === track.id} onClick={() => props.onSubtitle(track.id)}>
              {track.label}
              {track.origin === 'upload' && <span className="ml-1 text-white/40">(file)</span>}
            </Option>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-white/10 px-3 py-2 text-left text-sm text-accent-soft hover:bg-white/10">
            <Upload className="h-4 w-4" /> Load .srt / .vtt file…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".srt,.vtt,text/vtt,application/x-subrip"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) props.onUploadSubtitle(file);
              event.target.value = '';
            }}
          />
          {uploadedActive && (
            <div className="mt-1 border-t border-white/10 px-3 py-2 text-sm">
              <div className="mb-1.5 flex items-center justify-between text-white/70">
                <span>Sync offset</span>
                <span className="font-mono text-white">{props.subtitleOffset > 0 ? '+' : ''}{props.subtitleOffset.toFixed(1)}s</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[-1, -0.1, 0.1, 1].map((delta) => (
                  <button key={delta} type="button" onClick={() => props.onSubtitleOffset(Math.round((props.subtitleOffset + delta) * 10) / 10)} className="rounded bg-white/10 py-1 font-mono text-xs hover:bg-white/20">
                    {delta > 0 ? '+' : ''}{delta}
                  </button>
                ))}
              </div>
              {props.subtitleOffset !== 0 && (
                <button type="button" onClick={() => props.onSubtitleOffset(0)} className="mt-1.5 w-full text-xs text-white/50 hover:text-white">
                  Reset offset
                </button>
              )}
            </div>
          )}
        </SubPage>
      )}
      {page === 'speed' && (
        <SubPage title="Playback speed" onBack={back}>
          {SPEEDS.map((speed) => (
            <Option key={speed} selected={props.speed === speed} onClick={() => props.onSpeed(speed)}>
              {speed === 1 ? 'Normal (1x)' : `${speed}x`}
            </Option>
          ))}
        </SubPage>
      )}
      {page === 'aspect' && (
        <SubPage title="Aspect ratio" onBack={back}>
          {ASPECTS.map((aspect) => (
            <Option key={aspect.id} selected={props.aspect === aspect.id} onClick={() => props.onAspect(aspect.id)}>
              {aspect.label}
            </Option>
          ))}
        </SubPage>
      )}
    </div>
  );
}
