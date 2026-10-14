import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { Loader2, Play } from 'lucide-react';
import { createEngine } from '../../engines/createEngine';
import { uploadedTracks } from '../../engines/nativeEngine';
import type { PlaybackEngine } from '../../engines/types';
import { checkProxyHealth, probeUrl } from '../../lib/api';
import { AudioBoost } from '../../lib/audioBoost';
import { applyRecovery, playNextInPlaylist } from '../../lib/controller';
import { diagnose } from '../../lib/diagnostics';
import { formatTime } from '../../lib/format';
import { buildProxyUrl } from '../../lib/proxy';
import { parseSubtitles, toVttCue, type ParsedCue } from '../../lib/subtitles';
import type { AspectMode, Diagnosis, EngineError, RecoveryAction, Source, SubtitleTrackInfo } from '../../lib/types';
import { useLibrary } from '../../store/library';
import { useSession } from '../../store/session';
import { Controls } from './Controls';
import { ErrorOverlay } from './ErrorOverlay';
import { SPEEDS } from './SettingsMenu';

export interface PlayerHandle {
  togglePlay: () => void;
  seekBy: (seconds: number) => void;
  seekToFraction: (fraction: number) => void;
  changeVolume: (delta: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  togglePip: () => void;
  toggleCaptions: () => void;
  changeSpeed: (direction: 1 | -1) => void;
}

interface UploadedSubtitle {
  id: string;
  label: string;
  track: TextTrack;
  cues: ParsedCue[];
}

export function resolvePlayUrl(source: Source, proxyBase: string): string {
  if (source.local || !source.useProxy) return source.url;
  return buildProxyUrl(source.url, source.headers, proxyBase);
}

function aspectStyles(aspect: AspectMode): { box: CSSProperties; fit: CSSProperties['objectFit'] } {
  if (aspect === 'fit') return { box: { position: 'absolute', inset: 0 }, fit: 'contain' };
  if (aspect === 'fill') return { box: { position: 'absolute', inset: 0 }, fit: 'cover' };
  const [w, h] = aspect === '16:9' ? [16, 9] : [4, 3];
  return { box: { width: `min(100cqw, calc(100cqh * ${w} / ${h}))`, aspectRatio: `${w} / ${h}` }, fit: 'fill' };
}

const SAVE_INTERVAL = 5;

export const VideoPlayer = forwardRef<PlayerHandle, { source: Source }>(function VideoPlayer({ source }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const boostRef = useRef<AudioBoost | null>(null);
  const lastSavedRef = useRef(0);
  const hideTimer = useRef<number>();
  const clickTimer = useRef<number>();
  const osdTimer = useRef<number>();
  const lastSubtitleRef = useRef<string | null>(null);
  const uploadsRef = useRef<UploadedSubtitle[]>([]);
  const boostToastShown = useRef(false);

  const settings = useLibrary((state) => state.settings);
  const updateSettings = useLibrary((state) => state.updateSettings);
  const updateProgress = useLibrary((state) => state.updateProgress);
  const toast = useSession((state) => state.toast);
  const theater = useSession((state) => state.theater);
  const pendingSubtitle = useSession((state) => state.pendingSubtitle);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [volume, setVolume] = useState(settings.volume);
  const [muted, setMuted] = useState(settings.muted);
  const [speed, setSpeed] = useState(settings.speed);
  const [aspect, setAspect] = useState<AspectMode>('fit');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [controlsActive, setControlsActive] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [, setTrackVersion] = useState(0);
  const [uploads, setUploads] = useState<UploadedSubtitle[]>([]);
  const [activeUpload, setActiveUpload] = useState<string | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [boostBlocked, setBoostBlocked] = useState(false);
  const [osd, setOsd] = useState<string | null>(null);
  const [resumeNotice, setResumeNotice] = useState<number | null>(source.startAt && source.startAt > 0 ? source.startAt : null);
  const [live, setLive] = useState(false);

  uploadsRef.current = uploads;
  const playUrl = resolvePlayUrl(source, settings.proxyBase);

  const showOsd = useCallback((text: string) => {
    setOsd(text);
    window.clearTimeout(osdTimer.current);
    osdTimer.current = window.setTimeout(() => setOsd(null), 800);
  }, []);

  const saveProgress = useCallback(
    (force = false, element?: HTMLVideoElement) => {
      const video = element ?? videoRef.current;
      if (!video || source.local || !Number.isFinite(video.duration) || video.duration <= 0) return;
      if (!force && Math.abs(video.currentTime - lastSavedRef.current) < SAVE_INTERVAL) return;
      lastSavedRef.current = video.currentTime;
      updateProgress(source.url, video.currentTime, video.duration);
    },
    [source.local, source.url, updateProgress],
  );

  const handleEngineError = useCallback(
    async (error: EngineError) => {
      setWaiting(false);
      setDiagnosing(true);
      const proxyBase = useLibrary.getState().settings.proxyBase;
      const probe = source.local ? null : await probeUrl(source.url, source.headers, proxyBase);
      const proxyReachable = probe !== null || (await checkProxyHealth(proxyBase));
      const result = diagnose(source, error, probe, proxyReachable);
      setDiagnosing(false);
      if (useLibrary.getState().settings.autoProxyOnFailure && !source.useProxy && proxyReachable && result.actions.includes('enable-proxy')) {
        toast(`${result.title} — retrying through the proxy`, 'info');
        applyRecovery('enable-proxy');
        return;
      }
      setDiagnosis(result);
    },
    [source, toast],
  );

  // One engine per load. The parent keys this component by loadId, so the
  // <video> element is fresh too (a Web Audio graph can never be detached).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    let cancelled = false;
    let engine: PlaybackEngine | null = null;
    const callbacks = {
      onTracksChanged: () => setTrackVersion((version) => version + 1),
      onError: (error: EngineError) => void handleEngineError(error),
    };
    void createEngine(source.mode, video, callbacks).then((result) => {
      if (cancelled) {
        if (!('unsupported' in result)) result.destroy();
        return;
      }
      if ('unsupported' in result) {
        setWaiting(false);
        setDiagnosis({ code: 'unknown', title: 'Format Not Supported Here', detail: result.unsupported, technical: `mode: ${source.mode}`, actions: ['open-web-direct', 'open-external'] });
        return;
      }
      engine = result;
      engineRef.current = result;
      boostRef.current = new AudioBoost(video);
      video.playbackRate = settings.speed;
      video.muted = settings.muted;
      video.volume = Math.min(1, settings.volume);
      result.load(playUrl, source.startAt);
    });
    return () => {
      cancelled = true;
      // Refs are already detached when passive cleanups run, so use the captured element.
      saveProgress(true, video);
      engine?.destroy();
      boostRef.current?.dispose();
      engineRef.current = null;
    };
  }, [source.loadId]);

