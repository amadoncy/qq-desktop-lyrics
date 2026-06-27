/// <reference types="vite/client" />

export interface AppSettings {
  themeId: string;
  accentHex: string;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  opacity: number;
  demoMode: boolean;
  qqCookie: string;
  wordKaraoke: boolean;
  lyricsFontScale: number;
  autoLaunch: boolean;
  closeToTray: boolean;
  hideLyricsOnLaunch: boolean;
}

export interface PlaybackUpdate {
  title: string;
  artist: string;
  album: string;
  positionSec: number;
  durationSec: number;
  isPlaying: boolean;
  source: 'qqmusic' | 'none';
  status: 'playing' | 'paused' | 'idle';
}

declare global {
  interface Window {
    desktopLyrics?: {
      getSettings: () => Promise<AppSettings>;
      updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      openSettings: () => Promise<void>;
      setInteractive: (interactive: boolean) => Promise<void>;
      toggleClickThrough: () => Promise<boolean>;
      loadDemoLyrics: () => Promise<string>;
      loadLyricsFile: () => Promise<string | null>;
      broadcastLyrics: (text: string) => Promise<boolean>;
      onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
      onLyricsUpdated: (callback: (text: string) => void) => () => void;
      onPlaybackUpdate: (callback: (playback: PlaybackUpdate) => void) => () => void;
      onLyricsError: (callback: (message: string) => void) => () => void;
      onLyricsLoading: (callback: (label: string) => void) => () => void;
      getPlaybackSnapshot: () => Promise<PlaybackUpdate | null>;
      notifyOverlayReady: () => Promise<PlaybackUpdate | null>;
      togglePlayback: () => Promise<PlaybackUpdate | null>;
      skipNext: () => Promise<PlaybackUpdate | null>;
      skipPrevious: () => Promise<PlaybackUpdate | null>;
      seekPlayback: (positionSec: number) => Promise<PlaybackUpdate | null>;
    };
  }
}

export {};
