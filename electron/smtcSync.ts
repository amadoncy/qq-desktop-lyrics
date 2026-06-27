import './smtcEnv.js';
import type { BrowserWindow } from 'electron';
import type { MediaSession } from 'windows-media-sessions';
import { getAllSessions, onSessionsChanged, shutdown } from 'windows-media-sessions';
import type { AppSettings, PlaybackUpdate } from './types.js';
import { resolveLyricsForTrack } from './qqMusicApi.js';
import { runSmtcControl } from './smtcControl.js';

const QQ_APP_HINTS = [
  'qqmusic',
  'qq音乐',
  'tencent.qqmusic',
  'qqmusic.exe',
  'tencent.qqmusicpc',
  'qqmusicpc',
  'y.qq.com',
];

interface PositionAnchor {
  positionMs: number;
  at: number;
  isPlaying: boolean;
}

let unsubscribeSmtc: (() => void) | null = null;
let positionTimer: ReturnType<typeof setInterval> | null = null;
let lyricsWindow: BrowserWindow | null = null;
let getSettings: (() => AppSettings) | null = null;
let anchor: PositionAnchor | null = null;
let lastTrackKey = '';
let lastPlayback: PlaybackUpdate | null = null;
let lyricRequestId = 0;
let lastSession: MediaSession | null = null;
let anchorLockUntil = 0;
let lyricsSeekOverride: { positionSec: number; expiresAt: number } | null = null;

const LYRICS_SEEK_HOLD_MS = 120000;

function isSyncEnabled(): boolean {
  return !getSettings?.().demoMode;
}

function isQQMusicSession(session: MediaSession): boolean {
  const haystack = `${session.sourceAppUserModelId} ${session.sourceAppDisplayName ?? ''}`.toLowerCase();
  return QQ_APP_HINTS.some((hint) => haystack.includes(hint));
}

function pickQQMusicSession(sessions: readonly MediaSession[]): MediaSession | null {
  const qqSessions = sessions.filter(isQQMusicSession);
  const pool = qqSessions.length > 0 ? qqSessions : sessions.filter((s) => s.title);

  if (pool.length === 0) return null;

  const playing = pool.find((s) => s.playbackStatus === 'playing');
  if (playing?.title) return playing;

  const paused = pool.find((s) => s.playbackStatus === 'paused' && s.title);
  if (paused) return paused;

  return pool.find((s) => s.title) ?? pool[0] ?? null;
}

function buildPlayback(session: MediaSession | null, positionSec: number): PlaybackUpdate {
  if (!session?.title) {
    return {
      title: '',
      artist: '',
      album: '',
      positionSec: 0,
      durationSec: 0,
      isPlaying: false,
      source: 'none',
      status: 'idle',
    };
  }

  const durationSec = (session.timeline?.durationMs ?? 0) / 1000;
  const isPlaying = session.playbackStatus === 'playing';

  return {
    title: session.title ?? '',
    artist: session.artist ?? '',
    album: session.albumTitle ?? '',
    positionSec,
    durationSec,
    isPlaying,
    source: 'qqmusic',
    status: isPlaying ? 'playing' : session.playbackStatus === 'paused' ? 'paused' : 'idle',
  };
}

function broadcastPlayback(update: PlaybackUpdate) {
  lastPlayback = update;
  if (!lyricsWindow || lyricsWindow.isDestroyed()) return;
  lyricsWindow.webContents.send('playback:update', update);
}

function broadcastLyricsError(message: string) {
  if (!lyricsWindow || lyricsWindow.isDestroyed()) return;
  lyricsWindow.webContents.send('lyrics:error', message);
}

export function getLastPlayback(): PlaybackUpdate | null {
  return lastPlayback;
}

function getInterpolatedPositionSec(): number {
  if (!anchor) return 0;
  let positionMs = anchor.positionMs;
  if (anchor.isPlaying) {
    positionMs += Date.now() - anchor.at;
  }
  return positionMs / 1000;
}

function clearLyricsSeekOverrideIfNeeded(session: MediaSession | null) {
  if (!lyricsSeekOverride) return;

  if (!session || Date.now() > lyricsSeekOverride.expiresAt) {
    lyricsSeekOverride = null;
    anchorLockUntil = 0;
  }
}

function updateAnchorFromSession(session: MediaSession | null) {
  if (!session) {
    anchor = null;
    lyricsSeekOverride = null;
    return;
  }

  clearLyricsSeekOverrideIfNeeded(session);

  if (lyricsSeekOverride) {
    if (!anchor) {
      applySeekAnchor(lyricsSeekOverride.positionSec);
    } else {
      const nowPlaying = session.playbackStatus === 'playing';
      if (anchor.isPlaying !== nowPlaying) {
        const currentPos = getInterpolatedPositionSec();
        anchor = {
          positionMs: currentPos * 1000,
          at: Date.now(),
          isPlaying: nowPlaying,
        };
      } else {
        anchor.isPlaying = nowPlaying;
      }
    }
    return;
  }

  if (Date.now() < anchorLockUntil) return;

  anchor = {
    positionMs: session.timeline?.positionMs ?? 0,
    at: Date.now(),
    isPlaying: session.playbackStatus === 'playing',
  };
}

async function requestLyrics(title: string, artist: string, cookie: string) {
  const requestId = ++lyricRequestId;
  try {
    const lyrics = await resolveLyricsForTrack(title, artist, cookie);
    if (requestId !== lyricRequestId) return;
    if (!lyricsWindow || lyricsWindow.isDestroyed()) return;
    lyricsWindow.webContents.send('lyrics:updated', lyrics);
  } catch (error) {
    if (requestId !== lyricRequestId) return;
    const message = error instanceof Error ? error.message : '歌词加载失败';
    broadcastLyricsError(message);
  }
}