  useEffect(() => {
    if (resumeNotice === null) return undefined;
    const timer = window.setTimeout(() => setResumeNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [resumeNotice]);

  useEffect(() => {
    const video = videoRef.current;
    const onEnterPip = () => setIsPip(true);
    const onLeavePip = () => setIsPip(false);
    video?.addEventListener('enterpictureinpicture', onEnterPip);
    video?.addEventListener('leavepictureinpicture', onLeavePip);
    return () => {
      video?.removeEventListener('enterpictureinpicture', onEnterPip);
      video?.removeEventListener('leavepictureinpicture', onLeavePip);
    };
  }, []);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    const onUnload = () => saveProgress(true);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [saveProgress]);

  const applyVolume = useCallback(
    (next: number, announce = false) => {
      const video = videoRef.current;
      const boost = boostRef.current;
      if (!video || !boost) return;
      let value = Math.round(Math.min(2, Math.max(0, next)) * 100) / 100;
      const ok = boost.apply(value, engineRef.current?.isAudioGraphSafe() ?? false);
      const clamped = !ok && value > 1;
      if (clamped) {
        value = 1;
        if (!boostToastShown.current) toast('Volume boost needs CORS access to the audio. Route the stream through the proxy to unlock 200%.', 'info');
        boostToastShown.current = true;
        setBoostBlocked(true);
      }
      if (value > 0 && video.muted) {
        video.muted = false;
        setMuted(false);
      }
      setVolume(value);
      // A clamp caused by this source's missing CORS must not erase the saved preference.
      updateSettings(clamped ? { muted: video.muted } : { volume: value, muted: video.muted });
      if (announce) showOsd(`Volume ${Math.round(value * 100)}%`);
    },
    [showOsd, toast, updateSettings],
  );

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().then(
      () => setNeedsGesture(false),
      (error: DOMException) => {
        if (error?.name === 'NotAllowedError') setNeedsGesture(true);
      },
    );
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || diagnosis) return;
    if (video.paused || video.ended) {
      tryPlay();
      showOsd('Play');
    } else {
      video.pause();
      showOsd('Pause');
    }
  }, [diagnosis, showOsd, tryPlay]);

  const seekableEnd = () => {
    const video = videoRef.current;
    if (!video) return 0;
    if (Number.isFinite(video.duration)) return video.duration;
    return video.seekable.length ? video.seekable.end(video.seekable.length - 1) : 0;
  };

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const end = seekableEnd();
    video.currentTime = Math.min(Math.max(0, time), end || time);
    setCurrentTime(video.currentTime);
  }, []);

  const seekBy = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      seekTo(video.currentTime + seconds);
      showOsd(`${seconds > 0 ? '+' : '−'}${Math.abs(seconds)}s`);
    },
    [seekTo, showOsd],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    updateSettings({ muted: video.muted });
    showOsd(video.muted ? 'Muted' : `Volume ${Math.round(volume * 100)}%`);
  }, [showOsd, updateSettings, volume]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!container || !video) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    } else {
      video.webkitEnterFullscreen?.();
    }
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled) await video.requestPictureInPicture();
      else toast('Picture-in-Picture is not supported in this browser.', 'error');
    } catch (error) {
      toast(`Picture-in-Picture failed: ${(error as Error).message}`, 'error');
    }
  }, [toast]);

  const changeSpeed = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = value;
      setSpeed(value);
      updateSettings({ speed: value });
      showOsd(`${value}x`);
    },
    [showOsd, updateSettings],
  );

  // ---- Subtitles: stream tracks come from the engine, uploads are ours ----
  const engine = engineRef.current;
  const streamSubtitles = engine?.getSubtitleTracks() ?? [];
  const allSubtitles: SubtitleTrackInfo[] = [...streamSubtitles, ...uploads.map((upload) => ({ id: upload.id, label: upload.label, origin: 'upload' as const }))];
  const currentSubtitle = activeUpload ?? engine?.getSubtitleTrack() ?? null;

  const selectSubtitle = useCallback((id: string | null) => {
    const isUpload = id?.startsWith('u') ?? false;
    for (const upload of uploadsRef.current) upload.track.mode = upload.id === id ? 'showing' : 'disabled';
    engineRef.current?.setSubtitleTrack(isUpload ? null : id);
    setActiveUpload(isUpload ? id : null);
    setSubtitleOffset(0);
    if (id) lastSubtitleRef.current = id;
  }, []);

  const loadSubtitleFile = useCallback(
    async (file: File) => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const cues = parseSubtitles(await file.text());
        if (!cues.length) {
          toast(`No subtitle cues found in "${file.name}".`, 'error');
          return;
        }
        const label = file.name.replace(/\.(srt|vtt)$/i, '');
        const track = video.addTextTrack('subtitles', label, 'und');
        uploadedTracks.add(track);
        track.mode = 'hidden';
        for (const cue of cues) track.addCue(toVttCue(cue, 0));
        const upload: UploadedSubtitle = { id: `u${Date.now()}`, label, track, cues };
        uploadsRef.current = [...uploadsRef.current, upload];
        setUploads(uploadsRef.current);
        selectSubtitle(upload.id);
        toast(`Loaded ${cues.length} cues from ${file.name}${/\.srt$/i.test(file.name) ? ' (converted SRT → VTT)' : ''}`, 'success');
      } catch (error) {
        toast(`Could not read subtitles: ${(error as Error).message}`, 'error');
      }
    },
    [selectSubtitle, toast],
  );

  const applySubtitleOffset = useCallback(
    (offset: number) => {
      const upload = uploadsRef.current.find((item) => item.id === activeUpload);
      if (!upload) return;
      for (const cue of Array.from(upload.track.cues ?? [])) upload.track.removeCue(cue);
      for (const cue of upload.cues) upload.track.addCue(toVttCue(cue, offset));
      setSubtitleOffset(offset);
    },
    [activeUpload],
  );

  useEffect(() => {
    if (!pendingSubtitle) return;
    useSession.getState().set({ pendingSubtitle: null });
    void loadSubtitleFile(pendingSubtitle);
  }, [pendingSubtitle, loadSubtitleFile]);

  const toggleCaptions = useCallback(() => {
    if (currentSubtitle) {
      lastSubtitleRef.current = currentSubtitle;
      selectSubtitle(null);
      showOsd('Subtitles off');
      return;
    }
    const target = allSubtitles.find((track) => track.id === lastSubtitleRef.current) ?? allSubtitles[0];
    if (!target) {
      toast('No subtitle tracks. Drop a .srt or .vtt file onto the page to add one.', 'info');
      return;
    }
    selectSubtitle(target.id);
    showOsd(`Subtitles: ${target.label}`);
  }, [allSubtitles, currentSubtitle, selectSubtitle, showOsd, toast]);

  useImperativeHandle(
    ref,
    () => ({
      togglePlay,
      seekBy,
      seekToFraction: (fraction) => seekTo(seekableEnd() * fraction),
      changeVolume: (delta) => applyVolume((muted ? 0 : volume) + delta, true),
      toggleMute,
      toggleFullscreen,
      togglePip: () => void togglePip(),
      toggleCaptions,
      changeSpeed: (direction) => {
        const index = SPEEDS.indexOf(speed);
        const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, (index === -1 ? SPEEDS.indexOf(1) : index) + direction))];
        changeSpeed(next);
      },
    }),
    [applyVolume, changeSpeed, muted, seekBy, seekTo, speed, toggleCaptions, toggleFullscreen, toggleMute, togglePip, togglePlay, volume],
  );

  // ---- Controls auto-hide ----
  const poke = useCallback(() => {
    setControlsActive(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsActive(false), 2600);
  }, []);
  const controlsVisible = controlsActive || !playing || menuOpen || scrubbing || Boolean(diagnosis);

  const onSurfaceClick = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(togglePlay, 220);
  };
  const onSurfaceDoubleClick = () => {
    window.clearTimeout(clickTimer.current);
    toggleFullscreen();
  };

  const onAction = (action: RecoveryAction) => {
    setDiagnosis(null);
    applyRecovery(action);
  };

  const updateBuffered = () => {
    const video = videoRef.current;
    if (!video) return;
    const { buffered } = video;
    for (let i = 0; i < buffered.length; i += 1) {
      if (buffered.start(i) <= video.currentTime + 0.5 && buffered.end(i) >= video.currentTime) {
        setBufferedEnd(buffered.end(i));
        return;
      }
    }
    setBufferedEnd(0);
  };

  const { box, fit } = aspectStyles(aspect);
  const previewSrc = engine?.name === 'native' && source.mode === 'direct' && !live ? playUrl : undefined;
  const effectiveDuration = live ? seekableEnd() : duration;

  return (
    <div
      ref={containerRef}
      className={`group/player relative w-full select-none overflow-hidden bg-black ${isFullscreen ? 'h-full' : theater ? 'h-[calc(100vh-8.5rem)] min-h-[320px]' : 'aspect-video max-h-[75vh] rounded-xl'} ${controlsVisible ? '' : 'cursor-none'}`}
      onPointerMove={poke}
      onPointerDown={poke}
      onMouseLeave={() => playing && setControlsActive(false)}
      data-testid="video-player"
    >
      <div className="absolute inset-0 flex items-center justify-center" style={{ containerType: 'size' }} onClick={onSurfaceClick} onDoubleClick={onSurfaceDoubleClick}>
        <div style={box}>
          <video
            ref={videoRef}
            className="h-full w-full bg-black"
            style={{ objectFit: fit }}
            playsInline
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => {
              setPlaying(false);
              saveProgress(true);
            }}
            onPlaying={() => {
              setWaiting(false);
              setNeedsGesture(false);
            }}
            onWaiting={() => setWaiting(true)}
            onCanPlay={() => setWaiting(false)}
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              setDuration(video.duration);
              setLive(!Number.isFinite(video.duration));
              video.playbackRate = speed;
              if (settings.volume > 1) applyVolume(settings.volume);
              tryPlay();
            }}
            onDurationChange={(event) => {
              setDuration(event.currentTarget.duration);
              setLive(!Number.isFinite(event.currentTarget.duration));
            }}
            onTimeUpdate={(event) => {
              if (!scrubbing) setCurrentTime(event.currentTarget.currentTime);
              saveProgress();
            }}
            onProgress={updateBuffered}
            onSeeked={updateBuffered}
            onEnded={() => {
              setPlaying(false);
              saveProgress(true);
              playNextInPlaylist();
            }}
            onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
          />
        </div>
      </div>

      {waiting && !diagnosis && !diagnosing && !needsGesture && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-white/80" />
        </div>
      )}

      {needsGesture && !diagnosis && (
        <button type="button" onClick={tryPlay} className="absolute inset-0 z-20 flex items-center justify-center bg-black/40" aria-label="Start playback">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent shadow-glow transition hover:scale-105">
            <Play className="ml-1 h-9 w-9 fill-white text-white" />
          </span>
        </button>
      )}

      {osd && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-xl bg-black/70 px-4 py-2 text-lg font-semibold text-white">{osd}</div>
      )}

      {resumeNotice !== null && !diagnosis && (
        <div className="absolute left-4 top-12 z-20 flex animate-slide-up items-center gap-3 rounded-lg bg-black/80 px-3 py-2 text-sm text-white shadow-lg">
          <span>Resumed at {formatTime(resumeNotice)}</span>
          <button
            type="button"
            className="font-semibold text-accent-soft hover:underline"
            onClick={() => {
              seekTo(0);
              setResumeNotice(null);
            }}
          >
            Start over
          </button>
        </div>
      )}

      <div className={`absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-3 transition-opacity duration-200 ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <p className="truncate text-sm font-medium text-white/90">{source.title}</p>
      </div>

      <Controls
        visible={controlsVisible}
        playing={playing}
        currentTime={currentTime}
        duration={effectiveDuration}
        bufferedEnd={bufferedEnd}
        live={live}
        volume={volume}
        muted={muted}
        boostBlocked={boostBlocked}
        isFullscreen={isFullscreen}
        isPip={isPip}
        theater={theater}
        menuOpen={menuOpen}
        previewSrc={previewSrc}
        subtitlesOn={currentSubtitle !== null}
        onTogglePlay={togglePlay}
        onSeek={seekTo}
        onScrubbing={setScrubbing}
        onSeekBy={seekBy}
        onGoLive={() => seekTo(seekableEnd())}
        onVolume={(value) => applyVolume(value)}
        onToggleMute={toggleMute}
        onToggleFullscreen={toggleFullscreen}
        onTogglePip={() => void togglePip()}
        onToggleTheater={() => useSession.getState().set({ theater: !theater })}
        onToggleCaptions={toggleCaptions}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        menu={{
          qualities: engine?.getQualities() ?? [],
          quality: engine?.getQuality() ?? -1,
          activeQualityLabel: engine?.getActiveQualityLabel() ?? null,
          onQuality: (id) => engine?.setQuality(id),
          audioTracks: engine?.getAudioTracks() ?? [],
          audioTrack: engine?.getAudioTrack() ?? -1,
          onAudioTrack: (id) => engine?.setAudioTrack(id),
          subtitles: allSubtitles,
          subtitle: currentSubtitle,
          onSubtitle: selectSubtitle,
          onUploadSubtitle: (file) => void loadSubtitleFile(file),
          subtitleOffset,
          onSubtitleOffset: applySubtitleOffset,
          speed,
          onSpeed: changeSpeed,
          aspect,
          onAspect: setAspect,
        }}
      />

      <ErrorOverlay diagnosis={diagnosis} diagnosing={diagnosing} onAction={onAction} />
    </div>
  );
});
