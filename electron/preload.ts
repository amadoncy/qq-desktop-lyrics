import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, PlaybackUpdate } from './types.js';

export type { AppSettings, PlaybackUpdate };

contextBridge.exposeInMainWorld('desktopLyrics', {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', patch),
  openSettings: (): Promise<void> => ipcRenderer.invoke('window:open-settings'),
  setInteractive: (interactive: boolean): Promise<void> =>
    ipcRenderer.invoke('window:set-interactive', interactive),
  toggleClickThrough: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-click-through'),
  loadDemoLyrics: (): Promise<string> => ipcRenderer.invoke('lyrics:load-demo'),
  loadLyricsFile: (): Promise<string | null> => ipcRenderer.invoke('lyrics:load-file'),
  broadcastLyrics: (text: string): Promise<boolean> => ipcRenderer.invoke('lyrics:broadcast', text),
  onSettingsChanged: (callback: (settings: AppSettings) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, next: AppSettings) => callback(next);
    ipcRenderer.on('settings:changed', listener);
    return () => ipcRenderer.removeListener('settings:changed', listener);
  },
  onLyricsUpdated: (callback: (text: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, text: string) => callback(text);
    ipcRenderer.on('lyrics:updated', listener);
    return () => ipcRenderer.removeListener('lyrics:updated', listener);
  },
  onPlaybackUpdate: (callback: (playback: PlaybackUpdate) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, playback: PlaybackUpdate) => callback(playback);
    ipcRenderer.on('playback:update', listener);
    return () => ipcRenderer.removeListener('playback:update', listener);
  },
  onLyricsError: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on('lyrics:error', listener);
    return () => ipcRenderer.removeListener('lyrics:error', listener);
  },
  onLyricsLoading: (callback: (label: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, label: string) => callback(label);
    ipcRenderer.on('lyrics:loading', listener);
    return () => ipcRenderer.removeListener('lyrics:loading', listener);
  },
  getPlaybackSnapshot: (): Promise<PlaybackUpdate | null> => ipcRenderer.invoke('playback:get-snapshot'),
  notifyOverlayReady: (): Promise<PlaybackUpdate | null> => ipcRenderer.invoke('overlay:ready'),
  togglePlayback: (): Promise<PlaybackUpdate | null> => ipcRenderer.invoke('playback:toggle'),
  skipNext: (): Promise<PlaybackUpdate | null> => ipcRenderer.invoke('playback:next'),
  skipPrevious: (): Promise<PlaybackUpdate | null> => ipcRenderer.invoke('playback:previous'),
  seekPlayback: (positionSec: number): Promise<PlaybackUpdate | null> =>
    ipcRenderer.invoke('playback:seek', positionSec),
});
