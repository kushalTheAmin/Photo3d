import { Captions, Maximize, Minimize, Pause, PictureInPicture2, Play, RectangleHorizontal, RotateCcw, RotateCw, Settings, Volume1, Volume2, VolumeX } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatTime } from '../../lib/format';
import { SeekBar } from './SeekBar';
import { SettingsMenu, type SettingsMenuProps } from './SettingsMenu';

interface ControlsProps {
  visible: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  live: boolean;
  volume: number;
  muted: boolean;
  boostBlocked: boolean;
  isFullscreen: boolean;
  isPip: boolean;
  theater: boolean;
  menuOpen: boolean;
  previewSrc?: string;
  subtitlesOn: boolean;
  menu: SettingsMenuProps;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onScrubbing: (active: boolean) => void;
  onSeekBy: (seconds: number) => void;
  onGoLive: () => void;
  onVolume: (value: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onTogglePip: () => void;
  onToggleTheater: () => void;
  onToggleCaptions: () => void;
  onToggleMenu: () => void;
}

function IconButton({ label, onClick, active, className = '', children }: { label: string; onClick: () => void; active?: boolean; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className={`h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/15 ${active ? 'text-accent-soft' : 'text-white'} ${className || 'flex'}`}
    >
      {children}
    </button>
  );
}

export function Controls(props: ControlsProps) {
  const effectiveVolume = props.muted ? 0 : props.volume;
  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2;
  const atLiveEdge = props.live && props.duration - props.currentTime < 8;
  const sliderMax = props.boostBlocked ? 100 : 200;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-2 pt-10 transition-opacity duration-200 ${props.visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <SeekBar currentTime={props.currentTime} duration={props.duration} bufferedEnd={props.bufferedEnd} previewSrc={props.previewSrc} onSeek={props.onSeek} onScrubbing={props.onScrubbing} />
      <div className="mt-1 flex items-center gap-0.5">
        <IconButton label={props.playing ? 'Pause (K)' : 'Play (K)'} onClick={props.onTogglePlay}>
          {props.playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
        </IconButton>
        <IconButton label="Back 10s (J)" onClick={() => props.onSeekBy(-10)} className="hidden sm:flex">
          <RotateCcw className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton label="Forward 10s (L)" onClick={() => props.onSeekBy(10)} className="hidden sm:flex">
          <RotateCw className="h-[18px] w-[18px]" />
        </IconButton>

        <div className="group/vol flex items-center">
          <IconButton label="Mute (M)" onClick={props.onToggleMute} active={effectiveVolume > 1}>
            <VolumeIcon className="h-5 w-5" />
          </IconButton>
          <div className="flex w-0 items-center gap-2 overflow-hidden transition-all duration-200 group-hover/vol:w-36 group-focus-within/vol:w-36">
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={1}
              value={Math.round(effectiveVolume * 100)}
              onChange={(event) => props.onVolume(Number(event.target.value) / 100)}
              className="volume-slider h-1 w-24 cursor-pointer"
              style={{ '--fill': `${(Math.round(effectiveVolume * 100) / sliderMax) * 100}%`, '--boost': `${(100 / sliderMax) * 100}%` } as React.CSSProperties}
              aria-label="Volume"
              title={props.boostBlocked ? 'Boost above 100% needs CORS — enable the proxy' : 'Up to 200% with Web Audio boost'}
            />
            <span className={`w-10 font-mono text-[11px] ${effectiveVolume > 1 ? 'text-accent-soft' : 'text-white/70'}`}>{Math.round(effectiveVolume * 100)}%</span>
          </div>
        </div>

        <div className="ml-1 flex items-center gap-2 whitespace-nowrap font-mono text-xs text-white/85 sm:ml-2">
          {props.live ? (
            <button
              type="button"
              onClick={props.onGoLive}
              className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 font-sans text-[11px] font-bold tracking-wide ${atLiveEdge ? 'text-white' : 'text-white/60 hover:text-white'}`}
              title="Jump to live edge"
            >
              <span className={`h-2 w-2 rounded-full ${atLiveEdge ? 'bg-accent' : 'bg-white/40'}`} />
              LIVE
            </button>
          ) : (
            <span>
              {formatTime(props.currentTime)} <span className="text-white/40">/</span> {formatTime(props.duration)}
            </span>
          )}
        </div>

        <div className="flex-1" />

        <IconButton label="Subtitles (C)" onClick={props.onToggleCaptions} active={props.subtitlesOn}>
          <Captions className="h-5 w-5" />
        </IconButton>
        <div className="relative">
          <IconButton label="Settings" onClick={props.onToggleMenu} active={props.menuOpen}>
            <Settings className={`h-5 w-5 transition-transform duration-300 ${props.menuOpen ? 'rotate-45' : ''}`} />
          </IconButton>
          {props.menuOpen && (
            <div className="absolute bottom-11 right-0 z-30">
              <SettingsMenu {...props.menu} />
            </div>
          )}
        </div>
        <IconButton label="Picture-in-Picture (P)" onClick={props.onTogglePip} active={props.isPip}>
          <PictureInPicture2 className="h-5 w-5" />
        </IconButton>
        {!props.isFullscreen && (
          <IconButton label="Theater mode (T)" onClick={props.onToggleTheater} active={props.theater} className="hidden sm:flex">
            <RectangleHorizontal className="h-5 w-5" />
          </IconButton>
        )}
        <IconButton label="Fullscreen (F)" onClick={props.onToggleFullscreen}>
          {props.isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </IconButton>
      </div>
    </div>
  );
}
