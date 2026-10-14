import { useEffect, useState } from 'react';
import { openLocalFile, openUrl } from '../lib/controller';
import { isSubtitleFile } from '../lib/subtitles';
import { useSession } from '../store/session';

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function handleFiles(files: FileList | File[]): boolean {
  const list = Array.from(files);
  if (!list.length) return false;
  const session = useSession.getState();
  const subtitle = list.find((file) => isSubtitleFile(file.name));
  const media = list.find((file) => !isSubtitleFile(file.name));
  if (media) openLocalFile(media);
  if (subtitle) {
    const mode = session.source?.mode;
    if (media || mode === 'direct' || mode === 'hls' || mode === 'dash') session.set({ pendingSubtitle: subtitle });
    else session.toast('Start a video in the built-in player first, then drop the subtitle file.', 'info');
  }
  return true;
}

function firstUri(data: DataTransfer): string {
  const uriList = data.getData('text/uri-list');
  const fromList = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'));
  return fromList ?? data.getData('text/plain').trim();
}

/**
 * Ctrl/⌘+V anywhere (outside text fields) and drag-and-drop of links, video
 * files or .srt/.vtt subtitles onto the window.
 */
export function useGlobalInput(): boolean {
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    let depth = 0;

    const onPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target) || !event.clipboardData) return;
      if (event.clipboardData.files.length && handleFiles(event.clipboardData.files)) {
        event.preventDefault();
        return;
      }
      const text = event.clipboardData.getData('text/plain');
      if (text.trim()) {
        event.preventDefault();
        void openUrl(text);
      }
    };

    const accepts = (event: DragEvent) => {
      const types = Array.from(event.dataTransfer?.types ?? []);
      return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/plain');
    };

    const onDragEnter = (event: DragEvent) => {
      if (!accepts(event)) return;
      event.preventDefault();
      depth += 1;
      setDragActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!accepts(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragActive(false);
    };
    const onDrop = (event: DragEvent) => {
      depth = 0;
      setDragActive(false);
      if (!event.dataTransfer) return;
      event.preventDefault();
      if (event.dataTransfer.files.length && handleFiles(event.dataTransfer.files)) return;
      const uri = firstUri(event.dataTransfer);
      if (uri) void openUrl(uri);
    };

    document.addEventListener('paste', onPaste);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return dragActive;
}
