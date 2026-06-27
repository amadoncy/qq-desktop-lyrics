import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripHorizontal, Settings2 } from 'lucide-react';
import { LyricsDisplay } from '@/components/LyricsDisplay';
import { PlaybackControls } from '@/components/PlaybackControls';
import { createDemoPlayback } from '@/lib/mediaSession';
import { getThemeById } from '@/lib/themes';
import type { AppSettings, PlaybackUpdate } from './vite-env';

const DEFAULT_SETTINGS: AppSettings = {
  themeId: 'nocturnal',
  accentHex: '#22d3ee',
  alwaysOnTop: true,
  clickThrough: false,
  opacity: 0.95,
  demoMode: false,
  qqCookie: '',
  wordKaraoke: false,
  lyricsFontScale: 1,
  autoLaunch: false,
  closeToTray: true,
  hideLyricsOnLaunch: false,
};

function isElectronRuntime(): boolean {
  return navigator.userAgent.includes('Electron');
}

function getBridgeErrorHint(): string {
  if (!isElectronRuntime()) {
    return '这是浏览器预览，请关掉此页，用 npm start 打开的 Electron 窗口';
  }
  return 'Electron 桥接失败，请完全退出后重新 npm start';
}

async function waitForDesktopLyrics(maxMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (window.desktopLyrics) return window.desktopLyrics;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return window.desktopLyrics;
}

function applyPlaybackUpdate(
  update: PlaybackUpdate,
  setPlayback: React.Dispatch<React.SetStateAction<PlaybackUpdate | null>>,
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>,
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>,
  setSyncHint: React.Dispatch<React.SetStateAction<string>>,
) {
  setPlayback(update);
  setCurrentTime(update.positionSec);
  setIsPlaying(update.isPlaying);
  if (update.status === 'idle') {
    setSyncHint('未检测到 QQ 音乐，请先播放歌曲');
  }
}

