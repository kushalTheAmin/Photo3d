import { useEffect, type RefObject } from 'react';
import type { PlayerHandle } from '../components/player/VideoPlayer';
import { useSession } from '../store/session';
import { isEditableTarget } from './useGlobalInput';

export function useKeyboardShortcuts(playerRef: RefObject<PlayerHandle>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const session = useSession.getState();
      if (event.key === 'Escape') {
        if (session.shortcutsOpen) session.set({ shortcutsOpen: false });
        else if (session.theater && !document.fullscreenElement) session.set({ theater: false });
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target)) return;

      if (event.key === '?') {
        session.set({ shortcutsOpen: !session.shortcutsOpen });
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('[data-url-input]')?.focus();
        return;
      }
      if (event.key === 't' || event.key === 'T') {
        if (session.source) session.set({ theater: !session.theater });
        return;
      }

      const player = playerRef.current;
      if (!player) return;
      const handled = (() => {
        switch (event.key) {
          case ' ':
          case 'k':
          case 'K':
            player.togglePlay();
            return true;
          case 'ArrowLeft':
            player.seekBy(-5);
            return true;
          case 'ArrowRight':
            player.seekBy(5);
            return true;
          case 'j':
          case 'J':
            player.seekBy(-10);
            return true;
          case 'l':
          case 'L':
            player.seekBy(10);
            return true;
          case 'ArrowUp':
            player.changeVolume(0.05);
            return true;
          case 'ArrowDown':
            player.changeVolume(-0.05);
            return true;
          case 'f':
          case 'F':
            player.toggleFullscreen();
            return true;
          case 'p':
          case 'P':
            player.togglePip();
            return true;
          case 'm':
          case 'M':
            player.toggleMute();
            return true;
          case 'c':
          case 'C':
            player.toggleCaptions();
            return true;
          case '<':
          case ',':
            if (event.key === ',' && !event.shiftKey) return false;
            player.changeSpeed(-1);
            return true;
          case '>':
          case '.':
            if (event.key === '.' && !event.shiftKey) return false;
            player.changeSpeed(1);
            return true;
          default:
            if (/^[0-9]$/.test(event.key)) {
              player.seekToFraction(Number(event.key) / 10);
              return true;
            }
            return false;
        }
      })();
      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playerRef]);
}
