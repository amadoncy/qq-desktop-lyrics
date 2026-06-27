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
  /** 开机自启（Windows 登录项） */
  autoLaunch: boolean;
  /** 关闭歌词窗口时最小化到托盘，不退出应用 */
  closeToTray: boolean;
  /** 启动时不显示歌词窗口，仅从托盘使用 */
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
