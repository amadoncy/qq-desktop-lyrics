import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import fsPromises from 'node:fs/promises';
import type { AppSettings } from './types.js';
import { refreshSmtcSyncWindow, initSmtcBackend, refreshPlaybackNow, resetLyricSync, shutdownSmtcBackend, startSmtcSync, stopSmtcSync, seekPlayback, togglePlayback, skipNext, skipPrevious } from './smtcSync.js';
import { clearLyricCache } from './qqMusicApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;

const defaultSettings: AppSettings = {
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

let lyricsWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settings: AppSettings = { ...defaultSettings };
let clickThroughPollTimer: ReturnType<typeof setInterval> | null = null;
let isQuitting = false;

const CHROME_HIT_HEIGHT = 120;
const CONTROLS_HIT_HEIGHT = 80;

function stopClickThroughPolling() {
  if (clickThroughPollTimer) {
    clearInterval(clickThroughPollTimer);
    clickThroughPollTimer = null;
  }
}

function syncClickThroughHitTest() {
  if (!lyricsWindow || settingsWindow || !settings.clickThrough) return;

  const bounds = lyricsWindow.getBounds();
  const cursor = screen.getCursorScreenPoint();
  const inWindow =
    cursor.x >= bounds.x &&
    cursor.x <= bounds.x + bounds.width &&
    cursor.y >= bounds.y &&
    cursor.y <= bounds.y + bounds.height;
  const inTopZone = inWindow && cursor.y <= bounds.y + CHROME_HIT_HEIGHT;
  const inBottomZone = inWindow && cursor.y >= bounds.y + bounds.height - CONTROLS_HIT_HEIGHT;
  const interactive = inTopZone || inBottomZone;

  lyricsWindow.setIgnoreMouseEvents(!interactive, { forward: true });
}

function applyClickThroughMode() {
  stopClickThroughPolling();
  if (!lyricsWindow) return;

  if (!settings.clickThrough) {
    lyricsWindow.setIgnoreMouseEvents(false);
    return;
  }

  syncClickThroughHitTest();
  clickThroughPollTimer = setInterval(syncClickThroughHitTest, 100);
}

function openSettingsWindow() {
  if (lyricsWindow && settings.clickThrough) {
    stopClickThroughPolling();
    lyricsWindow.setIgnoreMouseEvents(false);
  }
  createSettingsWindow();
}

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

async function loadSettings() {
  try {
    const raw = await fsPromises.readFile(settingsPath(), 'utf8');
    settings = { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    settings = { ...defaultSettings };
  }
}

async function saveSettings() {
  await fsPromises.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fsPromises.writeFile(settingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

function getPreloadPath() {
  const preloadPath = path.resolve(__dirname, 'preload.cjs');
  if (!fs.existsSync(preloadPath)) {
    console.error('[main] preload.cjs 不存在:', preloadPath);
  }
  return preloadPath;
}

function getDemoLyricsPath() {
  return path.join(app.getAppPath(), isDev ? 'public/demo.lrc' : 'dist/demo.lrc');
}

function resolveIconPath(): string {
  const candidates = [
    path.join(process.resourcesPath, 'icon.png'),
    path.join(app.getAppPath(), 'build/icon.png'),
    path.resolve(__dirname, '../build/icon.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[candidates.length - 1];
}

function loadAppIcon() {
  try {
    const iconPath = resolveIconPath();
    if (fs.existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath);
    }
  } catch (error) {
    console.warn('[main] 无法加载应用图标:', error);
  }

  return nativeImage.createEmpty();
}

function applyAutoLaunch(enabled: boolean) {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: isDev ? [app.getAppPath()] : [],
    });
    return;
  }

  app.setLoginItemSettings({ openAtLogin: enabled });
}

function applySyncMode() {
  if (!lyricsWindow) return;
  refreshSmtcSyncWindow(lyricsWindow);
  if (settings.demoMode) {
    stopSmtcSync();
    return;
  }
  startSmtcSync(lyricsWindow, () => settings);
}

function applyFramelessWindowFixes(window: BrowserWindow) {
  if (process.platform !== 'win32') return;

  const suppressPhantomTitleBar = () => {
    if (window.isDestroyed()) return;
    window.setBackgroundColor('#00000000');
    window.setTitle('');
    const [width, height] = window.getSize();
    window.setSize(width, height + 1);
    window.setSize(width, height);
  };

  window.on('blur', suppressPhantomTitleBar);
  window.on('focus', suppressPhantomTitleBar);
  window.on('show', suppressPhantomTitleBar);
  window.on('restore', suppressPhantomTitleBar);
}

function createLyricsWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const appIcon = loadAppIcon();

  lyricsWindow = new BrowserWindow({
    width: 900,
    height: 520,
    x: Math.round(width * 0.08),
    y: Math.round(height * 0.18),
    transparent: true,
    frame: false,
    title: '',
    autoHideMenuBar: true,
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: false,
    hasShadow: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: false,
    backgroundColor: '#00000000',
    icon: appIcon.isEmpty() ? undefined : appIcon,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  lyricsWindow.setMenu(null);
  lyricsWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    lyricsWindow?.setTitle('');
  });

  applyFramelessWindowFixes(lyricsWindow);

  lyricsWindow.setOpacity(settings.opacity);

  if (settings.clickThrough) {
    applyClickThroughMode();
  }

  const hash = '#/overlay';
  if (isDev && devServerUrl) {
    lyricsWindow.loadURL(`${devServerUrl}${hash}`);
  } else {
    lyricsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/overlay' });
  }

  lyricsWindow.on('closed', () => {
    lyricsWindow = null;
    refreshSmtcSyncWindow(null);
  });

  lyricsWindow.on('close', (event) => {
    if (isQuitting || !settings.closeToTray) return;
    event.preventDefault();
    lyricsWindow?.hide();
  });

  lyricsWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[main] preload 加载失败:', preloadPath, error);
  });

  lyricsWindow.webContents.on('did-finish-load', () => {
    lyricsWindow?.setTitle('');
    applySyncMode();
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const appIcon = loadAppIcon();

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 360,
    minHeight: 520,
    title: 'QQ Desktop Lyrics - 设置',
    backgroundColor: '#07111f',
    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#07111f',
      symbolColor: '#e2e8f0',
      height: 36,
    },
    icon: appIcon.isEmpty() ? undefined : appIcon,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const hash = '#/settings';
  if (isDev && devServerUrl) {
    settingsWindow.loadURL(`${devServerUrl}${hash}`);
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/settings' });
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    applyClickThroughMode();
  });
}