export const OverlayApp: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [lyricsText, setLyricsText] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playback, setPlayback] = useState<PlaybackUpdate | null>(null);
  const [syncHint, setSyncHint] = useState('等待 QQ 音乐...');
  const demoRef = useRef<ReturnType<typeof createDemoPlayback> | null>(null);
  const demoModeRef = useRef(false);
  const prevDemoModeRef = useRef<boolean | null>(null);
  const hideChromeTimerRef = useRef<number | null>(null);
  const [chromeVisible, setChromeVisible] = useState(false);

  const scheduleHideChrome = useCallback(() => {
    if (hideChromeTimerRef.current) {
      window.clearTimeout(hideChromeTimerRef.current);
    }
    hideChromeTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false);
    }, 2500);
  }, []);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    scheduleHideChrome();
  }, [scheduleHideChrome]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const nearTop = event.clientY <= 56;
      const nearBottom = event.clientY >= window.innerHeight - 96;
      if (nearTop || nearBottom) {
        showChrome();
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (hideChromeTimerRef.current) {
        window.clearTimeout(hideChromeTimerRef.current);
      }
    };
  }, [showChrome]);

  useEffect(() => {
    demoModeRef.current = settings?.demoMode ?? false;
  }, [settings?.demoMode]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer = 0;
    let stopSettings: (() => void) | undefined;
    let stopLyrics: (() => void) | undefined;
    let stopPlayback: (() => void) | undefined;
    let stopLyricsError: (() => void) | undefined;
    let stopLyricsLoading: (() => void) | undefined;

    const bootstrap = async (bridge: NonNullable<typeof window.desktopLyrics>) => {
      try {
        const loaded = await bridge.getSettings();
        if (cancelled) return;
        setSettings(loaded);
        prevDemoModeRef.current = loaded.demoMode;

        if (loaded.demoMode) {
          const demoLyrics = await bridge.loadDemoLyrics();
          if (cancelled) return;
          setLyricsText(demoLyrics);
          setSyncHint('');
        } else {
          setLyricsText('');
          setSyncHint('等待 QQ 音乐...');
        }
      } catch (error) {
        console.error('[OverlayApp] bootstrap failed', error);
        if (cancelled) return;
        setSettings(DEFAULT_SETTINGS);
      }
    };

    const pullPlayback = async (bridge: NonNullable<typeof window.desktopLyrics>) => {
      if (demoModeRef.current) return null;
      const update = (await bridge.notifyOverlayReady()) ?? (await bridge.getPlaybackSnapshot());
      if (update) {
        applyPlaybackUpdate(update, setPlayback, setCurrentTime, setIsPlaying, setSyncHint);
      }
      return update;
    };

    const init = async () => {
      const bridge = await waitForDesktopLyrics();
      if (cancelled) return;

      if (!bridge) {
        setSyncHint(getBridgeErrorHint());
        return;
      }

      void bootstrap(bridge);

      stopSettings = bridge.onSettingsChanged((next) => {
        const demoModeChanged =
          prevDemoModeRef.current !== null && prevDemoModeRef.current !== next.demoMode;
        prevDemoModeRef.current = next.demoMode;

        setSettings(next);

        if (next.demoMode) {
          void bridge.loadDemoLyrics().then(setLyricsText);
          setSyncHint('');
          return;
        }

        if (demoModeChanged) {
          setLyricsText('');
          setCurrentTime(0);
          setSyncHint('等待 QQ 音乐...');
          void pullPlayback(bridge);
        }
      });

      stopLyrics = bridge.onLyricsUpdated((text) => {
        setLyricsText(text);
        setCurrentTime(0);
        setSyncHint('');
        demoRef.current?.reset();
      });

      stopPlayback = bridge.onPlaybackUpdate((update) => {
        if (demoModeRef.current) return;
        applyPlaybackUpdate(update, setPlayback, setCurrentTime, setIsPlaying, setSyncHint);
      });

      stopLyricsError = bridge.onLyricsError((message) => {
        setSyncHint(message);
      });

      stopLyricsLoading = bridge.onLyricsLoading(() => {
        setSyncHint('正在加载歌词...');
      });

      void pullPlayback(bridge);
      pollTimer = window.setInterval(() => {
        void pullPlayback(bridge);
      }, 2000);
    };

    void init();

    return () => {
      cancelled = true;
      if (pollTimer) window.clearInterval(pollTimer);
      stopSettings?.();
      stopLyrics?.();
      stopPlayback?.();
      stopLyricsError?.();
      stopLyricsLoading?.();
    };
  }, []);

  useEffect(() => {
    if (!settings) return;

    demoRef.current?.dispose();
    demoRef.current = null;

    if (settings.demoMode) {
      demoRef.current = createDemoPlayback((position, playing) => {
        setCurrentTime(position);
        setIsPlaying(playing);
      });
      return () => demoRef.current?.dispose();
    }

    return undefined;
  }, [settings?.demoMode]);

  const theme = getThemeById(settings?.themeId ?? 'nocturnal');
  const accentHex = settings?.accentHex || theme.accent;
  const controlsDisabled = !settings?.demoMode && playback?.status === 'idle';

  const handleToggle = useCallback(async () => {
    showChrome();
    if (settings?.demoMode) {
      demoRef.current?.togglePlaying();
      return;
    }
    try {
      const update = await window.desktopLyrics?.togglePlayback();
      if (update) {
        applyPlaybackUpdate(update, setPlayback, setCurrentTime, setIsPlaying, setSyncHint);
      }
    } catch (error) {
      console.error('[OverlayApp] toggle failed', error);
    }
  }, [settings?.demoMode, showChrome]);

  const handleNext = useCallback(async () => {
    showChrome();
    if (settings?.demoMode) return;
    try {
      const update = await window.desktopLyrics?.skipNext();
      if (update) {
        applyPlaybackUpdate(update, setPlayback, setCurrentTime, setIsPlaying, setSyncHint);
      }
    } catch (error) {
      console.error('[OverlayApp] next failed', error);
    }
  }, [settings?.demoMode, showChrome]);

  const handlePrevious = useCallback(async () => {
    showChrome();
    if (settings?.demoMode) return;
    try {
      const update = await window.desktopLyrics?.skipPrevious();
      if (update) {
        applyPlaybackUpdate(update, setPlayback, setCurrentTime, setIsPlaying, setSyncHint);
      }
    } catch (error) {
      console.error('[OverlayApp] previous failed', error);
    }
  }, [settings?.demoMode, showChrome]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      <div
        className="absolute inset-x-0 top-0 z-40 h-14"
        aria-hidden
        onMouseEnter={showChrome}
      />

      {chromeVisible && (
        <div
          className="drag-region absolute inset-x-0 top-0 z-50 flex h-10 items-center justify-between px-3 transition-all duration-300 ease-out"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          onMouseEnter={showChrome}
        >
          <div className="flex items-center gap-2 text-white/50">
            <GripHorizontal size={14} />
            <span className="font-mono text-[10px] tracking-[0.24em] uppercase">QQ Desktop Lyrics</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="no-drag rounded-md p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              onMouseEnter={showChrome}
              onClick={() => {
                showChrome();
                void window.desktopLyrics?.openSettings();
              }}
              title="打开设置"
            >
              <Settings2 size={14} />
            </button>
          </div>
        </div>
      )}

      {chromeVisible && !settings?.demoMode && playback?.title && (
        <div className="pointer-events-none absolute top-12 left-6 z-40 max-w-[70%]">
          <p className="font-sans text-xs tracking-[0.18em] text-white/35 uppercase">Now Playing</p>
          <p className="mt-1 truncate font-sans text-sm text-white/80">{playback.title}</p>
          <p className="truncate font-sans text-xs text-white/45">{playback.artist}</p>
        </div>
      )}

      <div className="absolute inset-0 pb-16">
        <LyricsDisplay
          lrcText={lyricsText}
          currentTime={currentTime}
          accentHex={accentHex}
          theme={theme}
          isPlaying={isPlaying}
          wordKaraoke={settings?.wordKaraoke ?? false}
          fontScale={settings?.lyricsFontScale ?? 1}
        />
      </div>

      <PlaybackControls
        visible={chromeVisible}
        isPlaying={isPlaying}
        accentHex={accentHex}
        disabled={controlsDisabled}
        onToggle={() => void handleToggle()}
        onPrevious={() => void handlePrevious()}
        onNext={() => void handleNext()}
        onMouseEnter={showChrome}
      />

      <div className="pointer-events-none absolute right-4 bottom-16 max-w-[70%] text-right">
        {settings?.demoMode ? (
          <span className="inline-block rounded-full border border-white/10 bg-black/30 px-3 py-1 font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase backdrop-blur-sm">
            Demo Mode
          </span>
        ) : syncHint ? (
          <span className="inline-block rounded-full border border-cyan-300/15 bg-black/30 px-3 py-1 font-mono text-[10px] tracking-[0.12em] text-cyan-200/55 backdrop-blur-sm">
            {syncHint}
          </span>
        ) : null}
      </div>
    </div>
  );
};