function handleSessions(sessions: readonly MediaSession[]) {
  if (!isSyncEnabled()) return;

  const session = pickQQMusicSession(sessions);
  lastSession = session;
  updateAnchorFromSession(session);

  const playback = buildPlayback(session, getInterpolatedPositionSec());
  broadcastPlayback(playback);

  if (!session?.title) {
    lastTrackKey = '';
    return;
  }

  const trackKey = `${session.title}\0${session.artist ?? ''}`;
  if (trackKey === lastTrackKey) return;

  lyricsSeekOverride = null;
  anchorLockUntil = 0;
  lastTrackKey = trackKey;
  lyricsWindow?.webContents.send('lyrics:loading', `${session.title} - ${session.artist ?? ''}`);
  void requestLyrics(session.title!, session.artist ?? '', getSettings?.().qqCookie ?? '');
}

function ensureBackendStarted() {
  if (unsubscribeSmtc) return;
  unsubscribeSmtc = onSessionsChanged(handleSessions);
  startPositionTicker();
}

function startPositionTicker() {
  if (positionTimer) return;
  positionTimer = setInterval(() => {
    if (!isSyncEnabled() || !anchor || !lastPlayback) return;
    if (lastPlayback.source !== 'qqmusic') return;

    broadcastPlayback({
      ...lastPlayback,
      positionSec: getInterpolatedPositionSec(),
      isPlaying: anchor.isPlaying,
      status: anchor.isPlaying ? 'playing' : 'paused',
    });
    }, 50);
}

function stopPositionTicker() {
  if (!positionTimer) return;
  clearInterval(positionTimer);
  positionTimer = null;
}

function applySeekAnchor(positionSec: number) {
  anchor = {
    positionMs: positionSec * 1000,
    at: Date.now(),
    isPlaying: anchor?.isPlaying ?? lastPlayback?.isPlaying ?? true,
  };

  if (lastPlayback) {
    const update = {
      ...lastPlayback,
      positionSec,
      isPlaying: anchor.isPlaying,
      status: anchor.isPlaying ? ('playing' as const) : ('paused' as const),
    };
    broadcastPlayback(update);
  }
}

export async function seekPlayback(_positionSec: number): Promise<PlaybackUpdate | null> {
  // 歌词拖动仅在前端预览，不控制 QQ 音乐进度
  return lastPlayback;
}

export async function togglePlayback(): Promise<void> {
  if (!isSyncEnabled()) {
    throw new Error('当前没有可控制的播放会话');
  }
  await runSmtcControl('toggle');
  if (anchor) {
    anchor.isPlaying = !anchor.isPlaying;
    anchor.at = Date.now();
  } else if (lastPlayback) {
    anchor = {
      positionMs: lastPlayback.positionSec * 1000,
      at: Date.now(),
      isPlaying: !lastPlayback.isPlaying,
    };
  }
  setTimeout(() => void refreshPlaybackNow(), 150);
}

export async function skipNext(): Promise<void> {
  if (!isSyncEnabled()) {
    throw new Error('当前没有可控制的播放会话');
  }
  await runSmtcControl('next');
  lastTrackKey = '';
  setTimeout(() => void refreshPlaybackNow(), 400);
}

export async function skipPrevious(): Promise<void> {
  if (!isSyncEnabled()) {
    throw new Error('当前没有可控制的播放会话');
  }
  await runSmtcControl('previous');
  lastTrackKey = '';
  setTimeout(() => void refreshPlaybackNow(), 400);
}

export async function refreshPlaybackNow(): Promise<PlaybackUpdate | null> {
  if (!isSyncEnabled()) return null;

  try {
    const sessions = await getAllSessions();
    handleSessions(sessions);
    return lastPlayback;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[smtcSync] failed to read sessions', error);
    broadcastLyricsError(
      detail.includes('Backend executable not found')
        ? 'SMTC 后端未找到，请重新安装或从源码打包'
        : `SMTC 读取失败：${detail}`,
    );
    return null;
  }
}

export function initSmtcBackend(settingsGetter: () => AppSettings) {
  getSettings = settingsGetter;
  if (!isSyncEnabled()) return;
  ensureBackendStarted();
}

export function startSmtcSync(window: BrowserWindow, settingsGetter: () => AppSettings) {
  lyricsWindow = window;
  getSettings = settingsGetter;
  if (!isSyncEnabled()) return;

  ensureBackendStarted();
  void refreshPlaybackNow();
}

export function stopSmtcSync() {
  unsubscribeSmtc?.();
  unsubscribeSmtc = null;
  stopPositionTicker();
  anchor = null;
  lastTrackKey = '';
  lastPlayback = null;
  lastSession = null;
  lyricsSeekOverride = null;
  anchorLockUntil = 0;
  lyricRequestId++;
}

export function resetLyricSync() {
  lastTrackKey = '';
  lyricRequestId++;
  if (lastSession?.title && isSyncEnabled()) {
    lyricsWindow?.webContents.send('lyrics:loading', `${lastSession.title} - ${lastSession.artist ?? ''}`);
    void requestLyrics(lastSession.title!, lastSession.artist ?? '', getSettings?.().qqCookie ?? '');
  }
}

export function refreshSmtcSyncWindow(window: BrowserWindow | null) {
  lyricsWindow = window;
  if (window && isSyncEnabled()) {
    void refreshPlaybackNow();
  }
}

export async function shutdownSmtcBackend() {
  stopSmtcSync();
  await shutdown();
}
