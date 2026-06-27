# QQ Desktop Lyrics

Windows 桌面悬浮歌词程序。UI 视觉风格借鉴 [Sonic Topography](https://github.com/yin-yizhen/sonic-topography) 的 3D 时间轴歌词设计，通过 Windows SMTC 同步 QQ 音乐播放进度并自动拉取歌词。

![应用图标](build/icon.png)

## 功能

- 透明置顶悬浮歌词窗口（3D 透视 + 时间轴滚动）
- 12 套内置主题、逐字卡拉 OK 高亮、歌词字号调节
- QQ 音乐同步：SMTC 读取进度 + 自动拉取歌词（可选 Cookie）
- Demo 模式 / 本地 LRC 文件加载
- 播放控制（播放/暂停、上一首/下一首）
- 鼠标穿透、窗口不透明度、始终置顶
- 系统托盘 + 设置窗口
- **常规设置**：开机自启、关闭到托盘、启动时隐藏歌词窗口

## 系统要求

- Windows 10 / 11（64 位）
- [QQ 音乐](https://y.qq.com/) 需开启 SMTC：设置 → 常规 → 通知 → **显示系统媒体传输控件**

## 下载使用（exe）

在 [Releases](https://github.com/amadoncy/qq-desktop-lyrics/releases) 页面下载：

| 文件 | 说明 |
|------|------|
| `QQ Desktop Lyrics-x.x.x-Portable.exe` | 绿色便携版，解压/双击即可运行，无需安装 |
| `QQ Desktop Lyrics-x.x.x-Setup.exe` | 安装版，可创建开始菜单快捷方式 |

首次运行后，歌词窗口会出现在桌面；右键**系统托盘**图标可打开设置或退出。

> 若 Windows SmartScreen 提示未知发布者，属未签名 exe 的常见情况，可自行选择「仍要运行」或从源码本地打包。

## 从源码开发

### 环境

- Node.js 20+
- npm 10+

### 安装与启动

```bash
git clone https://github.com/YOUR_USERNAME/qq-desktop-lyrics.git
cd qq-desktop-lyrics
npm install
npm start
```

启动后会出现透明歌词窗口。右键系统托盘图标 → **设置**，可配置主题、QQ 音乐、开机自启等。

### 仅构建（不打包）

```bash
npm run build
npm run electron:compile
```

## 打包生成 exe

本项目使用 [electron-builder](https://www.electron.build/) 打包 Windows 可执行文件。

### 1. 构建前端与 Electron 主进程

```bash
npm run build
npm run electron:compile
```

### 2. 生成安装包 / 便携版

```bash
# 同时生成 Portable + NSIS 安装包
npm run dist

# 仅生成便携版（更快）
npm run dist:portable
```

输出目录：`release/`

```
release/
├── QQ Desktop Lyrics-0.1.0-Portable.exe   # 便携版（单文件，推荐分发）
├── QQ Desktop Lyrics-0.1.0-Setup.exe      # 安装版（npm run dist）
└── win-unpacked/                          # 未打包目录（npm run dist:dir，可直接运行其中的 exe）
```

若 `dist:portable` 因网络下载 NSIS 组件失败，可重试，或使用 `npm run dist:dir` 后运行 `release/win-unpacked/QQ Desktop Lyrics.exe`。

### 3. 重新生成应用图标（可选）

图标源文件位于 `build/icon.png`。修改后执行：

```bash
npm run icon
```

会重新生成 `build/icon.ico`（供 electron-builder 与 Windows 任务栏使用）。

### 打包说明

- `scripts/smtc-control.ps1` 会作为额外资源打入安装包，供播放控制 PowerShell 脚本调用
- 应用图标：`build/icon.ico`（任务栏 / 托盘 / 安装程序）
- 若打包失败，请先确认 `npm run build` 与 `npm run electron:compile` 均无报错

## 项目结构

```
qq-desktop-lyrics/
├── build/              # 应用图标 icon.png / icon.ico
├── electron/           # Electron 主进程、preload、SMTC 同步
├── scripts/            # preload 构建、smtc-control.ps1、图标脚本
├── src/
│   ├── components/     # LyricsDisplay 等 UI 组件
│   ├── lib/            # 歌词解析、主题
│   ├── OverlayApp.tsx  # 歌词浮窗
│   └── SettingsPanel.tsx
├── public/demo.lrc
└── release/            # 打包输出（git 忽略）
```

## QQ 音乐同步

1. QQ 音乐开启 SMTC（见上方系统要求）
2. 本应用设置中 **关闭 Demo 模式**
3. 用 QQ 音乐播放歌曲，歌词窗口会自动匹配并滚动
4. 若提示无歌词，可在设置中粘贴 [y.qq.com](https://y.qq.com) 登录后的 Cookie

## 已知限制

- QQ 音乐 **无法可靠地通过 SMTC 跳转进度**
- 鼠标穿透模式下，仅顶栏与底栏可交互

## 常见问题

### 打包版显示「SMTC 读取失败 / 等待歌词」

1. 确认设置里 **Demo 模式已关闭**
2. QQ 音乐正在播放，且已开启 SMTC（设置 → 常规 → 通知 → 显示系统媒体传输控件）
3. 使用最新打包的 exe（旧版存在 SMTC 后端路径问题，切歌可用但读不到歌词）
4. 若仍无歌词，可在设置中粘贴 QQ 音乐 Cookie 后重试

### 开发模式正常、exe 不正常

请重新执行 `npm run dist:portable` 生成新版；或运行 `release/win-unpacked/QQ Desktop Lyrics.exe` 测试目录版。

## 与 Sonic Topography 的关系

| 借鉴 | 本项目新增 |
|------|-----------|
| LRC 解析、3D 时间轴 UI | Electron 透明窗口 |
| 主题 accent 配色 | 系统托盘 / 设置面板 |
| | QQ 音乐 API + Windows SMTC |

## 开源协议

[MIT](LICENSE)

## 免责声明

本项目仅供学习与个人非商业使用。接入 QQ 音乐需遵守相关服务条款；与腾讯 / QQ 音乐官方无关联。
