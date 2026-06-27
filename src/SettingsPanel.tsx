import React, { useEffect, useState } from 'react';
import { BUILT_IN_THEMES, getThemeById } from '@/lib/themes';
import type { AppSettings } from './vite-env';

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [savedHint, setSavedHint] = useState('');

  useEffect(() => {
    window.desktopLyrics?.getSettings().then(setSettings);
  }, []);

  const update = async (patch: Partial<AppSettings>) => {
    if (!window.desktopLyrics) return;
    const next = await window.desktopLyrics.updateSettings(patch);
    setSettings(next);
    setSavedHint('已保存');
    window.setTimeout(() => setSavedHint(''), 1200);
  };

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111f] text-white/50">
        加载设置中...
      </div>
    );
  }

  const activeTheme = getThemeById(settings.themeId);

  return (
    <div className="min-h-screen bg-[#07111f] pb-10 text-white">
      <div
        className="sticky top-0 z-10 border-b border-white/5 bg-[#07111f]/95 px-6 py-4 backdrop-blur-sm"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <p className="font-mono text-[11px] tracking-[0.28em] text-cyan-300/70 uppercase">Settings</p>
        <h1 className="mt-1 font-sans text-xl font-semibold tracking-tight">QQ Desktop Lyrics</h1>
      </div>

      <div className="mx-auto max-w-md px-6 py-6">
        <p className="text-sm leading-6 text-white/45">
          关闭 Demo 模式后，将通过 Windows SMTC 读取 QQ 音乐播放进度，并自动从 QQ 音乐拉取歌词。
        </p>

        <section className="mt-8 space-y-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5 backdrop-blur-sm">
          <h2 className="font-mono text-xs tracking-[0.22em] text-white/55 uppercase">常规</h2>

          <label className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="text-white/70">开机自启</p>
              <p className="mt-1 text-xs text-white/35">登录 Windows 后自动启动本程序（歌词窗口是否显示见下方选项）</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoLaunch ?? false}
              onChange={(e) => update({ autoLaunch: e.target.checked })}
              className="h-4 w-4 accent-cyan-300"
            />
          </label>

          <label className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="text-white/70">关闭时最小化到托盘</p>
              <p className="mt-1 text-xs text-white/35">关闭歌词窗口时不退出程序，可从托盘再次显示；完全退出请用托盘菜单「退出」</p>
            </div>
            <input
              type="checkbox"
              checked={settings.closeToTray ?? true}
              onChange={(e) => update({ closeToTray: e.target.checked })}
              className="h-4 w-4 accent-cyan-300"
            />
          </label>

          <label className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="text-white/70">启动时隐藏歌词窗口</p>
              <p className="mt-1 text-xs text-white/35">程序在后台运行，仅从托盘图标打开歌词或设置</p>
            </div>
            <input
              type="checkbox"
              checked={settings.hideLyricsOnLaunch ?? false}
              onChange={(e) => update({ hideLyricsOnLaunch: e.target.checked })}
              className="h-4 w-4 accent-cyan-300"
            />
          </label>
        </section>

        <section className="mt-4 space-y-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5 backdrop-blur-sm">
          <h2 className="font-mono text-xs tracking-[0.22em] text-white/55 uppercase">主题</h2>
          <p className="text-xs text-white/35">共 {BUILT_IN_THEMES.length} 套配色，切换后应用于歌词高亮与控件颜色（背景保持透明）</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BUILT_IN_THEMES.map((theme) => {
              const selected = settings.themeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => update({ themeId: theme.id, accentHex: theme.accent })}
                  className={`rounded-xl border p-3 text-left transition ${
                    selected ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-white/8 bg-black/20 hover:border-white/20'
                  }`}
                >
                  <div
                    className="mb-2 h-10 rounded-lg border border-white/5"
                    style={{
                      background: `
                        radial-gradient(circle at 80% 80%, ${theme.warm}88, transparent 55%),
                        radial-gradient(circle at 20% 20%, ${theme.cool}88, transparent 50%),
                        ${theme.background}
                      `,
                    }}
                  />
                  <p className="text-sm font-medium">{theme.nameZh}</p>
                  <p className="mt-0.5 text-[10px] text-white/35">{theme.name}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-4 space-y-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <h2 className="font-mono text-xs tracking-[0.22em] text-white/55 uppercase">窗口</h2>

          <label className="flex items-center justify-between gap-4 text-sm">
            <span className="text-white/70">始终置顶</span>
            <input
              type="checkbox"
              checked={settings.alwaysOnTop}
              onChange={(e) => update({ alwaysOnTop: e.target.checked })}
              className="h-4 w-4 accent-cyan-300"
            />
          </label>

          <label className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="text-white/70">鼠标穿透（点击桌面）</p>
              <p className="mt-1 text-xs text-white/35">开启后仅顶栏与底栏可点击；设置需鼠标移到顶/底栏，或从托盘打开</p>
            </div>
            <input
              type="checkbox"
              checked={settings.clickThrough}
              onChange={(e) => update({ clickThrough: e.target.checked })}
              className="h-4 w-4 accent-cyan-300"
            />
          </label>

          <label className="block text-sm text-white/70">
            不透明度
            <input
              type="range"
              min={0.4}
              max={1}
              step={0.05}
              value={settings.opacity}
              onChange={(e) => update({ opacity: Number(e.target.value) })}
              className="mt-2 w-full accent-cyan-300"
            />
          </label>
        </section>

        <section className="mt-4 space-y-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <h2 className="font-mono text-xs tracking-[0.22em] text-white/55 uppercase">歌词来源</h2>

          <label className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="text-white/70">Demo 模式</p>
              <p className="mt-1 text-xs text-white/35">使用内置 demo.lrc 自动滚动，便于预览 UI</p>
            </div>
            <input
              type="checkbox"
              checked={settings.demoMode}
              onChange={(e) => update({ demoMode: e.target.checked })}
              className="h-4 w-4 accent-cyan-300"
            />
          </label>

          <button
            type="button"
            onClick={async () => {
              const text = await window.desktopLyrics?.loadLyricsFile();
              if (text) {
                await window.desktopLyrics?.broadcastLyrics(text);
                setSavedHint('已加载 LRC 到歌词窗口');
              }
            }}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75 transition hover:border-cyan-300/30 hover:text-white"
          >
            选择本地 LRC 文件
          </button>
        </section>

        <section className="mt-4 space-y-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <h2 className="font-mono text-xs tracking-[0.22em] text-white/55 uppercase">歌词显示</h2>

          <label className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="text-white/70">逐字高亮（卡拉 OK）</p>
              <p className="mt-1 text-xs text-white/35">
                当前行随播放进度逐字变色，类似 QQ 音乐歌词效果；无逐字时间轴时会按行内均分估算
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.wordKaraoke}
              onChange={(e) => update({ wordKaraoke: e.target.checked })}
              className="h-4 w-4 accent-cyan-300"
            />
          </label>

          <label className="block text-sm text-white/70">
            <div className="mb-2 flex items-center justify-between">
              <span>歌词字号</span>
              <span className="font-mono text-xs text-white/45">{Math.round((settings.lyricsFontScale ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.75}
              max={1.6}
              step={0.05}
              value={settings.lyricsFontScale ?? 1}
              onChange={(e) => update({ lyricsFontScale: Number(e.target.value) })}
              className="w-full accent-cyan-300"
            />
            <p className="mt-1 text-xs text-white/35">75% ～ 160%，实时作用于歌词窗口</p>
          </label>
        </section>

        <section className="mt-4 space-y-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5">
          <h2 className="font-mono text-xs tracking-[0.22em] text-amber-200/70 uppercase">QQ 音乐</h2>
          <p className="text-xs leading-5 text-white/40">
            请确保 QQ 音乐已开启 SMTC。若歌词拉取失败，可粘贴 y.qq.com 登录后的 Cookie（会员曲库可能需要）。
          </p>
          <textarea
            value={settings.qqCookie}
            onChange={(e) => setSettings({ ...settings, qqCookie: e.target.value })}
            onBlur={() => update({ qqCookie: settings.qqCookie })}
            placeholder="可选：粘贴 QQ 音乐 Cookie"
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70 outline-none focus:border-cyan-300/30"
          />
        </section>

        <div className="mt-6 flex items-center justify-between text-xs text-white/35">
          <span>当前主题：{activeTheme.nameZh}</span>
          <span>{savedHint}</span>
        </div>
      </div>
    </div>
  );
};