function createTray() {
  const appIcon = loadAppIcon();
  const icon = appIcon.isEmpty()
    ? nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFklEQVR42mNk+M9Qz0AEYBxVSF+FABJ/AA8lQ8f/AAAAAElFTkSuQmCC',
      )
    : appIcon.resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('QQ Desktop Lyrics');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示歌词窗口', click: () => lyricsWindow?.show() },
    { label: '隐藏歌词窗口', click: () => lyricsWindow?.hide() },
    { type: 'separator' },
    { label: '设置', click: () => openSettingsWindow() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => openSettingsWindow());
}

function registerIpc() {
  ipcMain.handle('settings:get', () => settings);

  ipcMain.handle('settings:update', async (_event, patch: Partial<AppSettings>) => {
    const demoModeChanged = patch.demoMode !== undefined && patch.demoMode !== settings.demoMode;
    const autoLaunchChanged = patch.autoLaunch !== undefined && patch.autoLaunch !== settings.autoLaunch;
    settings = { ...settings, ...patch };
    await saveSettings();

    if (autoLaunchChanged) {
      applyAutoLaunch(settings.autoLaunch);
    }

    if (lyricsWindow) {
      if (patch.alwaysOnTop !== undefined) lyricsWindow.setAlwaysOnTop(settings.alwaysOnTop);
      if (patch.opacity !== undefined) lyricsWindow.setOpacity(settings.opacity);
      if (patch.clickThrough !== undefined) {
        applyClickThroughMode();
      }
      lyricsWindow.webContents.send('settings:changed', settings);
    }

    if (demoModeChanged) {
      applySyncMode();
    } else if (patch.qqCookie !== undefined && !settings.demoMode) {
      clearLyricCache();
      resetLyricSync();
    }

    return settings;
  });

  ipcMain.handle('window:open-settings', () => {
    openSettingsWindow();
  });

  ipcMain.handle('window:set-interactive', (_event, interactive: boolean) => {
    if (!lyricsWindow || !settings.clickThrough || settingsWindow) return;
    if (interactive) {
      stopClickThroughPolling();
      lyricsWindow.setIgnoreMouseEvents(false);
      return;
    }
    applyClickThroughMode();
  });

  ipcMain.handle('window:toggle-click-through', async () => {
    settings.clickThrough = !settings.clickThrough;
    await saveSettings();
    applyClickThroughMode();
    return settings.clickThrough;
  });

  ipcMain.handle('lyrics:load-demo', async () => {
    return fsPromises.readFile(getDemoLyricsPath(), 'utf8');
  });

  ipcMain.handle('lyrics:load-file', async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'LRC Lyrics', extensions: ['lrc'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return fsPromises.readFile(result.filePaths[0], 'utf8');
  });

  ipcMain.handle('lyrics:broadcast', (_event, text: string) => {
    lyricsWindow?.webContents.send('lyrics:updated', text);
    return true;
  });

  ipcMain.handle('playback:get-snapshot', () => refreshPlaybackNow());

  ipcMain.handle('overlay:ready', () => refreshPlaybackNow());

  ipcMain.handle('playback:toggle', async () => {
    await togglePlayback();
    return refreshPlaybackNow();
  });

  ipcMain.handle('playback:next', async () => {
    await skipNext();
    return refreshPlaybackNow();
  });

  ipcMain.handle('playback:previous', async () => {
    await skipPrevious();
    return refreshPlaybackNow();
  });

  ipcMain.handle('playback:seek', async (_event, positionSec: number) => {
    return seekPlayback(positionSec);
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('io.github.qq-desktop-lyrics');
  }

  await loadSettings();
  applyAutoLaunch(settings.autoLaunch);
  registerIpc();
  initSmtcBackend(() => settings);
  if (!settings.demoMode) {
    void refreshPlaybackNow();
  }
  createLyricsWindow();
  if (settings.hideLyricsOnLaunch) {
    lyricsWindow?.hide();
  }
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLyricsWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  stopClickThroughPolling();
  void shutdownSmtcBackend();
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return;
  if (settings.closeToTray && tray) return;
  app.quit();
});
