import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTime } from '../../lib/format';

interface SeekBarProps {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  /** Source for the hover thumbnail (direct files only). */
  previewSrc?: string;
  onSeek: (time: number) => void;
  onScrubbing: (active: boolean) => void;
}

export function SeekBar({ currentTime, duration, bufferedEnd, previewSrc, onSeek, onScrubbing }: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const lastPreviewSeek = useRef(0);
  const [hover, setHover] = useState<{ x: number; time: number; width: number } | null>(null);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const [previewReady, setPreviewReady] = useState(false);

  const valid = Number.isFinite(duration) && duration > 0;

  const timeAt = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || !valid) return { x: 0, time: 0, width: 0 };
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      return { x, time: (x / rect.width) * duration, width: rect.width };
    },
    [duration, valid],
  );

  const updatePreview = (time: number) => {
    const preview = previewRef.current;
    if (!preview || !previewReady) return;
    const now = performance.now();
    if (now - lastPreviewSeek.current < 120) return;
    lastPreviewSeek.current = now;
    preview.currentTime = time;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const position = timeAt(event.clientX);
    setHover(position);
    updatePreview(position.time);
    if (dragTime !== null) setDragTime(position.time);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (!valid) return;
    (event.target as Element).setPointerCapture(event.pointerId);
    const { time } = timeAt(event.clientX);
    setDragTime(time);
    onScrubbing(true);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    if (dragTime === null) return;
    const { time } = timeAt(event.clientX);
    onSeek(time);
    setDragTime(null);
    onScrubbing(false);
  };

  useEffect(() => setPreviewReady(false), [previewSrc]);

  const shown = dragTime ?? currentTime;
  const playedPct = valid ? (shown / duration) * 100 : 0;
  const bufferedPct = valid ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
  const tooltipLeft = hover ? Math.min(Math.max(hover.x, previewSrc ? 80 : 28), hover.width - (previewSrc ? 80 : 28)) : 0;

  return (
    <div
      className="group/seek relative flex h-5 cursor-pointer items-center"
      ref={trackRef}
      onPointerMove={onPointerMove}
      onPointerLeave={() => dragTime === null && setHover(null)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={valid ? Math.floor(duration) : 0}
      aria-valuenow={Math.floor(shown)}
      aria-valuetext={formatTime(shown)}
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-100 group-hover/seek:h-1.5">
        <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${bufferedPct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${playedPct}%` }} />
      </div>
      <div
        className={`pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-accent shadow transition-transform ${dragTime !== null ? 'scale-100' : 'scale-0 group-hover/seek:scale-100'}`}
        style={{ left: `${playedPct}%` }}
      />
      <div
        className="pointer-events-none absolute bottom-6 -translate-x-1/2 flex-col items-center gap-1"
        style={{ left: tooltipLeft, display: hover && valid ? 'flex' : 'none' }}
      >
        {previewSrc && (
          <div className={`overflow-hidden rounded-md border border-white/20 bg-black shadow-xl ${previewReady ? '' : 'hidden'}`}>
            <video
              ref={previewRef}
              src={previewSrc}
              muted
              preload="metadata"
              playsInline
              className="h-[90px] w-[160px] object-cover"
              onLoadedMetadata={() => setPreviewReady(true)}
              onError={() => setPreviewReady(false)}
            />
          </div>
        )}
        <span className="rounded bg-black/85 px-1.5 py-0.5 font-mono text-xs text-white">{formatTime(hover?.time ?? 0)}</span>
      </div>
    </div>
  );
}
